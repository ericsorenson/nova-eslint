const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  createLintRequest,
} = require('../../../eslint.novaextension/Scripts/domain/models/LintRequest.js');

describe('Domain - LintRequest', () => {
  test('should create request with file path', () => {
    const request = createLintRequest({ content: null, filePath: '/test.js' });
    assert.strictEqual(request.filePath, '/test.js');
    assert.strictEqual(request.content, null);
  });

  test('should create request with content', () => {
    const request = createLintRequest({
      content: 'const foo = 1;',
      filePath: '/test.js',
    });
    assert.strictEqual(request.content, 'const foo = 1;');
    assert.strictEqual(request.hasContent(), true);
  });

  test('should throw error when filePath is missing', () => {
    assert.throws(() => createLintRequest({ content: null }), {
      message: /required/,
    });
  });

  test('should identify when content is present', () => {
    const withContent = createLintRequest({
      content: 'code',
      filePath: '/test.js',
    });
    const withoutContent = createLintRequest({
      content: null,
      filePath: '/test.js',
    });

    assert.strictEqual(withContent.hasContent(), true);
    assert.strictEqual(withoutContent.hasContent(), false);
  });
});
