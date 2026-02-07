// Constants
const CONFIG_KEY_EXECUTABLE_PATH = 'eslint.executablePath';
const CONFIG_KEY_CONFIG_PATH = 'eslint.configPath';
const PROCESS_TIMEOUT_MS = 30000;
const MAX_CONCURRENT_PROCESSES = 4;
const NODE_COMMAND = '/usr/bin/env';
const ESLINT_FORMAT = 'json';
const ESLINT_CANDIDATES = [
  'node_modules/.bin/eslint',
  'node_modules/eslint/bin/eslint.js',
];

/**
 * ESLintRunner - Handles finding and executing ESLint
 */
class ESLintRunner {
  constructor() {
    this.eslintPath = null;
    this.workspacePath = nova.workspace.path;
    this.cachedConfigPath = null;
    this.configPathCached = false; // Track whether config path has been cached
    this.activeProcesses = new Set(); // Track active processes for cleanup
    this._processQueue = []; // Queue for pending lint requests when at max capacity
  }

  /**
   * Execute ESLint process (internal implementation)
   * @param {string[]} args - Command line arguments
   * @param {string} [stdinContent] - Optional content to send to stdin
   * @returns {Promise<Object>}
   */
  _executeESLintProcess(args, stdinContent) {
    return new Promise((resolve, reject) => {
      if (!this.workspacePath) {
        reject(
          new Error(
            'ESLint requires an open workspace. Please open a folder to use ESLint.',
          ),
        );
        return;
      }

      const process = new Process(NODE_COMMAND, {
        args: ['node', ...args],
        cwd: this.workspacePath,
      });

      let stdout = '';
      let stderr = '';
      let settled = false; // Track if promise is settled to avoid double-settle
      let processTimeout = null;

      // Track this process for cleanup
      this.activeProcesses.add(process);

      const cleanup = () => {
        this.activeProcesses.delete(process);
        if (processTimeout) {
          clearTimeout(processTimeout);
        }
        // Process next queued request after this one completes
        this.processQueue();
      };

      process.onStdout(line => {
        stdout += line;
      });

      process.onStderr(line => {
        stderr += line;
      });

      process.onDidExit(exitCode => {
        cleanup();

        if (settled) return; // Already rejected/resolved
        settled = true;

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

        // Set timeout to kill hung processes
        processTimeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();

          try {
            process.kill();
          } catch (_e) {
            // Process might already be dead
          }

          reject(
            new Error(
              `ESLint process timed out after ${PROCESS_TIMEOUT_MS / 1000} seconds`,
            ),
          );
        }, PROCESS_TIMEOUT_MS);

        // If stdin content provided, write it to the process
        if (stdinContent !== undefined) {
          const writer = process.stdin.getWriter();
          writer.ready
            .then(() => {
              if (settled) return; // Don't write if already settled
              writer.write(stdinContent);
              writer.close();
            })
            .catch(err => {
              if (settled) return; // Don't reject if already settled
              settled = true;
              cleanup();

              try {
                process.kill();
              } catch (_e) {
                // Process might already be dead
              }

              reject(
                new Error(`Failed to write to ESLint stdin: ${err.message}`),
              );
            });
        }
      } catch (e) {
        settled = true;
        cleanup();

        try {
          process.kill();
        } catch (_killErr) {
          // Process might not have started
        }

        reject(new Error(`Failed to start ESLint: ${e.message}`));
      }
    });
  }

  /**
   * Build ESLint arguments with optional config
   * @param {string} filePath - File to lint
   * @param {...string} extraArgs - Additional arguments
   * @returns {string[]}
   */
  buildArgs(filePath, ...extraArgs) {
    return [
      this.eslintPath,
      '--format',
      ESLINT_FORMAT,
      ...extraArgs,
      filePath,
      ...this.getConfigArgs(),
    ];
  }

  /**
   * Clear cached ESLint path and config (useful when config changes)
   */
  clearCache() {
    this.eslintPath = null;
    this.cachedConfigPath = null;
    this.configPathCached = false;
  }

  /**
   * Dispose of runner and kill all active processes
   */
  dispose() {
    // Kill all active processes
    for (const process of this.activeProcesses) {
      try {
        process.kill();
      } catch (e) {
        // Process might already be dead
        console.error('Error killing ESLint process:', e);
      }
    }
    this.activeProcesses.clear();

    // Reject all queued requests
    for (const { reject } of this._processQueue) {
      reject(new Error('ESLintRunner disposed'));
    }
    this._processQueue = [];
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
   * Execute ESLint process (with queue management)
   * @param {string[]} args - Command line arguments
   * @param {string} [stdinContent] - Optional content to send to stdin
   * @returns {Promise<Object>}
   */
  executeESLint(args, stdinContent) {
    // If at capacity, queue the request
    if (this.activeProcesses.size >= MAX_CONCURRENT_PROCESSES) {
      return new Promise((resolve, reject) => {
        this._processQueue.push({ args, reject, resolve, stdinContent });
      });
    }

    return this._executeESLintProcess(args, stdinContent);
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
    const configuredPath = nova.workspace.config.get(
      CONFIG_KEY_EXECUTABLE_PATH,
    );
    if (configuredPath) {
      const fullPath = this.resolveExecutablePath(configuredPath);
      if (fullPath && this.isExecutable(fullPath)) {
        return fullPath;
      }
    }

    // Try common locations
    for (const candidate of ESLINT_CANDIDATES) {
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
   * Get config path arguments
   * @returns {string[]} Config arguments or empty array
   */
  getConfigArgs() {
    const configPath = this.getConfigPath();
    return configPath ? ['--config', configPath] : [];
  }

  /**
   * Get the resolved config path (cached)
   * @returns {string|null}
   */
  getConfigPath() {
    if (this.configPathCached) {
      return this.cachedConfigPath;
    }

    const customConfig = nova.workspace.config.get(CONFIG_KEY_CONFIG_PATH);
    if (customConfig) {
      this.cachedConfigPath = nova.path.join(this.workspacePath, customConfig);
    } else {
      this.cachedConfigPath = null;
    }

    this.configPathCached = true;
    return this.cachedConfigPath;
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
      ESLINT_FORMAT,
      '--stdin',
      '--stdin-filename',
      filePath,
      ...this.getConfigArgs(),
    ];

    return this.executeESLint(args, content);
  }

  /**
   * Process next queued request if any
   */
  processQueue() {
    if (
      this._processQueue.length > 0 &&
      this.activeProcesses.size < MAX_CONCURRENT_PROCESSES
    ) {
      const { args, reject, resolve, stdinContent } =
        this._processQueue.shift();
      this._executeESLintProcess(args, stdinContent)
        .then(resolve)
        .catch(reject);
    }
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
