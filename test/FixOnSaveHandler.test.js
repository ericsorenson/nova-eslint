const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('FixOnSaveHandler - WeakMap Tracking Tests', () => {
  test('fixingEditors WeakMap should prevent simultaneous fixes on same editor', () => {
    // Simulate the fixingEditors WeakMap behavior
    const fixingEditors = new WeakMap();
    const editor1 = { document: { path: '/test/file.js' }, id: 'editor1' };

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
    const editor1 = { document: { path: '/test/file.js' }, id: 'editor1' };
    const editor2 = { document: { path: '/test/file.js' }, id: 'editor2' };

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
    const editor = { document: { path: '/test/file.js' }, id: 'editor1' };

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

describe('FixOnSaveHandler - Timeout Tracking Tests', () => {
  const {
    FixOnSaveHandler,
  } = require('../eslint.novaextension/Scripts/FixOnSaveHandler.js');

  test('startFixing should track failsafe timeout', () => {
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider);
    const editor = { document: { path: '/test/file.js' } };

    handler.startFixing(editor);

    assert.ok(handler.isFixing(editor));
    const state = handler.fixingEditors.get(editor);
    assert.ok(state);
    assert.ok(state.failsafe); // Timeout ID should exist
    assert.ok(Array.isArray(state.pending));
    assert.strictEqual(state.pending.length, 0);

    handler.stopFixing(editor);
  });

  test('stopFixing should clear all timeouts', () => {
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider);
    const editor = { document: { path: '/test/file.js' } };

    handler.startFixing(editor);

    // Add pending timeouts
    const timeout1 = setTimeout(() => {}, 1000);
    const timeout2 = setTimeout(() => {}, 1000);
    handler.addPendingTimeout(editor, timeout1);
    handler.addPendingTimeout(editor, timeout2);

    const state = handler.fixingEditors.get(editor);
    assert.strictEqual(state.pending.length, 2);

    // Stop fixing should clear everything
    handler.stopFixing(editor);

    assert.ok(!handler.isFixing(editor));
    assert.strictEqual(handler.fixingEditors.get(editor), undefined);

    // Clean up
    clearTimeout(timeout1);
    clearTimeout(timeout2);
  });

  test('addPendingTimeout should track additional timeouts', () => {
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider);
    const editor = { document: { path: '/test/file.js' } };

    handler.startFixing(editor);

    // Initially no pending timeouts
    let state = handler.fixingEditors.get(editor);
    assert.strictEqual(state.pending.length, 0);

    // Add pending timeout
    const timeout1 = setTimeout(() => {}, 1000);
    handler.addPendingTimeout(editor, timeout1);

    state = handler.fixingEditors.get(editor);
    assert.strictEqual(state.pending.length, 1);
    assert.strictEqual(state.pending[0], timeout1);

    // Add another
    const timeout2 = setTimeout(() => {}, 1000);
    handler.addPendingTimeout(editor, timeout2);

    state = handler.fixingEditors.get(editor);
    assert.strictEqual(state.pending.length, 2);

    handler.stopFixing(editor);
    clearTimeout(timeout1);
    clearTimeout(timeout2);
  });

  test('stopFixing should be safe to call multiple times', () => {
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider);
    const editor = { document: { path: '/test/file.js' } };

    handler.startFixing(editor);
    assert.ok(handler.isFixing(editor));

    // First stop
    handler.stopFixing(editor);
    assert.ok(!handler.isFixing(editor));

    // Second stop should not throw
    assert.doesNotThrow(() => {
      handler.stopFixing(editor);
    });

    assert.ok(!handler.isFixing(editor));
  });

  test('addPendingTimeout should handle editor not in fixing state', () => {
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider);
    const editor = { document: { path: '/test/file.js' } };

    // Try to add timeout without starting fix
    const timeout = setTimeout(() => {}, 1000);

    // Should not throw
    assert.doesNotThrow(() => {
      handler.addPendingTimeout(editor, timeout);
    });

    clearTimeout(timeout);
  });
});
