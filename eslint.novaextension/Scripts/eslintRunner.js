/**
 * ESLintRunner - Thin adapter for LintService
 * Maintains backward compatibility while delegating to domain logic
 */

const { NovaConfigAdapter } = require('./adapters/novaConfigAdapter.js');
const {
  NovaFileSystemAdapter,
} = require('./adapters/novaFilesystemAdapter.js');
const { NovaProcessAdapter } = require('./adapters/novaProcessAdapter.js');
const { LintRequest } = require('./domain/lintRequest.js');
const { LintService } = require('./domain/lintService.js');

class ESLintRunner {
  constructor() {
    // Create adapters
    const configPort = new NovaConfigAdapter();
    const fileSystemPort = new NovaFileSystemAdapter();
    const processPort = new NovaProcessAdapter();

    // Create service with adapters
    this.lintService = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    // Keep reference to process adapter for disposal
    this.processPort = processPort;
  }

  /**
   * Clear cached ESLint path and config (useful when config changes)
   */
  clearCache() {
    this.lintService.clearCache();
  }

  /**
   * Dispose of runner and terminate all active processes
   */
  dispose() {
    this.processPort.dispose();
  }

  /**
   * Run ESLint --fix on a file and return fixed content
   * @param {string} filePath - Absolute path to the file
   * @returns {Promise<string|null>} Fixed content or null if no fixes
   */
  async fix(filePath) {
    const result = await this.lintService.fix(filePath);
    return result.fixedContent;
  }

  /**
   * Run ESLint on a file
   * @param {string} filePath - Absolute path to the file
   * @returns {Promise<Object>} ESLint result object with messages array
   */
  async lint(filePath) {
    const request = new LintRequest({ content: null, filePath });
    const result = await this.lintService.lint(request);
    return { messages: result.messages };
  }

  /**
   * Run ESLint on content via stdin
   * @param {string} content - File content to lint
   * @param {string} filePath - Path for context (used by ESLint for config)
   * @returns {Promise<Object>} ESLint result object with messages array
   */
  async lintContent(content, filePath) {
    const request = new LintRequest({ content, filePath });
    const result = await this.lintService.lint(request);
    return { messages: result.messages };
  }
}

module.exports = ESLintRunner;
