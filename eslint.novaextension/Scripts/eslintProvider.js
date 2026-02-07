const ESLintRunner = require('./EslintRunner.js');
const { convertESLintMessagesToIssues } = require('./eslintUtils.js');

// Constants
const SEVERITY_MAP = {
  error: IssueSeverity.Error,
  info: IssueSeverity.Info,
  warning: IssueSeverity.Warning,
};

const NOTIFICATION_ID_NOT_FOUND = 'eslint-not-found';
const NOTIFICATION_ID_CONFIG_ERROR = 'eslint-config-error';
const NOTIFICATION_TITLE_NOT_FOUND = 'ESLint Not Found';
const NOTIFICATION_TITLE_CONFIG_ERROR = 'ESLint Configuration Error';
const NOTIFICATION_BODY_NOT_FOUND =
  'ESLint is not installed in this project. Install it with:\n\nnpm install --save-dev eslint';

const CONFIG_KEY_ENABLE = 'eslint.enable';
const DEBOUNCE_DELAY_MS = 300;
const ISSUE_SOURCE = 'ESLint';

/**
 * ESLintProvider - Nova issue assistant for ESLint
 */
class ESLintProvider {
  constructor() {
    this.runner = new ESLintRunner();
    this.pendingLints = new Map();
    this.pendingResolvers = new Map(); // Track promise resolvers by request ID
    this.activeLints = new Set();
    this.shownNotifications = new Set(); // Track which specific errors we've notified about
    this.nextRequestId = 0; // Counter for generating unique request IDs
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
      issue.source = ISSUE_SOURCE;

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
    for (const pending of this.pendingLints.values()) {
      clearTimeout(pending.timeout);
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
    let body, notificationId, title;

    if (error.message.includes('not found')) {
      notificationId = NOTIFICATION_ID_NOT_FOUND;
      title = NOTIFICATION_TITLE_NOT_FOUND;
      body = NOTIFICATION_BODY_NOT_FOUND;
    } else if (error.message.includes('failed')) {
      notificationId = NOTIFICATION_ID_CONFIG_ERROR;
      title = NOTIFICATION_TITLE_CONFIG_ERROR;
      body = error.message;
    } else {
      return; // Unknown error type, don't notify
    }

    // Only show notification if we haven't shown this specific error before
    if (!this.shownNotifications.has(notificationId)) {
      this.shownNotifications.add(notificationId);
      const request = new NotificationRequest(notificationId);
      request.title = title;
      request.body = body;
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
    if (!nova.config.get(CONFIG_KEY_ENABLE, 'boolean')) {
      return [];
    }

    const uri = editor.document.uri;

    // Debounce: cancel pending lint for this file
    const pending = this.pendingLints.get(uri);
    if (pending) {
      clearTimeout(pending.timeout);
      // Resolve the pending request with empty results
      const oldResolver = this.pendingResolvers.get(pending.requestId);
      if (oldResolver) {
        oldResolver([]);
        this.pendingResolvers.delete(pending.requestId);
      }
      this.pendingLints.delete(uri);
    }

    // Generate unique request ID
    const requestId = this.nextRequestId++;

    // Schedule lint with debounce
    return new Promise(resolve => {
      // Store resolver by request ID
      this.pendingResolvers.set(requestId, resolve);

      const timeout = setTimeout(async () => {
        this.pendingLints.delete(uri);

        // Validate editor is still valid (not closed)
        if (!editor.document) {
          const resolver = this.pendingResolvers.get(requestId);
          if (resolver) {
            resolver([]);
            this.pendingResolvers.delete(requestId);
          }
          return;
        }

        if (this.activeLints.has(uri)) {
          const resolver = this.pendingResolvers.get(requestId);
          if (resolver) {
            resolver([]);
            this.pendingResolvers.delete(requestId);
          }
          return;
        }

        this.activeLints.add(uri);

        try {
          const issues = await this.lintDocument(editor);
          // Reset notification tracking on successful lint (ESLint is working again)
          this.shownNotifications.clear();

          // Resolve THIS specific request
          const resolver = this.pendingResolvers.get(requestId);
          if (resolver) {
            resolver(issues);
            this.pendingResolvers.delete(requestId);
          }
        } catch (error) {
          this.handleError(error);

          const resolver = this.pendingResolvers.get(requestId);
          if (resolver) {
            resolver([]);
            this.pendingResolvers.delete(requestId);
          }
        } finally {
          this.activeLints.delete(uri);
        }
      }, DEBOUNCE_DELAY_MS);

      this.pendingLints.set(uri, { requestId, timeout });
    });
  }
}

module.exports = ESLintProvider;
