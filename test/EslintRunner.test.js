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

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
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

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
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

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
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

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    await assert.rejects(async () => await runner.lint('/test/file.js'), {
      message: /not found/,
    });
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

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    await assert.rejects(async () => await runner.fix('/test/file.js'), {
      message: /not found/,
    });
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

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    await assert.rejects(
      async () => await runner.lintContent('const foo = 1;', '/test/file.js'),
      { message: /not found/ },
    );
  });

  test('fix should return fixed content when available', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
        open: () => ({
          close: () => {},
          read: () => 'file content',
        }),
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    // Mock the fix to return fixed content
    runner.lintService.fix = async () => ({
      fixedContent: 'const foo = 1;\n',
      hasChanges: true,
    });

    const result = await runner.fix('/test/file.js');

    assert.strictEqual(result, 'const foo = 1;\n');
  });

  test('fix should return null when no changes', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    // Mock the fix to return no changes
    runner.lintService.fix = async () => ({
      fixedContent: null,
      hasChanges: false,
    });

    const result = await runner.fix('/test/file.js');

    assert.strictEqual(result, null);
  });

  test('lint should return messages array', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    const mockMessages = [{ line: 1, message: 'Error' }];
    runner.lintService.lint = async () => ({
      filePath: '/test/file.js',
      messages: mockMessages,
    });

    const result = await runner.lint('/test/file.js');

    assert.ok(result.messages);
    assert.strictEqual(result.messages, mockMessages);
  });

  test('lintContent should return messages array', async () => {
    global.nova = {
      fs: {
        access: () => false,
        constants: { F_OK: 0, R_OK: 4 },
      },
      workspace: {
        config: { get: () => null },
        path: '/test',
      },
    };

    const ESLintRunner = require('../eslint.novaextension/Scripts/EslintRunner.js');
    const runner = new ESLintRunner();

    const mockMessages = [{ line: 1, message: 'Warning' }];
    runner.lintService.lint = async () => ({
      filePath: '/test/file.js',
      messages: mockMessages,
    });

    const result = await runner.lintContent('const x = 1;', '/test/file.js');

    assert.ok(result.messages);
    assert.strictEqual(result.messages, mockMessages);
  });
});
