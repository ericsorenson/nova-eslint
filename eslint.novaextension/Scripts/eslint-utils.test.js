/**
 * Tests for ESLint utility functions
 * Run with: node --test eslint-utils.test.js
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  convertESLintMessagesToIssues,
  parseESLintOutput,
  findESLintExecutable,
} = require('./eslint-utils.js');

describe('convertESLintMessagesToIssues', () => {
  test('should convert valid ESLint messages to issues', () => {
    const messages = [
      {
        ruleId: 'no-unused-vars',
        severity: 2,
        message: "'x' is assigned a value but never used.",
        line: 1,
        column: 5,
        nodeType: 'Identifier',
        endLine: 1,
        endColumn: 6,
      },
      {
        ruleId: 'semi',
        severity: 1,
        message: 'Missing semicolon.',
        line: 2,
        column: 10,
        nodeType: 'ExpressionStatement',
      },
    ];

    const result = convertESLintMessagesToIssues(messages);

    assert.equal(result.length, 2);

    // Check first issue (error)
    assert.equal(result[0].message, "'x' is assigned a value but never used.");
    assert.equal(result[0].line, 1);
    assert.equal(result[0].column, 5);
    assert.equal(result[0].severity, 'error');
    assert.equal(result[0].code, 'no-unused-vars');
    assert.equal(result[0].endLine, 1);
    assert.equal(result[0].endColumn, 6);

    // Check second issue (warning)
    assert.equal(result[1].message, 'Missing semicolon.');
    assert.equal(result[1].line, 2);
    assert.equal(result[1].column, 10);
    assert.equal(result[1].severity, 'warning');
    assert.equal(result[1].code, 'semi');
  });

  test('should handle empty messages array', () => {
    const result = convertESLintMessagesToIssues([]);
    assert.deepEqual(result, []);
  });

  test('should handle null/undefined messages', () => {
    assert.deepEqual(convertESLintMessagesToIssues(null), []);
    assert.deepEqual(convertESLintMessagesToIssues(undefined), []);
  });

  test('should skip messages with missing required fields', () => {
    const messages = [
      {
        // Missing line and column
        severity: 2,
        message: 'Some error',
      },
      {
        // Valid message
        severity: 2,
        message: 'Valid error',
        line: 1,
        column: 1,
      },
      {
        // Missing message
        line: 2,
        column: 1,
      },
    ];

    const result = convertESLintMessagesToIssues(messages);

    // Should only include the valid message
    assert.equal(result.length, 1);
    assert.equal(result[0].message, 'Valid error');
  });

  test('should map severities correctly', () => {
    const messages = [
      { severity: 2, message: 'Error', line: 1, column: 1 },
      { severity: 1, message: 'Warning', line: 2, column: 1 },
      { severity: 0, message: 'Info', line: 3, column: 1 },
    ];

    const result = convertESLintMessagesToIssues(messages);

    assert.equal(result[0].severity, 'error');
    assert.equal(result[1].severity, 'warning');
    assert.equal(result[2].severity, 'info');
  });

  test('should handle messages without ruleId', () => {
    const messages = [
      {
        severity: 2,
        message: 'Parsing error',
        line: 1,
        column: 1,
      },
    ];

    const result = convertESLintMessagesToIssues(messages);

    assert.equal(result.length, 1);
    assert.equal(result[0].code, undefined);
  });
});

describe('parseESLintOutput', () => {
  test('should parse valid ESLint JSON output', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/path/to/file.js',
        messages: [
          {
            ruleId: 'no-unused-vars',
            severity: 2,
            message: "'x' is assigned a value but never used.",
            line: 1,
            column: 5,
          },
        ],
        errorCount: 1,
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

describe('findESLintExecutable', () => {
  test('should find ESLint in first matching candidate', () => {
    const mockFs = {
      stat: path => {
        if (path === '/workspace/node_modules/.bin/eslint') {
          return { isFile: true };
        }
        return null;
      },
    };

    const result = findESLintExecutable(mockFs, '/workspace', [
      'node_modules/.bin/eslint',
      'node_modules/eslint/bin/eslint.js',
    ]);

    assert.equal(result, '/workspace/node_modules/.bin/eslint');
  });

  test('should try all candidates until one is found', () => {
    const mockFs = {
      stat: path => {
        if (path === '/workspace/node_modules/eslint/bin/eslint.js') {
          return { isFile: true };
        }
        return null;
      },
    };

    const result = findESLintExecutable(mockFs, '/workspace', [
      'node_modules/.bin/eslint',
      'node_modules/eslint/bin/eslint.js',
    ]);

    assert.equal(result, '/workspace/node_modules/eslint/bin/eslint.js');
  });

  test('should return null if no candidates found', () => {
    const mockFs = {
      stat: () => null,
    };

    const result = findESLintExecutable(mockFs, '/workspace', [
      'node_modules/.bin/eslint',
      'node_modules/eslint/bin/eslint.js',
    ]);

    assert.equal(result, null);
  });

  test('should handle missing workspacePath', () => {
    const mockFs = { stat: () => ({ isFile: true }) };

    assert.equal(findESLintExecutable(mockFs, null, ['test']), null);
    assert.equal(findESLintExecutable(mockFs, undefined, ['test']), null);
  });

  test('should handle invalid candidates', () => {
    const mockFs = { stat: () => ({ isFile: true }) };

    assert.equal(findESLintExecutable(mockFs, '/workspace', null), null);
    assert.equal(findESLintExecutable(mockFs, '/workspace', undefined), null);
  });
});
