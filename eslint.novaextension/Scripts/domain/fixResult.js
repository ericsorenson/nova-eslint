/**
 * Result of an ESLint fix operation
 * Contains the fixed content and whether any changes were made
 */
class FixResult {
  /**
   * @param {Object} params
   * @param {string|null} params.fixedContent - The fixed file content, or null if no fixes available
   * @param {boolean} params.hasChanges - Whether the fixed content differs from the original
   */
  constructor({ fixedContent, hasChanges }) {
    /**
     * The fixed file content from ESLint --fix-dry-run
     * @type {string|null}
     * Null when ESLint has no fixes to apply (output field not present in ESLint response)
     */
    this.fixedContent = fixedContent;

    /**
     * Whether the fixed content differs from the original file
     * @type {boolean}
     * True when fixedContent is non-null and contains actual changes
     */
    this.hasChanges = hasChanges;
  }
}

module.exports = { FixResult };
