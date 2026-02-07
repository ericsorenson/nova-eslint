/**
 * Nova adapter for configuration
 * Implements ConfigPort using Nova's config API
 * @implements {ConfigPort}
 */

const { createLintConfig } = require('../domain/LintConfig.js');

class NovaConfigAdapter {
  getLintConfig() {
    const executablePath = nova.workspace.config.get(
      'eslint.executablePath',
      'string',
    );
    const configPath = nova.workspace.config.get('eslint.configPath', 'string');

    return createLintConfig({
      configPath: configPath || null,
      executablePath: executablePath || null,
    });
  }

  getWorkspacePath() {
    return nova.workspace.path || null;
  }
}

module.exports = { NovaConfigAdapter };
