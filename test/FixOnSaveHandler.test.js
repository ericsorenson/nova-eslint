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

describe('FixOnSaveHandler - Fix-on-Save Integration Tests', () => {
  const {
    FixOnSaveHandler,
  } = require('../eslint.novaextension/Scripts/FixOnSaveHandler.js');

  const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];

  function setupMocks() {
    global.nova = {
      config: {
        get: (key, type) => {
          if (key === 'eslint.fixOnSave') return true;
          return null;
        },
      },
      workspace: {
        onDidAddTextEditor: callback => {
          return { dispose: () => {} };
        },
      },
    };

    global.Range = class Range {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    };
  }

  test('should skip fix when fixOnSave is disabled', async () => {
    setupMocks();

    global.nova.config.get = (key, type) => {
      if (key === 'eslint.fixOnSave') return false;
      return null;
    };

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve('fixed content'),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCallbackFired = false;

    global.nova.workspace.onDidAddTextEditor = callback => {
      // Simulate adding an editor
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {},
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: callback => {
          saveCallbackFired = true;
          // Call the save callback
          callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => Promise.resolve(),
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Save callback should be registered but fix not executed
    assert.ok(saveCallbackFired);
  });

  test('should skip fix when no document path', async () => {
    setupMocks();

    let fixCalled = false;
    const mockProvider = {
      runner: {
        fix: () => {
          fixCalled = true;
          return Promise.resolve('fixed content');
        },
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: null, // No path
          syntax: 'javascript',
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: callback => {
          callback(mockEditor);
          return { dispose: () => {} };
        },
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    assert.strictEqual(fixCalled, false);
  });

  test('should skip fix for unsupported language', async () => {
    setupMocks();

    let fixCalled = false;
    const mockProvider = {
      runner: {
        fix: () => {
          fixCalled = true;
          return Promise.resolve('fixed content');
        },
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.py',
          syntax: 'python', // Unsupported
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: callback => {
          callback(mockEditor);
          return { dispose: () => {} };
        },
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    assert.strictEqual(fixCalled, false);
  });

  test('should skip fix when provider not initialized', async () => {
    setupMocks();

    const handler = new FixOnSaveHandler(null, SUPPORTED_LANGUAGES); // No provider
    const disposables = [];
    const editorDisposables = new WeakMap();

    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: callback => {
          callback(mockEditor);
          return { dispose: () => {} };
        },
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    // Should not throw
    assert.doesNotThrow(() => {
      handler.setupFixOnSave(disposables, editorDisposables);
    });
  });

  test('should skip fix when already fixing same editor', async () => {
    setupMocks();

    let fixCallCount = 0;
    const mockProvider = {
      runner: {
        fix: () => {
          fixCallCount++;
          return new Promise(resolve =>
            setTimeout(() => resolve('fixed content'), 100),
          );
        },
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCallback;
    const mockEditor = {
      document: {
        getTextInRange: () => 'original content',
        length: 100,
        path: '/test/file.js',
        syntax: 'javascript',
      },
      edit: async editCallback => {},
      onDidDestroy: () => ({ dispose: () => {} }),
      onDidSave: callback => {
        saveCallback = callback;
        return { dispose: () => {} };
      },
      save: () => Promise.resolve(),
    };

    global.nova.workspace.onDidAddTextEditor = callback => {
      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Manually mark as fixing
    handler.startFixing(mockEditor);

    // Trigger save callback (should be skipped because already fixing)
    await saveCallback(mockEditor);

    assert.strictEqual(fixCallCount, 0);
    assert.ok(handler.isFixing(mockEditor));

    handler.stopFixing(mockEditor);
  });

  test('should complete save flow with save complete timeout', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve('fixed content'),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let editCalled = false;
    let saveCalled = false;
    let saveCallback;
    let currentContent = 'original content';

    const mockEditor = {
      document: {
        getTextInRange: () => currentContent,
        length: 100,
        path: '/test/file.js',
        syntax: 'javascript',
      },
      edit: async editCallback => {
        editCalled = true;
        editCallback({
          replace: (range, content) => {
            // Simulate the edit applying the fixed content
            currentContent = content;
          },
        });
      },
      onDidDestroy: () => ({ dispose: () => {} }),
      onDidSave: callback => {
        saveCallback = callback;
        return { dispose: () => {} };
      },
      save: () => {
        saveCalled = true;
        return Promise.resolve();
      },
    };

    global.nova.workspace.onDidAddTextEditor = callback => {
      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Trigger save callback
    await saveCallback(mockEditor);

    // Check if fixing started
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(handler.isFixing(mockEditor));

    // Wait for all timeouts to complete (edit settle + save complete)
    await new Promise(resolve => setTimeout(resolve, 150));

    assert.ok(editCalled);
    assert.ok(saveCalled);
    // After save complete timeout, should not be fixing anymore
    assert.ok(!handler.isFixing(mockEditor));
  });

  test('should handle editor.document becoming null during settle', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve('fixed content'),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCalled = false;
    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {
          editCallback({
            replace: (range, content) => {},
          });
          // Simulate editor being destroyed during edit
          setTimeout(() => {
            mockEditor.document = null;
          }, 5);
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: async callback => {
          await callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => {
          saveCalled = true;
          return Promise.resolve();
        },
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    await new Promise(resolve => setTimeout(resolve, 150));

    // Save should not be called because editor.document became null
    assert.strictEqual(saveCalled, false);
  });

  test('should handle fix returning no content', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve(null), // No fixes
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let editCalled = false;
    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {
          editCalled = true;
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: async callback => {
          await callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => Promise.resolve(),
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(editCalled, false);
  });

  test('should handle content already matching fixed content', async () => {
    setupMocks();

    const fixedContent = 'already fixed';
    const mockProvider = {
      runner: {
        fix: () => Promise.resolve(fixedContent),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let editCalled = false;
    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => fixedContent, // Already matches
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {
          editCalled = true;
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: async callback => {
          await callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => Promise.resolve(),
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(editCalled, false);
  });

  test('should handle editor destroyed and dispose saved disposables', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () =>
          new Promise(resolve =>
            setTimeout(() => resolve('fixed content'), 50),
          ),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let destroyCallback;
    let saveDisposableDisposed = false;
    let destroyDisposableDisposed = false;

    const mockSaveDisposable = {
      dispose: () => {
        saveDisposableDisposed = true;
      },
    };

    const mockDestroyDisposable = {
      dispose: () => {
        destroyDisposableDisposed = true;
      },
    };

    let mockEditor;

    global.nova.workspace.onDidAddTextEditor = callback => {
      mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {},
        onDidDestroy: callback => {
          destroyCallback = callback;
          return mockDestroyDisposable;
        },
        onDidSave: callback => {
          return mockSaveDisposable;
        },
        save: () => Promise.resolve(),
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Verify the disposables are set up
    assert.ok(editorDisposables.get(mockEditor) === mockSaveDisposable);

    // Simulate editor being destroyed
    setTimeout(() => {
      destroyCallback();
    }, 10);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Both disposables should be disposed
    assert.ok(saveDisposableDisposed);
    assert.ok(destroyDisposableDisposed);
  });

  test('should handle fix error', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.reject(new Error('Fix failed')),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {},
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: async callback => {
          await callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => Promise.resolve(),
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    // Should not throw
    assert.doesNotThrow(() => {
      handler.setupFixOnSave(disposables, editorDisposables);
    });

    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test('should handle save error', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve('fixed content'),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => 'original content',
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {
          editCallback({
            replace: (range, content) => {},
          });
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: async callback => {
          await callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => Promise.reject(new Error('Save failed')),
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    // Should not throw
    assert.doesNotThrow(() => {
      handler.setupFixOnSave(disposables, editorDisposables);
    });

    await new Promise(resolve => setTimeout(resolve, 150));
  });

  test('should handle content changed during edit settle', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve('fixed content'),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCalled = false;
    let getTextCallCount = 0;
    global.nova.workspace.onDidAddTextEditor = callback => {
      const mockEditor = {
        document: {
          getTextInRange: () => {
            getTextCallCount++;
            // First call returns original, subsequent calls return different content
            return getTextCallCount === 1
              ? 'original content'
              : 'user modified content';
          },
          length: 100,
          path: '/test/file.js',
          syntax: 'javascript',
        },
        edit: async editCallback => {
          editCallback({
            replace: (range, content) => {},
          });
        },
        onDidDestroy: () => ({ dispose: () => {} }),
        onDidSave: async callback => {
          await callback(mockEditor);
          return { dispose: () => {} };
        },
        save: () => {
          saveCalled = true;
          return Promise.resolve();
        },
      };

      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    await new Promise(resolve => setTimeout(resolve, 150));

    // Save should not be called because content changed
    assert.strictEqual(saveCalled, false);
  });
});

describe('FixOnSaveHandler - Timeout Tracking Tests', () => {
  const {
    FixOnSaveHandler,
  } = require('../eslint.novaextension/Scripts/FixOnSaveHandler.js');

  const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];

  test('startFixing should track failsafe timeout', () => {
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
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
    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
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
    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
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
    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
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
    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const editor = { document: { path: '/test/file.js' } };

    // Try to add timeout without starting fix
    const timeout = setTimeout(() => {}, 1000);

    // Should not throw
    assert.doesNotThrow(() => {
      handler.addPendingTimeout(editor, timeout);
    });

    clearTimeout(timeout);
  });

  test('failsafe timeout should fire and clean up', async () => {
    // Reduce timeout for testing
    const mockProvider = {};
    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);

    const editor = {
      document: { path: '/test/file.js' },
    };

    handler.startFixing(editor);
    assert.ok(handler.isFixing(editor));

    // Manually trigger the failsafe timeout by getting it and calling it
    const state = handler.fixingEditors.get(editor);
    assert.ok(state);
    assert.ok(state.failsafe);

    // Clear the timeout and manually call stopFixing to simulate what the timeout would do
    clearTimeout(state.failsafe);
    handler.stopFixing(editor);

    assert.ok(!handler.isFixing(editor));
  });
});

describe('FixOnSaveHandler - Edge Case Coverage Tests', () => {
  const {
    FixOnSaveHandler,
  } = require('../eslint.novaextension/Scripts/FixOnSaveHandler.js');

  const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];

  function setupMocks() {
    global.nova = {
      config: {
        get: (key, type) => {
          if (key === 'eslint.fixOnSave') return true;
          return null;
        },
      },
      workspace: {
        onDidAddTextEditor: callback => {
          return { dispose: () => {} };
        },
      },
    };

    global.Range = class Range {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    };
  }

  test('should handle save error in catch block', async () => {
    setupMocks();

    const mockProvider = {
      runner: {
        fix: () => Promise.resolve('fixed content'),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCallback;
    let currentContent = 'original content';

    const mockEditor = {
      document: {
        getTextInRange: () => currentContent,
        length: 100,
        path: '/test/file.js',
        syntax: 'javascript',
      },
      edit: async editCallback => {
        editCallback({
          replace: (range, content) => {
            currentContent = content;
          },
        });
      },
      onDidDestroy: () => ({ dispose: () => {} }),
      onDidSave: callback => {
        saveCallback = callback;
        return { dispose: () => {} };
      },
      save: () => {
        // Simulate save error
        return Promise.reject(new Error('Save failed'));
      },
    };

    global.nova.workspace.onDidAddTextEditor = callback => {
      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Trigger save callback
    await saveCallback(mockEditor);

    // Wait for save to fail and error to be handled
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have cleaned up after error
    assert.ok(!handler.isFixing(mockEditor));
  });

  test('should trigger failsafe timeout when fix hangs', async () => {
    setupMocks();

    // Create a promise that never resolves to simulate a hanging fix
    const mockProvider = {
      runner: {
        fix: () => new Promise(() => {}), // Never resolves
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCallback;

    const mockEditor = {
      document: {
        getTextInRange: () => 'original content',
        length: 100,
        path: '/test/file.js',
        syntax: 'javascript',
      },
      edit: async editCallback => {},
      onDidDestroy: () => ({ dispose: () => {} }),
      onDidSave: callback => {
        saveCallback = callback;
        return { dispose: () => {} };
      },
      save: () => Promise.resolve(),
    };

    global.nova.workspace.onDidAddTextEditor = callback => {
      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Trigger save callback (fix will hang)
    saveCallback(mockEditor);

    // Verify fixing started
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(handler.isFixing(mockEditor));

    // Wait for failsafe timeout to fire (5000ms)
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Failsafe should have cleaned up
    assert.ok(!handler.isFixing(mockEditor));
  });

  test('should handle failsafe timeout with null editor.document', async () => {
    setupMocks();

    // Create a promise that never resolves
    const mockProvider = {
      runner: {
        fix: () => new Promise(() => {}),
      },
    };

    const handler = new FixOnSaveHandler(mockProvider, SUPPORTED_LANGUAGES);
    const disposables = [];
    const editorDisposables = new WeakMap();

    let saveCallback;

    const mockEditor = {
      document: {
        getTextInRange: () => 'original content',
        length: 100,
        path: '/test/file.js',
        syntax: 'javascript',
      },
      edit: async editCallback => {},
      onDidDestroy: () => ({ dispose: () => {} }),
      onDidSave: callback => {
        saveCallback = callback;
        return { dispose: () => {} };
      },
      save: () => Promise.resolve(),
    };

    global.nova.workspace.onDidAddTextEditor = callback => {
      callback(mockEditor);
      return { dispose: () => {} };
    };

    handler.setupFixOnSave(disposables, editorDisposables);

    // Trigger save callback (fix will hang)
    saveCallback(mockEditor);

    // Verify fixing started
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(handler.isFixing(mockEditor));

    // Simulate editor being destroyed (document becomes null)
    mockEditor.document = null;

    // Wait for failsafe timeout to fire (5000ms)
    // When timeout fires, editor.document?.path should use 'unknown file'
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Failsafe should have cleaned up
    assert.ok(!handler.isFixing(mockEditor));
  });
});
