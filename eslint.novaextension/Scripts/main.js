// Log immediately when script loads (before activation)
console.log('ESLint main.js loaded');

const ESLintProvider = require('./eslint-provider.js');
const { FixOnSaveHandler } = require('./fix-on-save-handler.js');

// Constants
const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];
const CONFIG_KEY_LINT_ON_CHANGE = 'eslint.lintOnChange';
const CONFIG_KEY_EXECUTABLE_PATH = 'eslint.executablePath';
const CONFIG_KEY_CONFIG_PATH = 'eslint.configPath';

let provider = null;
let assistantDisposable = null;
let fixOnSaveHandler = null;
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

  // Set up fix-on-save handler
  fixOnSaveHandler = new FixOnSaveHandler(provider);
  fixOnSaveHandler.setupFixOnSave(disposables, editorDisposables);

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
  const lintOnChange = nova.config.get(CONFIG_KEY_LINT_ON_CHANGE, 'boolean');
  const event = lintOnChange ? 'onChange' : 'onSave';

  console.log(`Registering ESLint issue assistant with event: ${event}`);

  assistantDisposable = nova.assistants.registerIssueAssistant(
    SUPPORTED_LANGUAGES,
    provider,
    { event },
  );
}
