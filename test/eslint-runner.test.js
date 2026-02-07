const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('ESLintRunner - Adapter Tests', () => {
  test('should delegate clearCache to LintService', () => {
    // Mock nova global
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: {
          get: () => null,
        },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Should not throw
    runner.clearCache();

    // Verify cache was cleared by checking internal state
    assert.strictEqual(runner.lintService.eslintPathCached, false);
    assert.strictEqual(runner.lintService.configPathCached, false);
  });

  test('should delegate dispose to process adapter', () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: {
          get: () => null,
        },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Should not throw
    runner.dispose();
  });

  test('should create LintService with Nova adapters', () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: {
          get: () => null,
        },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    // Verify runner has lintService
    assert.ok(runner.lintService);
    assert.ok(runner.processPort);
  });

  test('should throw error when linting without ESLint installed', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: {
          get: () => null,
        },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    await assert.rejects(
      async () => await runner.lint('/test/file.js'),
      { message: /not found/ },
    );
  });

  test('should throw error when fixing without ESLint installed', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: {
          get: () => null,
        },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    await assert.rejects(
      async () => await runner.fix('/test/file.js'),
      { message: /not found/ },
    );
  });

  test('should throw error when linting content without ESLint installed', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: {
          get: () => null,
        },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/eslint-runner.js');
    const runner = new ESLintRunner();

    await assert.rejects(
      async () => await runner.lintContent('const foo = 1;', '/test/file.js'),
      { message: /not found/ },
    );
  });
});
