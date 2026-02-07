/**
 * Domain models for ESLint operations
 * These are pure data structures with no framework dependencies
 */

/**
 * Fix result
 */
class FixResult {
  constructor({ fixedContent, hasChanges }) {
    this.fixedContent = fixedContent;
    this.hasChanges = hasChanges;
  }
}

/**
 * Lint configuration
 */
class LintConfig {
  constructor({ configPath = null, executablePath = null } = {}) {
    this.configPath = configPath;
    this.executablePath = executablePath;
  }
}

/**
 * Lint request
 */
class LintRequest {
  constructor({ content, filePath }) {
    if (!filePath) {
      throw new Error('filePath is required');
    }
    this.content = content; // null means read from disk
    this.filePath = filePath;
  }

  hasContent() {
    return this.content !== null && this.content !== undefined;
  }
}

/**
 * Lint result
 */
class LintResult {
  constructor({ filePath, messages }) {
    this.filePath = filePath;
    this.messages = messages || [];
  }

  hasMessages() {
    return this.messages.length > 0;
  }
}

module.exports = {
  FixResult,
  LintConfig,
  LintRequest,
  LintResult,
};
