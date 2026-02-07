/**
 * Request to lint a file via ESLint
 * Can lint either file content (via stdin) or a saved file (via file path)
 */
class LintRequest {
  /**
   * @param {Object} params
   * @param {string|null} params.content - File content to lint via stdin, or null to read from disk
   * @param {string} params.filePath - Absolute path to the file (required for ESLint config resolution)
   * @throws {Error} If filePath is missing
   */
  constructor({ content, filePath }) {
    if (!filePath) {
      throw new Error('filePath is required');
    }

    /**
     * File content to lint via ESLint's stdin mode
     * @type {string|null}
     * Null means ESLint should read the file from disk (saved file mode)
     * Non-null means ESLint will receive content via stdin (dirty editor mode)
     */
    this.content = content;

    /**
     * Absolute path to the file being linted
     * @type {string}
     * Required for ESLint config discovery and --stdin-filename flag
     */
    this.filePath = filePath;
  }

  /**
   * Check if this request includes content for stdin mode
   * @returns {boolean} True if content should be sent via stdin, false if ESLint should read from disk
   */
  hasContent() {
    return this.content !== null && this.content !== undefined;
  }
}

module.exports = { LintRequest };
