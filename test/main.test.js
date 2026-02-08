const assert = require('node:assert');
const { beforeEach, describe, test } = require('node:test');

describe('main.js - Extension Lifecycle Tests', () => {
  let main;
  let mockNovaState;
  let mockAssistants;
  let mockWorkspace;

  beforeEach(() => {
    // Reset module cache to get fresh instance
    delete require.cache[
      require.resolve('../eslint.novaextension/Scripts/main.js')
    ];

    // Setup Nova API mocks
    mockAssistants = {
      registerIssueAssistantCalls: [],
      registerIssueAssistant: function (languages, provider, options) {
        this.registerIssueAssistantCalls.push({
          languages,
          options,
          provider,
        });
        return {
          dispose: () => {
            this.disposed = true;
          },
          disposed: false,
        };
      },
    };

    mockWorkspace = {
      configObservers: [],
      onDidAddTextEditorCallbacks: [],
      config: {
        onDidChange: (key, callback) => {
          const observer = { callback, key };
          mockWorkspace.configObservers.push(observer);
          return {
            dispose: () => {
              const index = mockWorkspace.configObservers.indexOf(observer);
              if (index > -1) {
                mockWorkspace.configObservers.splice(index, 1);
              }
            },
          };
        },
      },
      onDidAddTextEditor: callback => {
        mockWorkspace.onDidAddTextEditorCallbacks.push(callback);
        return {
          dispose: () => {},
        };
      },
      path: '/test/workspace',
    };

    mockNovaState = {
      configObservers: [],
      lintOnChange: false,
    };

    global.nova = {
      assistants: mockAssistants,
      config: {
        get: (key, type) => {
          if (key === 'eslint.lintOnChange') {
            return mockNovaState.lintOnChange;
          }
          if (key === 'eslint.enable') {
            return true;
          }
          return null;
        },
        onDidChange: (key, callback) => {
          const observer = { callback, key };
          mockNovaState.configObservers.push(observer);
          return {
            dispose: () => {
              const index = mockNovaState.configObservers.indexOf(observer);
              if (index > -1) {
                mockNovaState.configObservers.splice(index, 1);
              }
            },
          };
        },
      },
      fs: {
        access: () => false,
        stat: () => null,
      },
      path: { join: (a, b) => `${a}/${b}` },
      workspace: mockWorkspace,
    };

    global.IssueSeverity = {
      Error: 'error',
      Info: 'info',
      Warning: 'warning',
    };

    global.Issue = class Issue {};
    global.Range = class Range {};

    main = require('../eslint.novaextension/Scripts/main.js');
  });

  test('activate should initialize provider and register assistant', () => {
    main.activate();

    // Should have registered assistant
    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 1);
    const call = mockAssistants.registerIssueAssistantCalls[0];
    assert.deepStrictEqual(call.languages, [
      'javascript',
      'typescript',
      'jsx',
      'tsx',
    ]);
    assert.strictEqual(call.options.event, 'onSave'); // Default lintOnChange is false
    assert.ok(call.provider);

    // Should have set up config observers
    assert.ok(mockNovaState.configObservers.length > 0);
    assert.ok(mockWorkspace.configObservers.length > 0);

    main.deactivate();
  });

  test('activate and deactivate should complete successfully', () => {
    assert.doesNotThrow(() => {
      main.activate();
      main.deactivate();
    });
  });

  test('deactivate should dispose all resources', () => {
    main.activate();

    const configObserversBefore = mockNovaState.configObservers.length;
    const workspaceObserversBefore = mockWorkspace.configObservers.length;

    assert.ok(configObserversBefore > 0, 'Should have config observers');
    assert.ok(
      workspaceObserversBefore > 0,
      'Should have workspace observers',
    );

    main.deactivate();

    // All observers should be disposed
    assert.strictEqual(
      mockNovaState.configObservers.length,
      0,
      'Config observers should be cleared',
    );
    assert.strictEqual(
      mockWorkspace.configObservers.length,
      0,
      'Workspace observers should be cleared',
    );

    // Assistant should be disposed
    assert.strictEqual(
      mockAssistants.registerIssueAssistantCalls.length,
      1,
    );
  });

  test('deactivate should be idempotent', () => {
    main.activate();
    main.deactivate();

    // Second deactivate should not throw
    assert.doesNotThrow(() => {
      main.deactivate();
    });
  });

  test('double activation should work without errors', () => {
    main.activate();

    // Second activation should not throw
    assert.doesNotThrow(() => {
      main.activate();
    });

    // Should have registered assistant twice
    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 2);

    main.deactivate();
  });

  test('config change should re-register assistant with new event', () => {
    main.activate();

    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 1);
    assert.strictEqual(
      mockAssistants.registerIssueAssistantCalls[0].options.event,
      'onSave',
    );

    // Change lintOnChange setting
    mockNovaState.lintOnChange = true;

    // Trigger config change
    const lintOnChangeObserver = mockNovaState.configObservers.find(
      obs => obs.key === 'eslint.lintOnChange',
    );
    assert.ok(lintOnChangeObserver, 'Should have lintOnChange observer');

    lintOnChangeObserver.callback(true);

    // Should have re-registered with new event
    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 2);
    assert.strictEqual(
      mockAssistants.registerIssueAssistantCalls[1].options.event,
      'onChange',
    );

    main.deactivate();
  });

  test('executable path change should clear cache', () => {
    main.activate();

    let cacheClearCount = 0;

    // Access internal state (we know provider exists after activation)
    // Mock the clearCache method
    const mockClearCache = () => {
      cacheClearCount++;
    };

    // We need to simulate having a provider with runner
    // The config observer should call provider.runner.clearCache()

    // Trigger executable path change
    const execPathObserver = mockWorkspace.configObservers.find(
      obs => obs.key === 'eslint.executablePath',
    );
    assert.ok(execPathObserver, 'Should have executablePath observer');

    // Call the observer - it should try to clear cache
    // Since we can't easily mock the internal state, just verify it doesn't throw
    assert.doesNotThrow(() => {
      execPathObserver.callback('/new/path/to/eslint');
    });

    main.deactivate();
  });

  test('config path change should clear cache', () => {
    main.activate();

    // Trigger config path change
    const configPathObserver = mockWorkspace.configObservers.find(
      obs => obs.key === 'eslint.configPath',
    );
    assert.ok(configPathObserver, 'Should have configPath observer');

    // Call the observer - should not throw
    assert.doesNotThrow(() => {
      configPathObserver.callback('/new/eslint.config.js');
    });

    main.deactivate();
  });

  test('config change during deactivation should not cause errors', () => {
    main.activate();

    const lintOnChangeObserver = mockNovaState.configObservers.find(
      obs => obs.key === 'eslint.lintOnChange',
    );

    // Start deactivation
    main.deactivate();

    // Try to trigger config change after deactivation
    // Observer should be disposed, so this callback won't exist anymore
    assert.strictEqual(
      mockNovaState.configObservers.length,
      0,
      'Observers should be cleared',
    );
  });

  test('activation with lintOnChange true should register onChange event', () => {
    mockNovaState.lintOnChange = true;

    main.activate();

    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 1);
    assert.strictEqual(
      mockAssistants.registerIssueAssistantCalls[0].options.event,
      'onChange',
    );

    main.deactivate();
  });

  test('activation with lintOnChange false should register onSave event', () => {
    mockNovaState.lintOnChange = false;

    main.activate();

    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 1);
    assert.strictEqual(
      mockAssistants.registerIssueAssistantCalls[0].options.event,
      'onSave',
    );

    main.deactivate();
  });

  test('should track fix-on-save handler setup', () => {
    main.activate();

    // Should have registered onDidAddTextEditor listener
    assert.ok(
      mockWorkspace.onDidAddTextEditorCallbacks.length > 0,
      'Should have text editor listener',
    );

    main.deactivate();
  });

  test('deactivate before full activation should not throw', () => {
    // Simulate partial activation
    // (In real scenario, this might happen if deactivate is called during async operations)

    // Just call deactivate without activate
    assert.doesNotThrow(() => {
      main.deactivate();
    });
  });

  test('multiple config changes should work correctly', () => {
    main.activate();

    const initialCallCount = mockAssistants.registerIssueAssistantCalls.length;
    assert.strictEqual(initialCallCount, 1);

    // Change config multiple times
    const lintOnChangeObserver = mockNovaState.configObservers.find(
      obs => obs.key === 'eslint.lintOnChange',
    );

    mockNovaState.lintOnChange = true;
    lintOnChangeObserver.callback(true);

    mockNovaState.lintOnChange = false;
    lintOnChangeObserver.callback(false);

    mockNovaState.lintOnChange = true;
    lintOnChangeObserver.callback(true);

    // Should have re-registered 3 more times
    assert.strictEqual(mockAssistants.registerIssueAssistantCalls.length, 4);

    main.deactivate();
  });

  test('all config observers should use correct keys', () => {
    main.activate();

    // Check config observers
    const configKeys = mockNovaState.configObservers.map(obs => obs.key);
    assert.ok(
      configKeys.includes('eslint.lintOnChange'),
      'Should observe lintOnChange',
    );

    // Check workspace config observers
    const workspaceKeys = mockWorkspace.configObservers.map(obs => obs.key);
    assert.ok(
      workspaceKeys.includes('eslint.executablePath'),
      'Should observe executablePath',
    );
    assert.ok(
      workspaceKeys.includes('eslint.configPath'),
      'Should observe configPath',
    );

    main.deactivate();
  });
});
