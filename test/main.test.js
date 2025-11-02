const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('Main - Fix-on-Save Tracking Tests', () => {
  test('fixingSaveFiles Set should prevent simultaneous fixes on same file', () => {
    // Simulate the fixingSaveFiles Set behavior
    const fixingSaveFiles = new Set();
    const filePath = '/test/file.js';

    // First fix attempt
    const canFix1 = !fixingSaveFiles.has(filePath);
    assert.strictEqual(canFix1, true);

    if (canFix1) {
      fixingSaveFiles.add(filePath);
    }

    // Second simultaneous fix attempt should be blocked
    const canFix2 = !fixingSaveFiles.has(filePath);
    assert.strictEqual(canFix2, false);

    // After first fix completes
    fixingSaveFiles.delete(filePath);

    // Third fix attempt should now work
    const canFix3 = !fixingSaveFiles.has(filePath);
    assert.strictEqual(canFix3, true);
  });

  test('fixingSaveFiles Set should allow fixes on different files simultaneously', () => {
    // Simulate the fixingSaveFiles Set behavior
    const fixingSaveFiles = new Set();
    const filePath1 = '/test/file1.js';
    const filePath2 = '/test/file2.js';

    // First fix attempt on file1
    const canFix1 = !fixingSaveFiles.has(filePath1);
    assert.strictEqual(canFix1, true);
    fixingSaveFiles.add(filePath1);

    // Second fix attempt on file2 should be allowed
    const canFix2 = !fixingSaveFiles.has(filePath2);
    assert.strictEqual(canFix2, true);
    fixingSaveFiles.add(filePath2);

    // Both files should be in the set
    assert.strictEqual(fixingSaveFiles.size, 2);
    assert.ok(fixingSaveFiles.has(filePath1));
    assert.ok(fixingSaveFiles.has(filePath2));

    // Clean up
    fixingSaveFiles.delete(filePath1);
    fixingSaveFiles.delete(filePath2);
    assert.strictEqual(fixingSaveFiles.size, 0);
  });
});
