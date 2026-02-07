/**
 * Result of an ESLint fix operation
 * Contains the fixed content and whether any changes were made
 *
 * @param {Object} params
 * @param {string|null} params.fixedContent - The fixed file content, or null if no fixes available
 * @param {boolean} params.hasChanges - Whether the fixed content differs from the original
 * @returns {FixResult}
 */
function createFixResult({ fixedContent, hasChanges }) {
  return {
    /**
     * The fixed file content from ESLint --fix-dry-run
     * @type {string|null}
     * Null when ESLint has no fixes to apply (output field not present in ESLint response)
     */
    fixedContent,

    /**
     * Whether the fixed content differs from the original file
     * @type {boolean}
     * True when fixedContent is non-null and contains actual changes
     */
    hasChanges,
  };
}

/**
 * @typedef {Object} FixResult
 * @property {string|null} fixedContent - The fixed file content
 * @property {boolean} hasChanges - Whether the content differs from original
 */

module.exports = { createFixResult };
