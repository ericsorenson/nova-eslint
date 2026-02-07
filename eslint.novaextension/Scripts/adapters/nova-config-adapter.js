/**
 * Nova adapter for configuration
 * Implements ConfigPort using Nova's config API
 */

const { ConfigPort } = require('../domain/ports.js');
const { LintConfig } = require('../domain/models.js');

class NovaConfigAdapter extends ConfigPort {
  getLintConfig() {
    const executablePath = nova.workspace.config.get(
      'eslint.executablePath',
      'string',
    );
    const configPath = nova.workspace.config.get(
      'eslint.configPath',
      'string',
    );

    return new LintConfig({
      configPath: configPath || null,
      executablePath: executablePath || null,
    });
  }

  getWorkspacePath() {
    return nova.workspace.path || null;
  }
}

module.exports = { NovaConfigAdapter };
