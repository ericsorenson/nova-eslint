const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  LintResult,
} = require('../../eslint.novaextension/Scripts/domain/LintResult.js');

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
