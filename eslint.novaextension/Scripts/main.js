// Log immediately when script loads (before activation)
console.log('ESLint main.js loaded');

const ESLintProvider = require('./eslint-provider.js');

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];

let provider = null;
let assistantDisposable = null;
let fixingSaveFiles = new Set(); // Track which files are currently being fixed
let disposables = []; // Track all disposables for cleanup
let editorDisposables = new WeakMap(); // Track per-editor disposables

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
    nova.config.onDidChange('eslint.lintOnChange', _value => {
      // Re-register with new event type
      if (assistantDisposable) {
        assistantDisposable.dispose();
      }
      registerIssueAssistant();
    }),
  );

  // Watch for workspace config changes (executable path and config path)
  disposables.push(
    nova.workspace.config.onDidChange('eslint.executablePath', () => {
      if (provider && provider.runner) {
        provider.runner.clearCache();
      }
    }),
  );

  disposables.push(
    nova.workspace.config.onDidChange('eslint.configPath', () => {
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
 * Register the issue assistant with appropriate event
 */
function registerIssueAssistant() {
  const lintOnChange = nova.config.get('eslint.lintOnChange', 'boolean');
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
        if (!nova.config.get('eslint.fixOnSave', 'boolean')) return;
        if (!editor.document.path) return;
        if (!SUPPORTED_LANGUAGES.includes(editor.document.syntax)) return;
        if (!provider || !provider.runner) {
          console.error('Provider not initialized');
          return;
        }

        const filePath = editor.document.path;

        // Check if this file is already being fixed
        if (fixingSaveFiles.has(filePath)) {
          return;
        }

        try {
          fixingSaveFiles.add(filePath);

          const fixedContent = await provider.runner.fix(filePath);
          if (!fixedContent) {
            fixingSaveFiles.delete(filePath);
            return;
          }

          const currentContent = editor.document.getTextInRange(
            new Range(0, editor.document.length),
          );

          if (currentContent === fixedContent) {
            fixingSaveFiles.delete(filePath);
            return;
          }

          await editor.edit(edit => {
            edit.replace(new Range(0, editor.document.length), fixedContent);
          });

          setTimeout(() => {
            // Validate editor is still valid before saving
            if (!editor.document) {
              fixingSaveFiles.delete(filePath);
              return;
            }

            editor
              .save()
              .then(() => {
                setTimeout(() => {
                  fixingSaveFiles.delete(filePath);
                }, 100);
              })
              .catch(saveError => {
                console.error('Failed to save after fix:', saveError);
                fixingSaveFiles.delete(filePath);
              });
          }, 10);
        } catch (error) {
          console.error('Fix on save error:', error);
          fixingSaveFiles.delete(filePath);
        }
      });

      editorDisposables.set(editor, saveDisposable);
    }),
  );
}
