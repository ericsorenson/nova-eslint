/**
 * Core linting service (domain logic)
 * No dependencies on Nova API - uses ports for all external operations
 */

const { FixResult, LintResult } = require('./models.js');

/**
 * Service for executing ESLint operations
 */
class LintService {
  constructor({ configPort, fileSystemPort, processPort }) {
    this.configPort = configPort;
    this.fileSystemPort = fileSystemPort;
    this.processPort = processPort;
    this.cachedConfigPath = null;
    this.cachedESLintPath = null;
    this.configPathCached = false;
    this.eslintPathCached = false;
  }

  /**
   * Lint a file
   * @param {LintRequest} request
   * @returns {Promise<LintResult>}
   */
  async lint(request) {
    const eslintPath = this.getESLintPath();
    const args = this.buildLintArgs(request);

    const result = await this.processPort.execute({
      args,
      command: '/usr/bin/env',
      cwd: this.configPort.getWorkspacePath(),
      stdin: request.hasContent() ? request.content : null,
    });

    // Exit codes: 0 = clean, 1 = lint errors (success), 2 = fatal error
    if (result.exitCode === 2) {
      throw new Error(`ESLint failed: ${result.stderr}`);
    }

    const parsed = this.parseOutput(result.stdout);
    return new LintResult({
      filePath: request.filePath,
      messages: parsed.messages,
    });
  }

  /**
   * Fix a file and return the fixed content
   * @param {string} filePath
   * @returns {Promise<FixResult>}
   */
  async fix(filePath) {
    const eslintPath = this.getESLintPath();
    const args = this.buildFixArgs(filePath);

    const result = await this.processPort.execute({
      args,
      command: '/usr/bin/env',
      cwd: this.configPort.getWorkspacePath(),
      stdin: null,
    });

    if (result.exitCode === 2) {
      throw new Error(`ESLint fix failed: ${result.stderr}`);
    }

    const parsed = this.parseOutput(result.stdout);
    const fixedContent = parsed.output || null;
    const hasChanges = fixedContent !== null;

    return new FixResult({ fixedContent, hasChanges });
  }

  /**
   * Build arguments for linting
   * @private
   */
  buildLintArgs(request) {
    const eslintPath = this.getESLintPath();
    const config = this.configPort.getLintConfig();
    const args = ['node', eslintPath, '--format', 'json'];

    if (config.configPath) {
      args.push('--config', config.configPath);
    }

    if (request.hasContent()) {
      args.push('--stdin', '--stdin-filename', request.filePath);
    } else {
      args.push(request.filePath);
    }

    return args;
  }

  /**
   * Build arguments for fixing
   * @private
   */
  buildFixArgs(filePath) {
    const eslintPath = this.getESLintPath();
    const config = this.configPort.getLintConfig();
    const args = [
      'node',
      eslintPath,
      '--format',
      'json',
      '--fix-dry-run',
      filePath,
    ];

    if (config.configPath) {
      args.splice(4, 0, '--config', config.configPath);
    }

    return args;
  }

  /**
   * Get ESLint executable path (cached)
   * @private
   */
  getESLintPath() {
    if (this.eslintPathCached) {
      return this.cachedESLintPath;
    }

    const config = this.configPort.getLintConfig();
    const workspacePath = this.configPort.getWorkspacePath();

    if (!workspacePath) {
      throw new Error('ESLint requires a workspace to be open');
    }

    if (config.executablePath) {
      this.cachedESLintPath = config.executablePath;
      this.eslintPathCached = true;
      return this.cachedESLintPath;
    }

    // Check node_modules/.bin/eslint
    const defaultPath = `${workspacePath}/node_modules/.bin/eslint`;
    if (this.fileSystemPort.exists(defaultPath)) {
      this.cachedESLintPath = defaultPath;
      this.eslintPathCached = true;
      return this.cachedESLintPath;
    }

    throw new Error('ESLint executable not found');
  }

  /**
   * Parse ESLint JSON output
   * @private
   */
  parseOutput(stdout) {
    if (!stdout || stdout.trim() === '') {
      return { messages: [], output: null };
    }

    try {
      const results = JSON.parse(stdout);
      if (!Array.isArray(results) || results.length === 0) {
        return { messages: [], output: null };
      }

      const firstResult = results[0];
      return {
        messages: firstResult.messages || [],
        output: firstResult.output || null,
      };
    } catch (error) {
      throw new Error(`Failed to parse ESLint output: ${error.message}`);
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cachedConfigPath = null;
    this.cachedESLintPath = null;
    this.configPathCached = false;
    this.eslintPathCached = false;
  }
}

module.exports = { LintService };
