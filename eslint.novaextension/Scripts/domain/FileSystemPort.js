/**
 * File system port
 * Provides file system operations
 */
class FileSystemPort {
  /**
   * Check if a file exists
   * @param {string} path
   * @returns {boolean}
   */
  exists(path) {
    throw new Error('Not implemented');
  }

  /**
   * Read file content
   * @param {string} path
   * @returns {string}
   */
  readFile(path) {
    throw new Error('Not implemented');
  }
}

module.exports = { FileSystemPort };
