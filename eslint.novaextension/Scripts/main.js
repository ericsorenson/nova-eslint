// Log immediately when script loads (before activation)
console.log('ESLint main.js loaded');

const ESLintProvider = require('./eslint-provider.js');

// Constants
const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];
const CONFIG_KEY_LINT_ON_CHANGE = 'eslint.lintOnChange';
const CONFIG_KEY_FIX_ON_SAVE = 'eslint.fixOnSave';
const CONFIG_KEY_EXECUTABLE_PATH = 'eslint.executablePath';
const CONFIG_KEY_CONFIG_PATH = 'eslint.configPath';

let provider = null;
let assistantDisposable = null;
let fixingEditors = new WeakMap(); // Track which editors are currently being fixed (with timeout)
let disposables = []; // Track all disposables for cleanup
let editorDisposables = new WeakMap(); // Track per-editor disposables

// Constants for fix-on-save timing
const FIX_ON_SAVE_TIMEOUT_MS = 5000; // Failsafe: force cleanup after 5 seconds
// Note: These delays are necessary due to Nova's async editor behavior:
// - EDIT_SETTLE_DELAY_MS: Nova's editor.edit() may not commit changes immediately,
//   so we wait briefly before calling save() to ensure edits are applied
// - SAVE_COMPLETE_DELAY_MS: Nova's onDidSave event fires during save operation,
//   not after completion. We wait to prevent the fix cycle from re-triggering
//   before the save event fully settles
const EDIT_SETTLE_DELAY_MS = 10; // Wait for edit to commit before saving
const SAVE_COMPLETE_DELAY_MS = 100; // Wait for save event to settle

/**
 * Activate the extension
 */
exports.activate = function () {
  console.log('ESLint extension activated');

  // Create provider
  provider = new ESLintProvider();

  // Register issue assistant
  registerIssueAssistant();

  // Watch for configuration changes
  disposables.push(
    nova.config.onDidChange(CONFIG_KEY_LINT_ON_CHANGE, _value => {
      // Re-register with new event type
      if (assistantDisposable) {
        assistantDisposable.dispose();
      }
      registerIssueAssistant();
    }),
  );

  // Watch for workspace config changes (executable path and config path)
  disposables.push(
    nova.workspace.config.onDidChange(CONFIG_KEY_EXECUTABLE_PATH, () => {
      if (provider && provider.runner) {
        provider.runner.clearCache();
      }
    }),
  );

  disposables.push(
    nova.workspace.config.onDidChange(CONFIG_KEY_CONFIG_PATH, () => {
      if (provider && provider.runner) {
        provider.runner.clearCache();
      }
    }),
  );

  // Set up fix on save
  setupFixOnSave();
};

/**
 * Deactivate the extension
 */
exports.deactivate = function () {
  console.log('ESLint extension deactivated');

  if (assistantDisposable) {
    assistantDisposable.dispose();
    assistantDisposable = null;
  }

  // Dispose all tracked listeners
  disposables.forEach(disposable => disposable.dispose());
  disposables = [];

  if (provider) {
    provider.dispose();
    provider = null;
  }
};

/**
 * Check if editor is currently being fixed
 */
function isFixing(editor) {
  return fixingEditors.has(editor);
}

/**
 * Register the issue assistant with appropriate event
 */
function registerIssueAssistant() {
  const lintOnChange = nova.config.get(CONFIG_KEY_LINT_ON_CHANGE, 'boolean');
  const event = lintOnChange ? 'onChange' : 'onSave';

  console.log(`Registering ESLint issue assistant with event: ${event}`);

  assistantDisposable = nova.assistants.registerIssueAssistant(
    SUPPORTED_LANGUAGES,
    provider,
    { event },
  );
}

/**
 * Set up fix on save functionality
 */
function setupFixOnSave() {
  disposables.push(
    nova.workspace.onDidAddTextEditor(editor => {
      // Use WeakMap to store editor-specific disposable
      // This prevents memory leak as WeakMap entries are GC'd when editor is destroyed
      const saveDisposable = editor.onDidSave(async editor => {
        if (!nova.config.get(CONFIG_KEY_FIX_ON_SAVE, 'boolean')) return;
        if (!editor.document.path) return;
        if (!SUPPORTED_LANGUAGES.includes(editor.document.syntax)) return;
        if (!provider || !provider.runner) {
          console.error('Provider not initialized');
          return;
        }

        // Check if this editor is already being fixed
        if (isFixing(editor)) {
          return;
        }

        const filePath = editor.document.path;

        try {
          startFixing(editor);

          const fixedContent = await provider.runner.fix(filePath);
          if (!fixedContent) {
            stopFixing(editor);
            return;
          }

          const currentContent = editor.document.getTextInRange(
            new Range(0, editor.document.length),
          );

          if (currentContent === fixedContent) {
            stopFixing(editor);
            return;
          }

          await editor.edit(edit => {
            edit.replace(new Range(0, editor.document.length), fixedContent);
          });

          // Wait for edit to commit before saving
          setTimeout(() => {
            // Validate editor is still valid before saving
            if (!editor.document) {
              stopFixing(editor);
              return;
            }

            editor
              .save()
              .then(() => {
                // Wait for save event to settle before cleaning up
                setTimeout(() => {
                  stopFixing(editor);
                }, SAVE_COMPLETE_DELAY_MS);
              })
              .catch(saveError => {
                console.error('Failed to save after fix:', saveError);
                stopFixing(editor);
              });
          }, EDIT_SETTLE_DELAY_MS);
        } catch (error) {
          console.error('Fix on save error:', error);
          stopFixing(editor);
        }
      });

      // Listen for editor destruction to clean up disposables
      const destroyDisposable = editor.onDidDestroy(() => {
        // Clean up fix-on-save state
        stopFixing(editor);

        // Clean up disposables
        const disposable = editorDisposables.get(editor);
        if (disposable) {
          disposable.dispose();
          editorDisposables.delete(editor);
        }
        if (destroyDisposable) {
          destroyDisposable.dispose();
        }
      });

      editorDisposables.set(editor, saveDisposable);
    }),
  );
}

/**
 * Mark editor as fixing and set failsafe timeout
 */
function startFixing(editor) {
  const timeoutId = setTimeout(() => {
    console.warn(
      'Fix-on-save timeout reached for',
      editor.document?.path || 'unknown file',
    );
    stopFixing(editor);
  }, FIX_ON_SAVE_TIMEOUT_MS);

  fixingEditors.set(editor, timeoutId);
}

/**
 * Stop fixing and clear timeout
 */
function stopFixing(editor) {
  const timeoutId = fixingEditors.get(editor);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  fixingEditors.delete(editor);
}
