/**
 * Converts ESLint messages to Nova Issue objects
 * Pure utility function with no side effects
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
      column: msg.column,
      line: msg.line,
      message: msg.message,
    };

    // Map ESLint severity to issue severity (see https://eslint.org/docs/latest/use/formatters/)
    // ESLint uses numeric codes: 0=off, 1=warn, 2=error
    switch (msg.severity) {
      case 1:
        issue.severity = 'warning';
        break;
      case 2:
        issue.severity = 'error';
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

module.exports = { convertESLintMessagesToIssues };
