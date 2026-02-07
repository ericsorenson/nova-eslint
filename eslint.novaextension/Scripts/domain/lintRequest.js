/**
 * Request to lint a file via ESLint
 * Can lint either file content (via stdin) or a saved file (via file path)
 *
 * @param {Object} params
 * @param {string|null} params.content - File content to lint via stdin, or null to read from disk
 * @param {string} params.filePath - Absolute path to the file (required for ESLint config resolution)
 * @returns {LintRequest}
 * @throws {Error} If filePath is missing
 */
function createLintRequest({ content, filePath }) {
  if (!filePath) {
    throw new Error('filePath is required');
  }

  return {
    /**
     * File content to lint via ESLint's stdin mode
     * @type {string|null}
     * Null means ESLint should read the file from disk (saved file mode)
     * Non-null means ESLint will receive content via stdin (dirty editor mode)
     */
    content,

    /**
     * Absolute path to the file being linted
     * @type {string}
     * Required for ESLint config discovery and --stdin-filename flag
     */
    filePath,

    /**
     * Check if this request includes content for stdin mode
     * @returns {boolean} True if content should be sent via stdin, false if ESLint should read from disk
     */
    hasContent() {
      return content !== null && content !== undefined;
    },
  };
}

/**
 * @typedef {Object} LintRequest
 * @property {string|null} content - File content to lint via stdin
 * @property {string} filePath - Absolute path to the file
 * @property {function(): boolean} hasContent - Check if content should be sent via stdin
 */

module.exports = { createLintRequest };
