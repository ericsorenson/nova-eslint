const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  createFixResult,
} = require('../../eslint.novaextension/Scripts/domain/FixResult.js');

describe('Domain - FixResult', () => {
  test('should create result with fixed content', () => {
    const result = createFixResult({
      fixedContent: 'fixed code',
      hasChanges: true,
    });

    assert.strictEqual(result.fixedContent, 'fixed code');
    assert.strictEqual(result.hasChanges, true);
  });

  test('should create result with no changes', () => {
    const result = createFixResult({ fixedContent: null, hasChanges: false });

    assert.strictEqual(result.fixedContent, null);
    assert.strictEqual(result.hasChanges, false);
  });
});
