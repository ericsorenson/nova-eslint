const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  ESLintConfigError,
  ESLintNotFoundError,
  WorkspaceError,
} = require('../../../eslint.novaextension/Scripts/domain/errors/LintErrors.js');

describe('Domain - LintErrors', () => {
  test('ESLintNotFoundError should have correct name and message', () => {
    const error = new ESLintNotFoundError();

    assert.strictEqual(error.name, 'ESLintNotFoundError');
    assert.strictEqual(
      error.message,
      'ESLint executable not found in project',
    );
    assert.ok(error instanceof Error);
    assert.ok(error instanceof ESLintNotFoundError);
  });

  test('ESLintNotFoundError should accept custom message', () => {
    const customMessage = 'Custom not found message';
    const error = new ESLintNotFoundError(customMessage);

    assert.strictEqual(error.message, customMessage);
    assert.strictEqual(error.name, 'ESLintNotFoundError');
  });

  test('ESLintConfigError should have correct name and message', () => {
    const error = new ESLintConfigError();

    assert.strictEqual(error.name, 'ESLintConfigError');
    assert.strictEqual(error.message, 'ESLint configuration error');
    assert.ok(error instanceof Error);
    assert.ok(error instanceof ESLintConfigError);
  });

  test('ESLintConfigError should accept custom message', () => {
    const customMessage = 'Invalid config file';
    const error = new ESLintConfigError(customMessage);

    assert.strictEqual(error.message, customMessage);
    assert.strictEqual(error.name, 'ESLintConfigError');
  });

  test('WorkspaceError should have correct name and message', () => {
    const error = new WorkspaceError();

    assert.strictEqual(error.name, 'WorkspaceError');
    assert.strictEqual(error.message, 'Workspace path is required');
    assert.ok(error instanceof Error);
    assert.ok(error instanceof WorkspaceError);
  });

  test('WorkspaceError should accept custom message', () => {
    const customMessage = 'Workspace not open';
    const error = new WorkspaceError(customMessage);

    assert.strictEqual(error.message, customMessage);
    assert.strictEqual(error.name, 'WorkspaceError');
  });

  test('Error types should be distinguishable with instanceof', () => {
    const notFoundError = new ESLintNotFoundError();
    const configError = new ESLintConfigError();
    const workspaceError = new WorkspaceError();

    assert.ok(notFoundError instanceof ESLintNotFoundError);
    assert.ok(!(notFoundError instanceof ESLintConfigError));
    assert.ok(!(notFoundError instanceof WorkspaceError));

    assert.ok(configError instanceof ESLintConfigError);
    assert.ok(!(configError instanceof ESLintNotFoundError));
    assert.ok(!(configError instanceof WorkspaceError));

    assert.ok(workspaceError instanceof WorkspaceError);
    assert.ok(!(workspaceError instanceof ESLintNotFoundError));
    assert.ok(!(workspaceError instanceof ESLintConfigError));
  });
});
