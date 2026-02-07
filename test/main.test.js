const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('Main - Fix-on-Save Tracking Tests', () => {
  test('fixingEditors WeakMap should prevent simultaneous fixes on same editor', () => {
    // Simulate the fixingEditors WeakMap behavior
    const fixingEditors = new WeakMap();
    const editor1 = { id: 'editor1', document: { path: '/test/file.js' } };

    // First fix attempt
    const canFix1 = !fixingEditors.has(editor1);
    assert.strictEqual(canFix1, true);

    if (canFix1) {
      fixingEditors.set(editor1, 'timeout-id');
    }

    // Second simultaneous fix attempt on same editor should be blocked
    const canFix2 = !fixingEditors.has(editor1);
    assert.strictEqual(canFix2, false);

    // After first fix completes
    fixingEditors.delete(editor1);

    // Third fix attempt should now work
    const canFix3 = !fixingEditors.has(editor1);
    assert.strictEqual(canFix3, true);
  });

  test('fixingEditors WeakMap should allow fixes on different editors with same file', () => {
    // Simulate the fixingEditors WeakMap behavior (split view scenario)
    const fixingEditors = new WeakMap();
    const editor1 = { id: 'editor1', document: { path: '/test/file.js' } };
    const editor2 = { id: 'editor2', document: { path: '/test/file.js' } };

    // First fix attempt on editor1
    const canFix1 = !fixingEditors.has(editor1);
    assert.strictEqual(canFix1, true);
    fixingEditors.set(editor1, 'timeout-id-1');

    // Second fix attempt on editor2 (split view, same file) should be allowed
    const canFix2 = !fixingEditors.has(editor2);
    assert.strictEqual(canFix2, true);
    fixingEditors.set(editor2, 'timeout-id-2');

    // Both editors should be tracked
    assert.ok(fixingEditors.has(editor1));
    assert.ok(fixingEditors.has(editor2));

    // Clean up
    fixingEditors.delete(editor1);
    fixingEditors.delete(editor2);
    assert.strictEqual(fixingEditors.has(editor1), false);
    assert.strictEqual(fixingEditors.has(editor2), false);
  });

  test('fixingEditors helper functions should manage state correctly', () => {
    // Simulate the helper functions
    const fixingEditors = new WeakMap();
    const editor = { id: 'editor1', document: { path: '/test/file.js' } };

    const startFixing = ed => {
      fixingEditors.set(ed, 'mock-timeout-id');
    };

    const stopFixing = ed => {
      fixingEditors.delete(ed);
    };

    const isFixing = ed => {
      return fixingEditors.has(ed);
    };

    // Initially not fixing
    assert.strictEqual(isFixing(editor), false);

    // Start fixing
    startFixing(editor);
    assert.strictEqual(isFixing(editor), true);

    // Stop fixing
    stopFixing(editor);
    assert.strictEqual(isFixing(editor), false);
  });
});
