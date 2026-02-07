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

module.exports = { ConfigPort };
