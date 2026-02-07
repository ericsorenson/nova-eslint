/**
 * Result of an ESLint lint operation
 * Contains the file path and any ESLint diagnostic messages
 */
class LintResult {
  /**
   * @param {Object} params
   * @param {string} params.filePath - Absolute path to the linted file
   * @param {Array} [params.messages] - ESLint diagnostic messages (defaults to empty array)
   */
  constructor({ filePath, messages }) {
    /**
     * Absolute path to the linted file
     * @type {string}
     */
    this.filePath = filePath;

    /**
     * ESLint diagnostic messages from the lint operation
     * @type {Array<Object>}
     * Each message has shape: { line, column, message, severity, ruleId?, endLine?, endColumn? }
     * Empty array means no linting issues found
     */
    this.messages = messages || [];
  }

  /**
   * Check if this result contains any lint messages
   * @returns {boolean} True if there are lint messages, false if file is clean
   */
  hasMessages() {
    return this.messages.length > 0;
  }
}

module.exports = { LintResult };
