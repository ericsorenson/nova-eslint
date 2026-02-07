const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  LintService,
} = require('../../eslint.novaextension/Scripts/domain/LintService.js');
const {
  createLintConfig,
} = require('../../eslint.novaextension/Scripts/domain/models/LintConfig.js');
const {
  createLintRequest,
} = require('../../eslint.novaextension/Scripts/domain/models/LintRequest.js');

// Mock implementations
/** @implements {ConfigPort} */
class MockConfigPort {
  constructor({
    configPath = null,
    executablePath = null,
    workspacePath = '/workspace',
  } = {}) {
    this.configPath = configPath;
    this.executablePath = executablePath;
    this.workspacePath = workspacePath;
  }

  getLintConfig() {
    return createLintConfig({
      configPath: this.configPath,
      executablePath: this.executablePath,
    });
  }

  getWorkspacePath() {
    return this.workspacePath;
  }
}

/** @implements {FileSystemPort} */
class MockFileSystemPort {
  constructor(existingFiles = new Set()) {
    this.existingFiles = existingFiles;
  }

  exists(path) {
    return this.existingFiles.has(path);
  }

  readFile(path) {
    if (!this.exists(path)) {
      throw new Error(`File not found: ${path}`);
    }
    return 'file content';
  }
}

/** @implements {ProcessPort} */
class MockProcessPort {
  constructor(mockResults = {}) {
    this.mockResults = mockResults;
    this.executedCommands = [];
  }

  async execute({ args, command, cwd, stdin }) {
    this.executedCommands.push({ args, command, cwd, stdin });

    // Find mock result by matching command signature
    const key = JSON.stringify({ args: args.slice(0, 3) }); // Match first 3 args
    const result = this.mockResults[key];

    if (result) {
      return result;
    }

    // Default success response
    return {
      exitCode: 0,
      stderr: '',
      stdout: JSON.stringify([{ messages: [] }]),
    };
  }
}

describe('Domain - LintService', () => {
  test('should lint file with no config', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.ok(result.filePath);
    assert.strictEqual(result.filePath, '/workspace/test.js');
    assert.ok(Array.isArray(result.messages));
    assert.strictEqual(processPort.executedCommands.length, 1);
  });

  test('should lint file with custom config', async () => {
    const configPort = new MockConfigPort({
      configPath: '/workspace/.eslintrc.js',
    });
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await service.lint(request);

    const cmd = processPort.executedCommands[0];
    assert.ok(cmd.args.includes('--config'));
    assert.ok(cmd.args.includes('/workspace/.eslintrc.js'));
  });

  test('should lint content via stdin', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: 'const foo = 1;',
      filePath: '/workspace/test.js',
    });

    await service.lint(request);

    const cmd = processPort.executedCommands[0];
    assert.ok(cmd.args.includes('--stdin'));
    assert.ok(cmd.args.includes('--stdin-filename'));
    assert.strictEqual(cmd.stdin, 'const foo = 1;');
  });

  test('should return lint messages from ESLint', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const mockMessages = [
      {
        column: 1,
        line: 1,
        message: 'Unexpected var',
        ruleId: 'no-var',
        severity: 2,
      },
    ];
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 1, // Lint errors found
        stderr: '',
        stdout: JSON.stringify([{ messages: mockMessages }]),
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.messages[0].message, 'Unexpected var');
  });

  test('should throw error when ESLint fails with exit code 2', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 2, // Config error
        stderr: 'Config file not found',
        stdout: '',
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await assert.rejects(async () => await service.lint(request), {
      message: /ESLint failed/,
    });
  });

  test('should fix file and return fixed content', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const fixedContent = 'const foo = 1;\n';
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: JSON.stringify([{ messages: [], output: fixedContent }]),
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const result = await service.fix('/workspace/test.js');

    assert.ok(result.fixedContent !== undefined);
    assert.strictEqual(result.fixedContent, fixedContent);
    assert.strictEqual(result.hasChanges, true);
  });

  test('should return null when fix has no changes', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: JSON.stringify([{ messages: [] }]),
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const result = await service.fix('/workspace/test.js');

    assert.strictEqual(result.fixedContent, null);
    assert.strictEqual(result.hasChanges, false);
  });

  test('should cache ESLint path', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    // First request
    const request1 = createLintRequest({
      content: null,
      filePath: '/workspace/test1.js',
    });
    await service.lint(request1);

    // Second request (should use cached path)
    const request2 = createLintRequest({
      content: null,
      filePath: '/workspace/test2.js',
    });
    await service.lint(request2);

    assert.strictEqual(processPort.executedCommands.length, 2);
    assert.strictEqual(
      processPort.executedCommands[0].args[1],
      processPort.executedCommands[1].args[1],
    );
  });

  test('should clear cache', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await service.lint(request);
    assert.strictEqual(service.eslintPathCached, true);

    service.clearCache();
    assert.strictEqual(service.eslintPathCached, false);
    assert.strictEqual(service.configPathCached, false);
  });

  test('should throw error when workspace is null', async () => {
    const configPort = new MockConfigPort({ workspacePath: null });
    const fileSystemPort = new MockFileSystemPort();
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await assert.rejects(async () => await service.lint(request), {
      message: /workspace/,
    });
  });

  test('should throw error when ESLint not found', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(); // No ESLint executable
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await assert.rejects(async () => await service.lint(request), {
      message: /not found/,
    });
  });

  test('should use custom executable path', async () => {
    const configPort = new MockConfigPort({ executablePath: '/custom/eslint' });
    const fileSystemPort = new MockFileSystemPort();
    const processPort = new MockProcessPort();

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await service.lint(request);

    const cmd = processPort.executedCommands[0];
    assert.strictEqual(cmd.args[1], '/custom/eslint');
  });

  test('should use custom config path when fixing', async () => {
    const configPort = new MockConfigPort({
      configPath: '/custom/.eslintrc.js',
    });
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const fixedContent = 'const foo = 1;\n';
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: JSON.stringify([{ messages: [], output: fixedContent }]),
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    await service.fix('/workspace/test.js');

    const cmd = processPort.executedCommands[0];
    assert.ok(cmd.args.includes('--config'));
    assert.ok(cmd.args.includes('/custom/.eslintrc.js'));
  });

  test('should throw error when fix fails with exit code 2', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 2,
        stderr: 'Configuration error',
        stdout: '',
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    await assert.rejects(async () => await service.fix('/workspace/test.js'), {
      message: /ESLint fix failed/,
    });
  });

  test('should handle empty stdout in parseOutput', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: '',
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.strictEqual(result.messages.length, 0);
  });

  test('should handle empty results array in parseOutput', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: '[]',
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.strictEqual(result.messages.length, 0);
  });

  test('should throw error on invalid JSON in parseOutput', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: 'invalid json{',
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    await assert.rejects(async () => await service.lint(request), {
      message: /Failed to parse ESLint output/,
    });
  });

  test('should handle null stdout in parseOutput', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: null,
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.strictEqual(result.messages.length, 0);
  });

  test('should handle non-array JSON in parseOutput', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: '{"not": "an array"}',
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.strictEqual(result.messages.length, 0);
  });

  test('should handle missing messages property in parseOutput', async () => {
    const configPort = new MockConfigPort();
    const fileSystemPort = new MockFileSystemPort(
      new Set(['/workspace/node_modules/.bin/eslint']),
    );
    const processPort = new MockProcessPort({
      [JSON.stringify({
        args: ['node', '/workspace/node_modules/.bin/eslint', '--format'],
      })]: {
        exitCode: 0,
        stderr: '',
        stdout: JSON.stringify([{}]), // Empty object, no messages property
      },
    });

    const service = new LintService({
      configPort,
      fileSystemPort,
      processPort,
    });

    const request = createLintRequest({
      content: null,
      filePath: '/workspace/test.js',
    });

    const result = await service.lint(request);

    assert.strictEqual(result.messages.length, 0);
  });
});
