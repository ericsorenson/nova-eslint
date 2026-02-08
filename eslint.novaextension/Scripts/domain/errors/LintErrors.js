/**
 * Custom error classes for linting operations
 * These allow the domain layer to throw specific errors
 * that can be handled appropriately by the presentation layer
 */

/**
 * Thrown when ESLint executable is not found in the project
 */
class ESLintNotFoundError extends Error {
  constructor(message = 'ESLint executable not found in project') {
    super(message);
    this.name = 'ESLintNotFoundError';
  }
}

/**
 * Thrown when ESLint configuration fails (exit code 2)
 */
class ESLintConfigError extends Error {
  constructor(message = 'ESLint configuration error') {
    super(message);
    this.name = 'ESLintConfigError';
  }
}

/**
 * Thrown when workspace path is required but not available
 */
class WorkspaceError extends Error {
  constructor(message = 'Workspace path is required') {
    super(message);
    this.name = 'WorkspaceError';
  }
}

module.exports = {
  ESLintConfigError,
  ESLintNotFoundError,
  WorkspaceError,
};
