/**
 * ESLintRunner - Handles finding and executing ESLint
 */
class ESLintRunner {
  constructor() {
    this.eslintPath = null;
    this.workspacePath = nova.workspace.path;
    this.cachedConfigPath = undefined; // undefined = not cached, null = cached as "no config"
  }

  /**
   * Build ESLint arguments with optional config
   * @param {string} filePath - File to lint
   * @param {...string} extraArgs - Additional arguments
   * @returns {string[]}
   */
  buildArgs(filePath, ...extraArgs) {
    const args = [this.eslintPath, '--format', 'json', ...extraArgs, filePath];

    const configPath = this.getConfigPath();
    if (configPath) {
      args.push('--config', configPath);
    }

    return args;
  }

  /**
   * Clear cached ESLint path and config (useful when config changes)
   */
  clearCache() {
    this.eslintPath = null;
    this.cachedConfigPath = undefined;
  }

  /**
   * Ensure ESLint is found
   * @throws {Error} If ESLint is not found
   */
  ensureESLint() {
    if (!this.eslintPath) {
      this.eslintPath = this.findESLint();
    }
    if (!this.eslintPath) {
      throw new Error(
        'ESLint executable not found. Install ESLint in your project: npm install --save-dev eslint',
      );
    }
  }

  /**
   * Execute ESLint process
   * @param {string[]} args - Command line arguments
   * @param {string} [stdinContent] - Optional content to send to stdin
   * @returns {Promise<Object>}
   */
  executeESLint(args, stdinContent) {
    return new Promise((resolve, reject) => {
      const process = new Process('/usr/bin/env', {
        args: ['node', ...args],
        cwd: this.workspacePath,
      });

      let stdout = '';
      let stderr = '';

      process.onStdout(line => {
        stdout += line;
      });

      process.onStderr(line => {
        stderr += line;
      });

      process.onDidExit(exitCode => {
        // Exit codes:
        // 0 = no errors
        // 1 = linting errors found (this is success for us)
        // 2 = configuration/runtime error

        if (exitCode === 0 || exitCode === 1) {
          try {
            const results = JSON.parse(stdout);

            if (!Array.isArray(results) || results.length === 0) {
              resolve({ messages: [] });
              return;
            }

            resolve(results[0]);
          } catch (e) {
            reject(new Error(`Failed to parse ESLint output: ${e.message}`));
          }
        } else {
          // Configuration or runtime error
          const errorMessage = stderr || stdout || 'Unknown error';
          reject(
            new Error(`ESLint failed (exit ${exitCode}): ${errorMessage}`),
          );
        }
      });

      try {
        process.start();

        // If stdin content provided, write it to the process
        if (stdinContent !== undefined) {
          const writer = process.stdin.getWriter();
          writer.ready
            .then(() => {
              writer.write(stdinContent);
              writer.close();
            })
            .catch(err => {
              reject(
                new Error(`Failed to write to ESLint stdin: ${err.message}`),
              );
            });
        }
      } catch (e) {
        reject(new Error(`Failed to start ESLint: ${e.message}`));
      }
    });
  }

  /**
   * Find ESLint executable in workspace
   * @returns {string|null} Path to ESLint or null if not found
   */
  findESLint() {
    if (!this.workspacePath) {
      return null;
    }

    // Check user-configured path first
    const configuredPath = nova.workspace.config.get('eslint.executablePath');
    if (configuredPath) {
      const fullPath = this.resolveExecutablePath(configuredPath);
      if (fullPath && this.isExecutable(fullPath)) {
        return fullPath;
      }
    }

    // Try common locations
    const candidates = [
      'node_modules/.bin/eslint',
      'node_modules/eslint/bin/eslint.js',
    ];

    for (const candidate of candidates) {
      const fullPath = nova.path.join(this.workspacePath, candidate);
      if (this.isExecutable(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Run ESLint --fix on a file and return fixed content
   * @param {string} filePath - Absolute path to the file
   * @returns {Promise<string|null>} Fixed content or null if no fixes
   */
  async fix(filePath) {
    this.ensureESLint();
    const result = await this.executeESLint(
      this.buildArgs(filePath, '--fix-dry-run'),
    );
    return result?.output || null;
  }

  /**
   * Get the resolved config path (cached)
   * @returns {string|null}
   */
  getConfigPath() {
    // Use undefined to indicate "not yet cached"
    if (this.cachedConfigPath !== undefined) {
      return this.cachedConfigPath;
    }

    const customConfig = nova.workspace.config.get('eslint.configPath');
    if (customConfig) {
      this.cachedConfigPath = nova.path.join(this.workspacePath, customConfig);
      return this.cachedConfigPath;
    }

    // Cache null to indicate "no config"
    this.cachedConfigPath = null;
    return null;
  }

  /**
   * Check if a file exists and is executable
   * @param {string} path
   * @returns {boolean}
   */
  isExecutable(path) {
    try {
      const stat = nova.fs.stat(path);
      if (!stat) {
        return false;
      }

      // Check if file is readable (we'll execute via node)
      return nova.fs.access(path, nova.fs.constants.R_OK);
    } catch {
      return false;
    }
  }

  /**
   * Run ESLint on a file
   * @param {string} filePath - Absolute path to the file
   * @returns {Promise<Object>} ESLint result object
   */
  async lint(filePath) {
    this.ensureESLint();
    return this.executeESLint(this.buildArgs(filePath));
  }

  /**
   * Run ESLint on content via stdin (avoids temp file I/O)
   * @param {string} content - File content to lint
   * @param {string} filePath - Path for context (used by ESLint for config)
   * @returns {Promise<Object>} ESLint result object
   */
  async lintContent(content, filePath) {
    this.ensureESLint();
    const args = [
      this.eslintPath,
      '--format',
      'json',
      '--stdin',
      '--stdin-filename',
      filePath,
    ];

    const configPath = this.getConfigPath();
    if (configPath) {
      args.push('--config', configPath);
    }

    return this.executeESLint(args, content);
  }

  /**
   * Resolve executable path (handle relative vs absolute)
   * @param {string} path
   * @returns {string}
   */
  resolveExecutablePath(path) {
    if (nova.path.isAbsolute(path)) {
      return path;
    }
    return nova.path.join(this.workspacePath, path);
  }
}

module.exports = ESLintRunner;
