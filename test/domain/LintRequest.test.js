const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  LintRequest,
} = require('../../eslint.novaextension/Scripts/domain/LintRequest.js');

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
