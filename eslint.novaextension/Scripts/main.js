// Log immediately when script loads (before activation)
console.log('ESLint main.js loaded');

const ESLintProvider = require('./eslint-provider.js');

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];

let provider = null;
let assistantDisposable = null;
let isFixingSave = false;
let disposables = []; // Track all disposables for cleanup

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
      disposables.push(
        editor.onDidSave(async editor => {
          if (isFixingSave) return;
          if (!nova.config.get('eslint.fixOnSave', 'boolean')) return;
          if (!editor.document.path) return;
          if (!SUPPORTED_LANGUAGES.includes(editor.document.syntax)) return;
          if (!provider || !provider.runner) {
            console.error('Provider not initialized');
            return;
          }

          try {
            const fixedContent = await provider.runner.fix(
              editor.document.path,
            );
            if (!fixedContent) return;

            const currentContent = editor.document.getTextInRange(
              new Range(0, editor.document.length),
            );

            if (currentContent === fixedContent) return;

            isFixingSave = true;

            await editor.edit(edit => {
              edit.replace(new Range(0, editor.document.length), fixedContent);
            });

            setTimeout(() => {
              editor
                .save()
                .then(() => {
                  setTimeout(() => {
                    isFixingSave = false;
                  }, 100);
                })
                .catch(saveError => {
                  console.error('Failed to save after fix:', saveError);
                  isFixingSave = false;
                });
            }, 10);
          } catch (error) {
            console.error('Fix on save error:', error);
            isFixingSave = false;
          }
        }),
      );
    }),
  );
}
