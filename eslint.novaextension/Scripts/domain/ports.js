/**
 * Ports (interfaces) for external dependencies
 * These define contracts that adapters must implement
 */

/**
 * Configuration port
 * Provides access to user configuration
 */
class ConfigPort {
  /**
   * Get lint configuration
   * @returns {LintConfig}
   */
  getLintConfig() {
    throw new Error('Not implemented');
  }

  /**
   * Get workspace root path
   * @returns {string|null}
   */
  getWorkspacePath() {
    throw new Error('Not implemented');
  }
}

/**
 * Process port
 * Executes external processes
 */
class ProcessPort {
  /**
   * Execute a process
   * @param {Object} options
   * @param {string} options.command - Command to execute
   * @param {string[]} options.args - Command arguments
   * @param {string|null} options.cwd - Working directory
   * @param {string|null} options.stdin - Standard input content
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  execute({ args, command, cwd, stdin }) {
    throw new Error('Not implemented');
  }
}

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

module.exports = {
  ConfigPort,
  FileSystemPort,
  ProcessPort,
};
