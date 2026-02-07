/**
 * Process port
 * Executes external processes
 *
 * @typedef {Object} ProcessPort
 * @property {function(ProcessExecuteOptions): Promise<ProcessResult>} execute - Execute a process
 */

/**
 * @typedef {Object} ProcessExecuteOptions
 * @property {string} command - Command to execute
 * @property {string[]} args - Command arguments
 * @property {string|null} cwd - Working directory
 * @property {string|null} stdin - Standard input content
 */

/**
 * @typedef {Object} ProcessResult
 * @property {string} stdout - Standard output
 * @property {string} stderr - Standard error
 * @property {number} exitCode - Exit code
 */

module.exports = {};
