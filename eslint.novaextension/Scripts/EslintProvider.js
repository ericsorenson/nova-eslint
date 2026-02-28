const {
  ESLintConfigError,
  ESLintNotFoundError,
} = require('./domain/errors/LintErrors.js');
const ESLintRunner = require('./EslintRunner.js');
const {
  convertESLintMessagesToIssues,
} = require('./utils/convertESLintMessagesToIssues.js');

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
    this.pendingLints = new WeakMap(); // Track pending lints by editor instance
    this.pendingTimeouts = new Set(); // Track timeout IDs for cleanup
    this.pendingResolvers = new Map(); // Track promise resolvers by request ID
    this.activeLints = new Set(); // Track active lint URIs to prevent concurrent lints
    this.shownNotifications = new Map(); // Map workspace path -> Set of notification IDs
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
      issue.severity = SEVERITY_MAP[obj.severity];
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
    // Clear all pending timeout IDs
    for (const timeoutId of this.pendingTimeouts) {
      clearTimeout(timeoutId);
    }
    this.pendingTimeouts.clear();
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
   * @param {string} workspacePath - Workspace path for context
   */
  handleError(error, workspacePath = null) {
    let body, notificationId, title;

    if (error instanceof ESLintNotFoundError) {
      notificationId = NOTIFICATION_ID_NOT_FOUND;
      title = NOTIFICATION_TITLE_NOT_FOUND;
      body = NOTIFICATION_BODY_NOT_FOUND;
    } else if (error instanceof ESLintConfigError) {
      notificationId = NOTIFICATION_ID_CONFIG_ERROR;
      title = NOTIFICATION_TITLE_CONFIG_ERROR;
      body = error.message;
    } else {
      console.error('Unhandled lint error:', error);
      return;
    }

    // Get workspace path (fallback to global if not provided)
    const contextKey = workspacePath || nova.workspace.path || 'global';

    // Get or create notification set for this workspace
    if (!this.shownNotifications.has(contextKey)) {
      this.shownNotifications.set(contextKey, new Set());
    }

    const workspaceNotifications = this.shownNotifications.get(contextKey);

    // Only show notification if we haven't shown this specific error before for this workspace
    if (!workspaceNotifications.has(notificationId)) {
      workspaceNotifications.add(notificationId);
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

    // Debounce: cancel pending lint for this editor
    const pending = this.pendingLints.get(editor);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingTimeouts.delete(pending.timeout);
      // Resolve the pending request with empty results
      this.resolveRequest(pending.requestId);
      // WeakMap entry will be garbage collected naturally
    }

    // Generate unique request ID
    const requestId = this.nextRequestId++;

    // Schedule lint with debounce
    return new Promise(resolve => {
      // Store resolver by request ID
      this.pendingResolvers.set(requestId, resolve);

      const timeout = setTimeout(async () => {
        // Clean up timeout tracking
        this.pendingTimeouts.delete(timeout);

        // Validate editor is still valid (not closed)
        if (!editor.document) {
          this.resolveRequest(requestId);
          return;
        }

        if (this.activeLints.has(uri)) {
          this.resolveRequest(requestId);
          return;
        }

        this.activeLints.add(uri);

        try {
          const issues = await this.lintDocument(editor);

          // Clear notification tracking for this workspace on successful lint
          const workspacePath = nova.workspace.path;
          if (workspacePath && this.shownNotifications.has(workspacePath)) {
            this.shownNotifications.delete(workspacePath);
          }

          // Resolve THIS specific request
          this.resolveRequest(requestId, issues);
        } catch (error) {
          this.handleError(error, nova.workspace.path);
          this.resolveRequest(requestId);
        } finally {
          this.activeLints.delete(uri);
        }
      }, DEBOUNCE_DELAY_MS);

      this.pendingTimeouts.add(timeout);
      this.pendingLints.set(editor, { requestId, timeout });
    });
  }

  /**
   * Resolve a pending lint request and clean up
   * @param {number} requestId - The request ID to resolve
   * @param {Issue[]} issues - The issues to return (defaults to empty array)
   */
  resolveRequest(requestId, issues = []) {
    const resolver = this.pendingResolvers.get(requestId);
    if (resolver) {
      resolver(issues);
      this.pendingResolvers.delete(requestId);
    }
  }
}

module.exports = ESLintProvider;
