/**
 * Parses ESLint JSON output
 * Pure utility function with no side effects
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

module.exports = { parseESLintOutput };
