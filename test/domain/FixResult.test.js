const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  FixResult,
} = require('../../eslint.novaextension/Scripts/domain/FixResult.js');

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
