/**
 * Tests for parseESLintOutput utility function
 */

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  parseESLintOutput,
} = require('../../eslint.novaextension/Scripts/utils/parseESLintOutput.js');

describe('parseESLintOutput', () => {
  test('should parse valid ESLint JSON output', () => {
    const jsonOutput = JSON.stringify([
      {
        errorCount: 1,
        filePath: '/path/to/file.js',
        messages: [
          {
            column: 5,
            line: 1,
            message: "'x' is assigned a value but never used.",
            ruleId: 'no-unused-vars',
            severity: 2,
          },
        ],
        warningCount: 0,
      },
    ]);

    const result = parseESLintOutput(jsonOutput);

    assert.ok(result);
    assert.equal(result.filePath, '/path/to/file.js');
    assert.equal(result.messages.length, 1);
    assert.equal(result.errorCount, 1);
  });

  test('should return empty messages for empty array', () => {
    const jsonOutput = '[]';
    const result = parseESLintOutput(jsonOutput);

    assert.deepEqual(result, { messages: [] });
  });

  test('should return null for invalid JSON', () => {
    const result = parseESLintOutput('not valid json');
    assert.equal(result, null);
  });

  test('should return null for null/undefined input', () => {
    assert.equal(parseESLintOutput(null), null);
    assert.equal(parseESLintOutput(undefined), null);
    assert.equal(parseESLintOutput(''), null);
  });

  test('should handle non-array JSON', () => {
    const jsonOutput = '{"error": "something"}';
    const result = parseESLintOutput(jsonOutput);

    // Should return null or empty messages for non-array
    assert.deepEqual(result, { messages: [] });
  });
});
