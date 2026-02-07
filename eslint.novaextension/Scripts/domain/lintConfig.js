/**
 * User configuration for ESLint execution
 * Defines paths to ESLint executable and config file
 *
 * @param {Object} [params={}] - Configuration parameters
 * @param {string|null} [params.configPath=null] - Path to ESLint config file
 * @param {string|null} [params.executablePath=null] - Path to ESLint executable
 * @returns {LintConfig}
 */
function createLintConfig({ configPath = null, executablePath = null } = {}) {
  return {
    /**
     * Path to ESLint configuration file (e.g., .eslintrc.js)
     * @type {string|null}
     * Null means ESLint will discover config files using default resolution
     */
    configPath,

    /**
     * Path to ESLint executable (e.g., node_modules/.bin/eslint)
     * @type {string|null}
     * Null means use default path (workspace/node_modules/.bin/eslint)
     */
    executablePath,
  };
}

/**
 * @typedef {Object} LintConfig
 * @property {string|null} configPath - Path to ESLint config file
 * @property {string|null} executablePath - Path to ESLint executable
 */

module.exports = { createLintConfig };
