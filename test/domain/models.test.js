const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  FixResult,
} = require('../../eslint.novaextension/Scripts/domain/FixResult.js');
const {
  LintConfig,
} = require('../../eslint.novaextension/Scripts/domain/LintConfig.js');
const {
  LintRequest,
} = require('../../eslint.novaextension/Scripts/domain/LintRequest.js');
const {
  LintResult,
} = require('../../eslint.novaextension/Scripts/domain/LintResult.js');

describe('Domain - LintConfig', () => {
  test('should create config with defaults', () => {
    const config = new LintConfig();
    assert.strictEqual(config.configPath, null);
    assert.strictEqual(config.executablePath, null);
  });

  test('should create config with values', () => {
    const config = new LintConfig({
      configPath: '/.eslintrc.js',
      executablePath: '/bin/eslint',
    });
    assert.strictEqual(config.configPath, '/.eslintrc.js');
    assert.strictEqual(config.executablePath, '/bin/eslint');
  });
});

describe('Domain - LintRequest', () => {
  test('should create request with file path', () => {
    const request = new LintRequest({ content: null, filePath: '/test.js' });
    assert.strictEqual(request.filePath, '/test.js');
    assert.strictEqual(request.content, null);
  });

  test('should create request with content', () => {
    const request = new LintRequest({
      content: 'const foo = 1;',
      filePath: '/test.js',
    });
    assert.strictEqual(request.content, 'const foo = 1;');
    assert.strictEqual(request.hasContent(), true);
  });

  test('should throw error when filePath is missing', () => {
    assert.throws(() => new LintRequest({ content: null }), {
      message: /required/,
    });
  });

  test('should identify when content is present', () => {
    const withContent = new LintRequest({
      content: 'code',
      filePath: '/test.js',
    });
    const withoutContent = new LintRequest({
      content: null,
      filePath: '/test.js',
    });

    assert.strictEqual(withContent.hasContent(), true);
    assert.strictEqual(withoutContent.hasContent(), false);
  });
});

describe('Domain - LintResult', () => {
  test('should create result with messages', () => {
    const messages = [{ line: 1, message: 'Error' }];
    const result = new LintResult({ filePath: '/test.js', messages });

    assert.strictEqual(result.filePath, '/test.js');
    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.hasMessages(), true);
  });

  test('should create result with empty messages', () => {
    const result = new LintResult({ filePath: '/test.js', messages: [] });

    assert.strictEqual(result.hasMessages(), false);
  });

  test('should default messages to empty array', () => {
    const result = new LintResult({ filePath: '/test.js' });

    assert.ok(Array.isArray(result.messages));
    assert.strictEqual(result.messages.length, 0);
  });
});

describe('Domain - FixResult', () => {
  test('should create result with fixed content', () => {
    const result = new FixResult({
      fixedContent: 'fixed code',
      hasChanges: true,
    });

    assert.strictEqual(result.fixedContent, 'fixed code');
    assert.strictEqual(result.hasChanges, true);
  });

  test('should create result with no changes', () => {
    const result = new FixResult({ fixedContent: null, hasChanges: false });

    assert.strictEqual(result.fixedContent, null);
    assert.strictEqual(result.hasChanges, false);
  });
});
