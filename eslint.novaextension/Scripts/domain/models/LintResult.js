/**
 * Result of an ESLint lint operation
 * Contains the file path and any ESLint diagnostic messages
 *
 * @param {Object} params
 * @param {string} params.filePath - Absolute path to the linted file
 * @param {Array} [params.messages] - ESLint diagnostic messages (defaults to empty array)
 * @returns {LintResult}
 */
function createLintResult({ filePath, messages }) {
  const resultMessages = messages || [];

  return {
    /**
     * Absolute path to the linted file
     * @type {string}
     */
    filePath,

    /**
     * Check if this result contains any lint messages
     * @returns {boolean} True if there are lint messages, false if file is clean
     */
    hasMessages() {
      return resultMessages.length > 0;
    },

    /**
     * ESLint diagnostic messages from the lint operation
     * @type {Array<Object>}
     * Each message has shape: { line, column, message, severity, ruleId?, endLine?, endColumn? }
     * Empty array means no linting issues found
     */
    messages: resultMessages,
  };
}

/**
 * @typedef {Object} LintResult
 * @property {string} filePath - Absolute path to the linted file
 * @property {Array<Object>} messages - ESLint diagnostic messages
 * @property {function(): boolean} hasMessages - Check if there are any messages
 */

module.exports = { createLintResult };
