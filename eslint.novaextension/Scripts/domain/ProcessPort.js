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

module.exports = { ProcessPort };
