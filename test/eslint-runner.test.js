const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('ESLintRunner - Bug Fix Tests', () => {
  test('getConfigPath caching should distinguish undefined/null/string', () => {
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

    // Initially undefined (not cached)
    assert.strictEqual(runner.cachedConfigPath, undefined);

    // First call should cache null (no config)
    const result1 = runner.getConfigPath();
    assert.strictEqual(result1, null);
    assert.strictEqual(runner.cachedConfigPath, null);

    // Second call should return cached null
    const result2 = runner.getConfigPath();
    assert.strictEqual(result2, null);

    // Clear cache and test with a config path
    runner.clearCache();
    assert.strictEqual(runner.cachedConfigPath, undefined);

    // Mock with actual config
    global.nova.workspace.config.get = () => 'custom.config.js';
    runner.workspacePath = '/test';

    const result3 = runner.getConfigPath();
    assert.strictEqual(result3, '/test/custom.config.js');
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

  test('clearCache should reset cachedConfigPath to undefined', () => {
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
    assert.notStrictEqual(runner.cachedConfigPath, undefined);

    // Clear should set to undefined
    runner.clearCache();
    assert.strictEqual(runner.cachedConfigPath, undefined);
  });
});
