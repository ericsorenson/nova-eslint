const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('ESLintRunner - Bug Fix Tests', () => {
  test('getConfigPath caching should distinguish null and string values', () => {
    // Mock nova global
    global.nova = {
      path: {
        join: (a, b) => `${a}/${b}`,
      },
      workspace: {
        config: {
          get: () => null,
        },
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Initially not cached
    assert.strictEqual(runner.configPathCached, false);
    assert.strictEqual(runner.cachedConfigPath, null);

    // First call should cache null (no config)
    const result1 = runner.getConfigPath();
    assert.strictEqual(result1, null);
    assert.strictEqual(runner.configPathCached, true);
    assert.strictEqual(runner.cachedConfigPath, null);

    // Second call should return cached null without calling config.get
    const result2 = runner.getConfigPath();
    assert.strictEqual(result2, null);

    // Clear cache and test with a config path
    runner.clearCache();
    assert.strictEqual(runner.configPathCached, false);
    assert.strictEqual(runner.cachedConfigPath, null);

    // Mock with actual config
    global.nova.workspace.config.get = () => 'custom.config.js';
    runner.workspacePath = '/test';

    const result3 = runner.getConfigPath();
    assert.strictEqual(result3, '/test/custom.config.js');
    assert.strictEqual(runner.configPathCached, true);
    assert.strictEqual(runner.cachedConfigPath, '/test/custom.config.js');

    // Should return cached value
    const result4 = runner.getConfigPath();
    assert.strictEqual(result4, '/test/custom.config.js');
  });

  test('activeProcesses Set should be initialized', () => {
    global.nova = {
      workspace: { path: '/test' },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    assert.ok(runner.activeProcesses instanceof Set);
    assert.strictEqual(runner.activeProcesses.size, 0);
  });

  test('dispose should clear activeProcesses', () => {
    global.nova = {
      workspace: { path: '/test' },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Mock process
    const mockProcess = {
      kill: () => {},
    };

    runner.activeProcesses.add(mockProcess);
    assert.strictEqual(runner.activeProcesses.size, 1);

    runner.dispose();
    assert.strictEqual(runner.activeProcesses.size, 0);
  });

  test('clearCache should reset configPathCached flag', () => {
    global.nova = {
      path: { join: (a, b) => `${a}/${b}` },
      workspace: {
        config: { get: () => 'test.js' },
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();
    runner.workspacePath = '/test';

    // Cache a value
    runner.getConfigPath();
    assert.strictEqual(runner.configPathCached, true);
    assert.notStrictEqual(runner.cachedConfigPath, null);

    // Clear should reset flag to false
    runner.clearCache();
    assert.strictEqual(runner.configPathCached, false);
    assert.strictEqual(runner.cachedConfigPath, null);
  });
});

describe('ESLintRunner - isExecutable() Tests', () => {
  function setupMocks() {
    global.nova = {
      fs: {
        access: () => true,
        constants: { R_OK: 4 },
        stat: () => ({ isFile: true }),
      },
      workspace: { path: '/test' },
    };
  }

  test('isExecutable should return false for non-existent paths', () => {
    setupMocks();
    global.nova.fs.stat = () => null; // File doesn't exist

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    assert.strictEqual(runner.isExecutable('/nonexistent/path'), false);
  });

  test('isExecutable should return false when access check fails', () => {
    setupMocks();
    global.nova.fs.access = () => false; // Not readable

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    assert.strictEqual(runner.isExecutable('/path/to/file'), false);
  });

  test('isExecutable should handle permission errors gracefully', () => {
    setupMocks();
    global.nova.fs.stat = () => {
      throw new Error('Permission denied');
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Should catch error and return false
    assert.strictEqual(runner.isExecutable('/path/to/file'), false);
  });
});

describe('ESLintRunner - buildArgs() Tests', () => {
  function setupMocks() {
    global.nova = {
      path: {
        join: (a, b) => `${a}/${b}`,
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };
  }

  test('buildArgs should build basic arguments without config', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();
    runner.eslintPath = '/path/to/eslint';

    const args = runner.buildArgs('/test/file.js');

    assert.deepStrictEqual(args, [
      '/path/to/eslint',
      '--format',
      'json',
      '/test/file.js',
    ]);
  });

  test('buildArgs should include config path when configured', () => {
    setupMocks();
    global.nova.workspace.config.get = key =>
      key === 'eslint.configPath' ? 'custom.config.js' : null;

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();
    runner.eslintPath = '/path/to/eslint';

    const args = runner.buildArgs('/test/file.js');

    assert.deepStrictEqual(args, [
      '/path/to/eslint',
      '--format',
      'json',
      '/test/file.js',
      '--config',
      '/test/custom.config.js',
    ]);
  });

  test('buildArgs should include extra arguments', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();
    runner.eslintPath = '/path/to/eslint';

    const args = runner.buildArgs('/test/file.js', '--fix-dry-run', '--quiet');

    assert.deepStrictEqual(args, [
      '/path/to/eslint',
      '--format',
      'json',
      '--fix-dry-run',
      '--quiet',
      '/test/file.js',
    ]);
  });
});

describe('ESLintRunner - ensureESLint() Tests', () => {
  function setupMocks() {
    global.nova = {
      fs: {
        access: () => true,
        constants: { R_OK: 4 },
        stat: () => ({ isFile: true }),
      },
      path: {
        join: (a, b) => `${a}/${b}`,
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };
  }

  test('ensureESLint should not throw when ESLint is found', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Mock findESLint to return a path
    runner.findESLint = () => '/test/node_modules/.bin/eslint';

    assert.doesNotThrow(() => {
      runner.ensureESLint();
    });

    assert.strictEqual(runner.eslintPath, '/test/node_modules/.bin/eslint');
  });

  test('ensureESLint should throw when ESLint is not found', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Mock findESLint to return null
    runner.findESLint = () => null;

    assert.throws(
      () => {
        runner.ensureESLint();
      },
      {
        message: /ESLint executable not found/,
      },
    );
  });

  test('ensureESLint should use cached eslintPath', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();
    runner.eslintPath = '/cached/path/to/eslint';

    let findCalled = false;
    runner.findESLint = () => {
      findCalled = true;
      return '/new/path';
    };

    runner.ensureESLint();

    // Should not call findESLint if path is cached
    assert.strictEqual(findCalled, false);
    assert.strictEqual(runner.eslintPath, '/cached/path/to/eslint');
  });
});

describe('ESLintRunner - findESLint() Tests', () => {
  function setupMocks() {
    global.nova = {
      fs: {
        access: () => true,
        constants: { R_OK: 4 },
        stat: () => ({ isFile: true }),
      },
      path: {
        isAbsolute: path => path.startsWith('/'),
        join: (a, b) => `${a}/${b}`,
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };
  }

  test('findESLint should find ESLint in node_modules/.bin', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const path = runner.findESLint();

    assert.strictEqual(path, '/test/node_modules/.bin/eslint');
  });

  test('findESLint should find ESLint in node_modules/eslint/bin', () => {
    setupMocks();
    let callCount = 0;
    global.nova.fs.stat = path => {
      callCount++;
      // First call (node_modules/.bin/eslint) fails
      if (callCount === 1) return null;
      // Second call (node_modules/eslint/bin/eslint.js) succeeds
      return { isFile: true };
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const path = runner.findESLint();

    assert.strictEqual(path, '/test/node_modules/eslint/bin/eslint.js');
  });

  test('findESLint should prefer configured path', () => {
    setupMocks();
    global.nova.workspace.config.get = key =>
      key === 'eslint.executablePath' ? 'custom/eslint' : null;

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const path = runner.findESLint();

    assert.strictEqual(path, '/test/custom/eslint');
  });

  test('findESLint should return null when ESLint not found', () => {
    setupMocks();
    global.nova.fs.stat = () => null; // All paths fail

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const path = runner.findESLint();

    assert.strictEqual(path, null);
  });

  test('findESLint should return null when no workspace path', () => {
    setupMocks();
    global.nova.workspace.path = null;

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const path = runner.findESLint();

    assert.strictEqual(path, null);
  });
});

describe('ESLintRunner - resolveExecutablePath() Tests', () => {
  function setupMocks() {
    global.nova = {
      path: {
        isAbsolute: path => path.startsWith('/'),
        join: (a, b) => `${a}/${b}`,
      },
      workspace: { path: '/test' },
    };
  }

  test('resolveExecutablePath should return absolute paths as-is', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const result = runner.resolveExecutablePath('/absolute/path/to/eslint');

    assert.strictEqual(result, '/absolute/path/to/eslint');
  });

  test('resolveExecutablePath should resolve relative paths', () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const result = runner.resolveExecutablePath('custom/eslint');

    assert.strictEqual(result, '/test/custom/eslint');
  });
});

describe('ESLintRunner - executeESLint() Tests', () => {
  function setupMocks() {
    global.nova = {
      workspace: { path: '/test' },
    };

    // Mock Process constructor
    global.Process = class {
      constructor(command, options) {
        this.command = command;
        this.options = options;
        this._onStdout = null;
        this._onStderr = null;
        this._onDidExit = null;
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: () => {},
          }),
        };
      }

      onStdout(callback) {
        this._onStdout = callback;
      }

      onStderr(callback) {
        this._onStderr = callback;
      }

      onDidExit(callback) {
        this._onDidExit = callback;
      }

      start() {
        // Simulate successful execution
        if (this._onStdout) {
          this._onStdout(
            '[{"messages":[{"message":"Test error","line":1,"column":1,"severity":2,"ruleId":"test"}]}]',
          );
        }
        setTimeout(() => {
          if (this._onDidExit) {
            this._onDidExit(1); // Exit code 1 = lint errors found
          }
        }, 10);
      }

      kill() {}
    };
  }

  test('executeESLint should resolve with parsed results on success', async () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const result = await runner.executeESLint([
      '/path/to/eslint',
      '--format',
      'json',
      'file.js',
    ]);

    assert.ok(result);
    assert.ok(Array.isArray(result.messages));
    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.messages[0].message, 'Test error');
  });

  test('executeESLint should handle exit code 0 (no errors)', async () => {
    setupMocks();
    global.Process = class {
      constructor() {
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: () => {},
          }),
        };
      }
      onStdout(callback) {
        this._onStdout = callback;
      }
      onStderr(callback) {}
      onDidExit(callback) {
        this._onDidExit = callback;
      }
      start() {
        if (this._onStdout) {
          this._onStdout('[{"messages":[]}]');
        }
        setTimeout(() => {
          if (this._onDidExit) {
            this._onDidExit(0); // Exit code 0 = no errors
          }
        }, 10);
      }
      kill() {}
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const result = await runner.executeESLint([
      '/path/to/eslint',
      '--format',
      'json',
      'file.js',
    ]);

    assert.ok(result);
    assert.deepStrictEqual(result.messages, []);
  });

  test('executeESLint should reject on configuration error (exit code 2)', async () => {
    setupMocks();
    global.Process = class {
      constructor() {
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: () => {},
          }),
        };
      }
      onStdout() {}
      onStderr(callback) {
        this._onStderr = callback;
      }
      onDidExit(callback) {
        this._onDidExit = callback;
      }
      start() {
        if (this._onStderr) {
          this._onStderr('Configuration error: invalid config');
        }
        setTimeout(() => {
          if (this._onDidExit) {
            this._onDidExit(2); // Exit code 2 = config error
          }
        }, 10);
      }
      kill() {}
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    await assert.rejects(
      runner.executeESLint(['/path/to/eslint', '--format', 'json', 'file.js']),
      {
        message: /ESLint failed.*Configuration error/,
      },
    );
  });

  test('executeESLint should handle invalid JSON output', async () => {
    setupMocks();
    global.Process = class {
      constructor() {
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: () => {},
          }),
        };
      }
      onStdout(callback) {
        this._onStdout = callback;
      }
      onStderr() {}
      onDidExit(callback) {
        this._onDidExit = callback;
      }
      start() {
        if (this._onStdout) {
          this._onStdout('not valid json');
        }
        setTimeout(() => {
          if (this._onDidExit) {
            this._onDidExit(0);
          }
        }, 10);
      }
      kill() {}
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    await assert.rejects(
      runner.executeESLint(['/path/to/eslint', '--format', 'json', 'file.js']),
      {
        message: /Failed to parse ESLint output/,
      },
    );
  });

  test('executeESLint should handle empty results array', async () => {
    setupMocks();
    global.Process = class {
      constructor() {
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: () => {},
          }),
        };
      }
      onStdout(callback) {
        this._onStdout = callback;
      }
      onStderr() {}
      onDidExit(callback) {
        this._onDidExit = callback;
      }
      start() {
        if (this._onStdout) {
          this._onStdout('[]'); // Empty array
        }
        setTimeout(() => {
          if (this._onDidExit) {
            this._onDidExit(0);
          }
        }, 10);
      }
      kill() {}
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    const result = await runner.executeESLint([
      '/path/to/eslint',
      '--format',
      'json',
      'file.js',
    ]);

    assert.deepStrictEqual(result, { messages: [] });
  });

  test('executeESLint should write to stdin when content provided', async () => {
    setupMocks();
    let writtenContent = null;

    global.Process = class {
      constructor() {
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: content => {
              writtenContent = content;
            },
          }),
        };
      }
      onStdout(callback) {
        this._onStdout = callback;
      }
      onStderr() {}
      onDidExit(callback) {
        this._onDidExit = callback;
      }
      start() {
        if (this._onStdout) {
          this._onStdout('[{"messages":[]}]');
        }
        setTimeout(() => {
          if (this._onDidExit) {
            this._onDidExit(0);
          }
        }, 10);
      }
      kill() {}
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    await runner.executeESLint(
      ['/path/to/eslint', '--format', 'json', '--stdin'],
      'const x = 1;',
    );

    assert.strictEqual(writtenContent, 'const x = 1;');
  });

  test('executeESLint should track and clean up active processes', async () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    assert.strictEqual(runner.activeProcesses.size, 0);

    const promise = runner.executeESLint([
      '/path/to/eslint',
      '--format',
      'json',
      'file.js',
    ]);

    // Process should be tracked while running
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.strictEqual(runner.activeProcesses.size, 1);

    await promise;

    // Process should be cleaned up after completion
    assert.strictEqual(runner.activeProcesses.size, 0);
  });
});

describe('ESLintRunner - High-level method tests', () => {
  function setupMocks() {
    global.nova = {
      fs: {
        access: () => true,
        constants: { R_OK: 4 },
        stat: () => ({ isFile: true }),
      },
      path: {
        join: (a, b) => `${a}/${b}`,
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };

    global.Process = class {
      constructor() {
        this.stdin = {
          getWriter: () => ({
            close: () => {},
            ready: Promise.resolve(),
            write: () => {},
          }),
        };
      }
      onStdout(callback) {
        callback('[{"messages":[]}]');
      }
      onStderr() {}
      onDidExit(callback) {
        setTimeout(() => callback(0), 10);
      }
      start() {}
      kill() {}
    };
  }

  test('lint() should call executeESLint with correct arguments', async () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    let executedArgs = null;
    runner.executeESLint = async args => {
      executedArgs = args;
      return { messages: [] };
    };
    runner.ensureESLint = () => {
      runner.eslintPath = '/test/node_modules/.bin/eslint';
    };

    await runner.lint('/test/file.js');

    assert.ok(executedArgs);
    assert.ok(executedArgs.includes('/test/node_modules/.bin/eslint'));
    assert.ok(executedArgs.includes('--format'));
    assert.ok(executedArgs.includes('json'));
    assert.ok(executedArgs.includes('/test/file.js'));
  });

  test('lintContent() should call executeESLint with stdin arguments', async () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    let executedArgs = null;
    let stdinContent = null;
    runner.executeESLint = async (args, content) => {
      executedArgs = args;
      stdinContent = content;
      return { messages: [] };
    };
    runner.ensureESLint = () => {
      runner.eslintPath = '/test/node_modules/.bin/eslint';
    };

    await runner.lintContent('const x = 1;', '/test/file.js');

    assert.ok(executedArgs);
    assert.ok(executedArgs.includes('--stdin'));
    assert.ok(executedArgs.includes('--stdin-filename'));
    assert.ok(executedArgs.includes('/test/file.js'));
    assert.strictEqual(stdinContent, 'const x = 1;');
  });

  test('fix() should call executeESLint with --fix-dry-run', async () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    let executedArgs = null;
    runner.executeESLint = async args => {
      executedArgs = args;
      return { output: 'fixed content' };
    };
    runner.ensureESLint = () => {
      runner.eslintPath = '/test/node_modules/.bin/eslint';
    };

    const result = await runner.fix('/test/file.js');

    assert.ok(executedArgs);
    assert.ok(executedArgs.includes('--fix-dry-run'));
    assert.strictEqual(result, 'fixed content');
  });

  test('fix() should return null when no output', async () => {
    setupMocks();
    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    runner.executeESLint = async () => {
      return { messages: [] }; // No output field
    };
    runner.ensureESLint = () => {
      runner.eslintPath = '/test/node_modules/.bin/eslint';
    };

    const result = await runner.fix('/test/file.js');

    assert.strictEqual(result, null);
  });
});
