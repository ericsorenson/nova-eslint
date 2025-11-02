const ESLintRunner = require('./eslint-runner.js');
const { convertESLintMessagesToIssues } = require('./eslint-utils.js');

// Severity mapping (constant to avoid recreation on every lint)
const SEVERITY_MAP = {
  error: IssueSeverity.Error,
  info: IssueSeverity.Info,
  warning: IssueSeverity.Warning,
};

/**
 * ESLintProvider - Nova issue assistant for ESLint
 */
class ESLintProvider {
  constructor() {
    this.runner = new ESLintRunner();
    this.pendingLints = new Map();
    this.pendingResolvers = new Map(); // Track promise resolvers to resolve on dispose
    this.activeLints = new Set();
    this.notificationShown = false;
  }

  /**
   * Convert ESLint result to Nova issues
   * @param {Object} result - ESLint result object
   * @returns {Issue[]}
   */
  convertToIssues(result) {
    if (!result || !result.messages) {
      return [];
    }

    return convertESLintMessagesToIssues(result.messages).map(obj => {
      const issue = new Issue();
      issue.message = obj.message;
      issue.line = obj.line;
      issue.column = obj.column;
      issue.severity = SEVERITY_MAP[obj.severity] || IssueSeverity.Info;
      issue.source = 'ESLint';

      if (obj.code) issue.code = obj.code;
      if (obj.endLine) issue.endLine = obj.endLine;
      if (obj.endColumn) issue.endColumn = obj.endColumn;

      return issue;
    });
  }

  /**
   * Dispose of resources
   */
  dispose() {
    // Clear pending lints
    for (const timeout of this.pendingLints.values()) {
      clearTimeout(timeout);
    }
    this.pendingLints.clear();
    this.activeLints.clear();

    // Resolve all pending promises with empty arrays
    for (const resolve of this.pendingResolvers.values()) {
      resolve([]);
    }
    this.pendingResolvers.clear();

    // Dispose runner (kills active processes)
    if (this.runner) {
      this.runner.dispose();
    }
  }

  /**
   * Handle linting errors
   * @param {Error} error
   */
  handleError(error) {
    if (this.notificationShown) return;

    const notifications = {
      failed: {
        body: error.message,
        id: 'eslint-config-error',
        title: 'ESLint Configuration Error',
      },
      'not found': {
        body: 'ESLint is not installed in this project. Install it with:\n\nnpm install --save-dev eslint',
        id: 'eslint-not-found',
        title: 'ESLint Not Found',
      },
    };

    const notif = Object.entries(notifications).find(([key]) =>
      error.message.includes(key),
    )?.[1];

    if (notif) {
      this.notificationShown = true;
      const request = new NotificationRequest(notif.id);
      request.title = notif.title;
      request.body = notif.body;
      request.actions = ['OK'];
      nova.notifications.add(request);
    }
  }

  /**
   * Lint a document
   * @param {TextEditor} editor
   * @returns {Promise<Issue[]>}
   */
  async lintDocument(editor) {
    const filePath = editor.document.path;

    if (!filePath) {
      // Unsaved file
      return [];
    }

    // If the document is dirty (unsaved changes), use stdin to avoid temp file I/O
    if (editor.document.isDirty) {
      const content = editor.document.getTextInRange(
        new Range(0, editor.document.length),
      );

      const result = await this.runner.lintContent(content, filePath);
      return this.convertToIssues(result);
    }

    // Run ESLint on the saved file
    const result = await this.runner.lint(filePath);

    // Convert to Nova issues
    return this.convertToIssues(result);
  }

  /**
   * Provide issues for a text editor (called by Nova)
   * @param {TextEditor} editor
   * @returns {Promise<Issue[]>}
   */
  async provideIssues(editor) {
    if (!nova.config.get('eslint.enable', 'boolean')) {
      return [];
    }

    const uri = editor.document.uri;

    // Debounce: cancel pending lint for this file
    const pending = this.pendingLints.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingLints.delete(uri);
      // Don't delete resolver - the new promise will overwrite it
    }

    // Schedule lint with debounce
    return new Promise(resolve => {
      // Store resolver to be called on dispose
      this.pendingResolvers.set(uri, resolve);

      const timeout = setTimeout(async () => {
        this.pendingLints.delete(uri);
        this.pendingResolvers.delete(uri);

        // Validate editor is still valid (not closed)
        if (!editor.document) {
          resolve([]);
          return;
        }

        if (this.activeLints.has(uri)) {
          resolve([]);
          return;
        }

        this.activeLints.add(uri);

        try {
          const issues = await this.lintDocument(editor);
          // Reset notification flag on successful lint (ESLint is working)
          this.notificationShown = false;
          resolve(issues);
        } catch (error) {
          this.handleError(error);
          resolve([]);
        } finally {
          this.activeLints.delete(uri);
        }
      }, 300); // 300ms debounce

      this.pendingLints.set(uri, timeout);
    });
  }
}

module.exports = ESLintProvider;
