/**
 * User configuration for ESLint execution
 * Defines paths to ESLint executable and config file
 */
class LintConfig {
  /**
   * @param {Object} [params={}] - Configuration parameters
   * @param {string|null} [params.configPath=null] - Path to ESLint config file
   * @param {string|null} [params.executablePath=null] - Path to ESLint executable
   */
  constructor({ configPath = null, executablePath = null } = {}) {
    /**
     * Path to ESLint configuration file (e.g., .eslintrc.js)
     * @type {string|null}
     * Null means ESLint will discover config files using default resolution
     */
    this.configPath = configPath;

    /**
     * Path to ESLint executable (e.g., node_modules/.bin/eslint)
     * @type {string|null}
     * Null means use default path (workspace/node_modules/.bin/eslint)
     */
    this.executablePath = executablePath;
  }
}

module.exports = { LintConfig };
