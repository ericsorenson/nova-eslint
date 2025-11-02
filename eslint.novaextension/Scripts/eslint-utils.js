/**
 * Pure utility functions for ESLint integration
 * These functions have no side effects and are easily testable
 */

/**
 * Convert ESLint messages to issue objects
 * @param {Array} messages - ESLint messages array
 * @returns {Array} Array of issue-like objects
 */
function convertESLintMessagesToIssues(messages) {
  if (!messages || !Array.isArray(messages)) {
    return [];
  }

  const issues = [];

  for (const msg of messages) {
    // Validate required fields
    if (
      typeof msg.message !== 'string' ||
      typeof msg.line !== 'number' ||
      typeof msg.column !== 'number'
    ) {
      continue;
    }

    const issue = {
      message: msg.message,
      line: msg.line,
      column: msg.column,
    };

    // Map ESLint severity to issue severity
    // ESLint: 1 = warning, 2 = error
    switch (msg.severity) {
      case 2:
        issue.severity = 'error';
        break;
      case 1:
        issue.severity = 'warning';
        break;
      default:
        issue.severity = 'info';
    }

    // Optional: add rule ID as code
    if (msg.ruleId) {
      issue.code = msg.ruleId;
    }

    // Optional: add end line/column
    if (typeof msg.endLine === 'number') {
      issue.endLine = msg.endLine;
    }
    if (typeof msg.endColumn === 'number') {
      issue.endColumn = msg.endColumn;
    }

    issues.push(issue);
  }

  return issues;
}

/**
 * Parse ESLint JSON output
 * @param {string} jsonOutput - ESLint JSON output string
 * @returns {Object|null} Parsed result or null if invalid
 */
function parseESLintOutput(jsonOutput) {
  if (!jsonOutput || typeof jsonOutput !== 'string') {
    return null;
  }

  try {
    const results = JSON.parse(jsonOutput);

    if (!Array.isArray(results) || results.length === 0) {
      return { messages: [] };
    }

    return results[0];
  } catch (_error) {
    return null;
  }
}

/**
 * Find ESLint executable from candidate paths
 * @param {Object} fs - File system interface with stat() method
 * @param {string} workspacePath - Workspace root path
 * @param {Array<string>} candidates - Candidate relative paths
 * @returns {string|null} Full path to ESLint or null
 */
function findESLintExecutable(fs, workspacePath, candidates) {
  if (!workspacePath || !Array.isArray(candidates)) {
    return null;
  }

  for (const candidate of candidates) {
    const fullPath = `${workspacePath}/${candidate}`;
    try {
      const stat = fs.stat(fullPath);
      if (stat) {
        return fullPath;
      }
    } catch {
      // File doesn't exist, try next candidate
      continue;
    }
  }

  return null;
}

module.exports = {
  convertESLintMessagesToIssues,
  parseESLintOutput,
  findESLintExecutable,
};
