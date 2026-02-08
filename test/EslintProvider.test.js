const assert = require('node:assert');
const { describe, test } = require('node:test');

describe('ESLintProvider - Bug Fix Tests', () => {
  // Setup mock globals
  function setupMocks() {
    global.nova = {
      config: { get: () => true },
      fs: {
        access: () => false,
        stat: () => null,
      },
      path: { join: (a, b) => `${a}/${b}` },
      workspace: { path: '/test' },
    };

    global.IssueSeverity = {
      Error: 'error',
      Info: 'info',
      Warning: 'warning',
    };

    global.Issue = class Issue {
      constructor() {
        this.message = '';
        this.line = 0;
        this.column = 0;
        this.severity = '';
        this.source = '';
      }
    };

    global.Range = class Range {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    };

    global.NotificationRequest = class NotificationRequest {
      constructor(id) {
        this.id = id;
        this.title = '';
        this.body = '';
        this.actions = [];
      }
    };
  }

  test('activeLints should be cleared on dispose', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    // Add some URIs to activeLints
    provider.activeLints.add('file://test1.js');
    provider.activeLints.add('file://test2.js');
    assert.strictEqual(provider.activeLints.size, 2);

    // Dispose should clear it
    provider.dispose();
    assert.strictEqual(provider.activeLints.size, 0);
  });

  test('pendingResolvers should be called and cleared on dispose', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    let resolver1Called = false;
    let resolver2Called = false;
    let resolver1Result = null;
    let resolver2Result = null;

    const resolver1 = result => {
      resolver1Called = true;
      resolver1Result = result;
    };

    const resolver2 = result => {
      resolver2Called = true;
      resolver2Result = result;
    };

    // Add resolvers
    provider.pendingResolvers.set('file://test1.js', resolver1);
    provider.pendingResolvers.set('file://test2.js', resolver2);

    assert.strictEqual(provider.pendingResolvers.size, 2);

    // Dispose should call all resolvers with []
    provider.dispose();

    assert.ok(resolver1Called);
    assert.ok(resolver2Called);
    assert.deepStrictEqual(resolver1Result, []);
    assert.deepStrictEqual(resolver2Result, []);
    assert.strictEqual(provider.pendingResolvers.size, 0);
  });

  test('pendingLints timeouts should be cleared on dispose', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    // Create fake timeouts
    const timeout1 = setTimeout(() => {}, 10000);
    const timeout2 = setTimeout(() => {}, 10000);

    // Track timeouts
    provider.pendingTimeouts.add(timeout1);
    provider.pendingTimeouts.add(timeout2);

    assert.strictEqual(provider.pendingTimeouts.size, 2);

    // Dispose should clear timeouts
    provider.dispose();
    assert.strictEqual(provider.pendingTimeouts.size, 0);

    // Timeouts should be cleared
    clearTimeout(timeout1);
    clearTimeout(timeout2);
  });

  test('pendingResolvers Map should be initialized', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    assert.ok(provider.pendingResolvers instanceof Map);
    assert.strictEqual(provider.pendingResolvers.size, 0);
  });

  test('runner.dispose should be called on provider dispose', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    let runnerDisposeCalled = false;
    provider.runner.dispose = () => {
      runnerDisposeCalled = true;
    };

    provider.dispose();
    assert.ok(runnerDisposeCalled);
  });
});

describe('ESLintProvider - handleError() Tests', () => {
  function setupMocks() {
    global.nova = {
      config: { get: () => true },
      fs: {
        access: () => false,
        stat: () => null,
      },
      notifications: {
        add: () => {},
      },
      path: { join: (a, b) => `${a}/${b}` },
      workspace: { path: '/test' },
    };

    global.IssueSeverity = {
      Error: 'error',
      Info: 'info',
      Warning: 'warning',
    };

    global.Issue = class Issue {};
    global.Range = class Range {};
    global.NotificationRequest = class NotificationRequest {
      constructor(id) {
        this.id = id;
        this.title = '';
        this.body = '';
        this.actions = [];
      }
    };
  }

  test('should show notification for "not found" error', () => {
    setupMocks();
    let notificationAdded = null;

    global.nova.notifications.add = request => {
      notificationAdded = request;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found in project');
    provider.handleError(error, '/test');

    assert.ok(notificationAdded);
    assert.strictEqual(notificationAdded.id, 'eslint-not-found');
    assert.strictEqual(notificationAdded.title, 'ESLint Not Found');
    assert.ok(notificationAdded.body.includes('npm install'));

    // Check Map structure: workspace path -> Set of notification IDs
    assert.ok(provider.shownNotifications.has('/test'));
    assert.ok(provider.shownNotifications.get('/test').has('eslint-not-found'));
  });

  test('should show notification for "failed" config error', () => {
    setupMocks();
    let notificationAdded = null;

    global.nova.notifications.add = request => {
      notificationAdded = request;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint failed (exit 2): Configuration error');
    provider.handleError(error, '/test');

    assert.ok(notificationAdded);
    assert.strictEqual(notificationAdded.id, 'eslint-config-error');
    assert.strictEqual(notificationAdded.title, 'ESLint Configuration Error');

    // Check Map structure
    assert.ok(provider.shownNotifications.has('/test'));
    assert.ok(provider.shownNotifications.get('/test').has('eslint-config-error'));
  });

  test('should not show duplicate notifications', () => {
    setupMocks();
    let notificationCount = 0;

    global.nova.notifications.add = () => {
      notificationCount++;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found');

    provider.handleError(error, '/test');
    assert.strictEqual(notificationCount, 1);

    // Second call should not show notification
    provider.handleError(error, '/test');
    assert.strictEqual(notificationCount, 1);
  });

  test('should re-show notifications after successful lint clears tracking', () => {
    setupMocks();
    let notificationCount = 0;

    global.nova.notifications.add = () => {
      notificationCount++;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found');

    // First error shows notification
    provider.handleError(error, '/test');
    assert.strictEqual(notificationCount, 1);

    // Simulate successful lint for this workspace (would happen in provideIssues)
    provider.shownNotifications.delete('/test');

    // New error should show notification again
    provider.handleError(error, '/test');
    assert.strictEqual(notificationCount, 2);
  });

  test('should track notifications per workspace independently', () => {
    setupMocks();
    let notificationCount = 0;

    global.nova.notifications.add = () => {
      notificationCount++;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found');

    // Workspace A has error - shows notification
    provider.handleError(error, '/workspace-a');
    assert.strictEqual(notificationCount, 1);

    // Workspace B also has error - shows separate notification
    provider.handleError(error, '/workspace-b');
    assert.strictEqual(notificationCount, 2);

    // Workspace A succeeds - clears only A's tracking
    provider.shownNotifications.delete('/workspace-a');

    // Workspace B still fails - should NOT show notification again (already shown)
    provider.handleError(error, '/workspace-b');
    assert.strictEqual(notificationCount, 2);

    // But A can fail again and show notification
    provider.handleError(error, '/workspace-a');
    assert.strictEqual(notificationCount, 3);
  });

  test('should handle split view - independent debouncing per editor', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const sharedUri = 'file://test/file.js';

    // Two editors viewing the same file (split view)
    const editor1 = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: sharedUri,
      },
    };

    const editor2 = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: sharedUri,
      },
    };

    // Mock runner
    provider.runner.lint = () => Promise.resolve({ messages: [] });

    // Start lint in editor1
    provider.provideIssues(editor1);

    // Start lint in editor2 immediately (should NOT cancel editor1's debounce)
    provider.provideIssues(editor2);

    // Both should have separate pending timeouts (independent debouncing)
    assert.strictEqual(provider.pendingTimeouts.size, 2);

    // Both editors have their own pending lint data
    const pending1 = provider.pendingLints.get(editor1);
    const pending2 = provider.pendingLints.get(editor2);

    assert.ok(pending1);
    assert.ok(pending2);
    assert.notStrictEqual(pending1.requestId, pending2.requestId);

    // Clean up
    provider.dispose();
  });

  test('should handle split view - typing in one editor does not cancel other', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const sharedUri = 'file://test/file.js';

    const editor1 = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: sharedUri,
      },
    };

    const editor2 = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: sharedUri,
      },
    };

    provider.runner.lint = () => Promise.resolve({ messages: [] });

    // User types in editor1
    provider.provideIssues(editor1);
    const requestId1 = provider.pendingLints.get(editor1).requestId;

    // User types in editor2 (should not affect editor1)
    provider.provideIssues(editor2);

    // Editor1's request should still be pending
    const pending1 = provider.pendingLints.get(editor1);
    assert.ok(pending1);
    assert.strictEqual(pending1.requestId, requestId1);

    provider.dispose();
  });
});

describe('ESLintProvider - convertToIssues() Tests', () => {
  function setupMocks() {
    global.nova = {
      config: { get: () => true },
      fs: {
        access: () => false,
        stat: () => null,
      },
      path: { join: (a, b) => `${a}/${b}` },
      workspace: { path: '/test' },
    };

    global.IssueSeverity = {
      Error: 'error',
      Info: 'info',
      Warning: 'warning',
    };

    global.Issue = class Issue {
      constructor() {
        this.message = '';
        this.line = 0;
        this.column = 0;
        this.severity = '';
        this.source = '';
      }
    };

    global.Range = class Range {};
    global.NotificationRequest = class NotificationRequest {};
  }

  test('should create Issue objects with correct properties', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const result = {
      messages: [
        {
          column: 5,
          endColumn: 10,
          endLine: 2,
          line: 1,
          message: 'Unused variable',
          ruleId: 'no-unused-vars',
          severity: 2,
        },
      ],
    };

    const issues = provider.convertToIssues(result);

    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].message, 'Unused variable');
    assert.strictEqual(issues[0].line, 1);
    assert.strictEqual(issues[0].column, 5);
    assert.strictEqual(issues[0].severity, 'error');
    assert.strictEqual(issues[0].code, 'no-unused-vars');
    assert.strictEqual(issues[0].source, 'ESLint');
    assert.strictEqual(issues[0].endLine, 2);
    assert.strictEqual(issues[0].endColumn, 10);
  });

  test('should handle empty or null results gracefully', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    assert.deepStrictEqual(provider.convertToIssues(null), []);
    assert.deepStrictEqual(provider.convertToIssues(undefined), []);
    assert.deepStrictEqual(provider.convertToIssues({}), []);
    assert.deepStrictEqual(provider.convertToIssues({ messages: null }), []);
    assert.deepStrictEqual(provider.convertToIssues({ messages: undefined }), []);
    assert.deepStrictEqual(provider.convertToIssues({ messages: [] }), []);
  });

  test('should create Issue without optional properties', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const result = {
      messages: [
        {
          column: 5,
          line: 1,
          message: 'Warning message',
          ruleId: 'some-rule',
          severity: 1,
          // No code, endLine, or endColumn
        },
      ],
    };

    const issues = provider.convertToIssues(result);

    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].message, 'Warning message');
    assert.strictEqual(issues[0].code, 'some-rule'); // Uses ruleId as fallback
    assert.strictEqual(issues[0].endLine, undefined);
    assert.strictEqual(issues[0].endColumn, undefined);
  });

  test('should not set optional properties when they are falsy', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const result = {
      messages: [
        {
          code: '', // Empty string is falsy
          column: 5,
          endColumn: 0, // 0 is falsy
          endLine: 0, // 0 is falsy
          line: 1,
          message: 'Test message',
          severity: 'info',
        },
      ],
    };

    const issues = provider.convertToIssues(result);

    assert.strictEqual(issues.length, 1);
    // Falsy values should not be set
    assert.strictEqual(issues[0].code, undefined);
    assert.strictEqual(issues[0].endLine, undefined);
    assert.strictEqual(issues[0].endColumn, undefined);
  });

});

describe('ESLintProvider - Debounce Behavior Tests', () => {
  function setupMocks() {
    global.nova = {
      config: { get: () => true },
      fs: {
        access: () => false,
        stat: () => null,
      },
      path: { join: (a, b) => `${a}/${b}` },
      workspace: { path: '/test' },
    };

    global.IssueSeverity = {
      Error: 'error',
      Info: 'info',
      Warning: 'warning',
    };

    global.Issue = class Issue {};
    global.Range = class Range {};
    global.NotificationRequest = class NotificationRequest {};
  }

  test('rapid calls should cancel previous pending lints', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Mock runner to prevent actual linting
    provider.runner.lint = () => Promise.resolve({ messages: [] });

    // First call
    provider.provideIssues(editor);
    assert.strictEqual(provider.pendingTimeouts.size, 1);

    // Second call should cancel first
    provider.provideIssues(editor);
    assert.strictEqual(provider.pendingTimeouts.size, 1);

    // Third call should cancel second
    provider.provideIssues(editor);
    assert.strictEqual(provider.pendingTimeouts.size, 1);

    // Clean up
    provider.dispose();
  });

  test('pendingLints should be cleared after lint completes', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Mock runner to prevent actual linting
    provider.runner.lint = () => Promise.resolve({ messages: [] });

    const promise = provider.provideIssues(editor);

    // Should have pending timeout
    assert.strictEqual(provider.pendingTimeouts.size, 1);

    // Wait for debounce + execution
    await promise;

    // Should be cleared after completion
    assert.strictEqual(provider.pendingTimeouts.size, 0);
    assert.strictEqual(provider.pendingResolvers.size, 0);

    // Clean up
    provider.dispose();
  });

  test('should not notify on unknown error type', () => {
    setupMocks();

    // Track notification calls
    let notificationAdded = false;
    global.nova.notifications = {
      add: () => {
        notificationAdded = true;
      },
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    // Create error that doesn't match known patterns
    const unknownError = new Error('Some random unknown error message');
    provider.handleError(unknownError);

    // Should not show notification for unknown error
    assert.strictEqual(notificationAdded, false);

    provider.dispose();
  });

  test('should return empty array for unsaved file with no path', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: null, // No path - unsaved file
        uri: 'file://unsaved',
      },
    };

    const promise = provider.provideIssues(editor);
    await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
    const result = await promise;

    assert.deepStrictEqual(result, []);

    provider.dispose();
  });

  test('should lint dirty document via stdin', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    let lintContentCalled = false;
    let capturedContent = null;

    const editor = {
      document: {
        getTextInRange: range => {
          return 'const foo = 1;';
        },
        isDirty: true, // Document has unsaved changes
        length: 14,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Mock runner to capture lintContent call
    provider.runner.lintContent = (content, filePath) => {
      lintContentCalled = true;
      capturedContent = content;
      return Promise.resolve({ messages: [] });
    };

    const promise = provider.provideIssues(editor);
    await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
    await promise;

    assert.strictEqual(lintContentCalled, true);
    assert.strictEqual(capturedContent, 'const foo = 1;');

    provider.dispose();
  });

  test('should return empty array when ESLint is disabled', async () => {
    setupMocks();

    // Set config to return false (ESLint disabled)
    global.nova.config.get = () => false;

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    const result = await provider.provideIssues(editor);

    // Should return empty immediately without debounce
    assert.deepStrictEqual(result, []);

    provider.dispose();
  });

  test('should handle editor closed during debounce', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    const promise = provider.provideIssues(editor);

    // Simulate editor being closed during debounce
    setTimeout(() => {
      editor.document = null;
    }, 100);

    await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
    const result = await promise;

    assert.deepStrictEqual(result, []);

    provider.dispose();
  });

  test('should skip lint if already in progress for URI', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Manually add URI to activeLints to simulate in-progress lint
    provider.activeLints.add('file://test/file.js');

    const promise = provider.provideIssues(editor);
    await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
    const result = await promise;

    // Should return empty because lint is already active
    assert.deepStrictEqual(result, []);

    provider.dispose();
  });

  test('should handle error during lintDocument', async () => {
    setupMocks();

    let errorHandled = false;
    global.nova.notifications = {
      add: () => {
        errorHandled = true;
      },
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Mock runner to throw error
    provider.runner.lint = () => {
      return Promise.reject(new Error('ESLint not found'));
    };

    const promise = provider.provideIssues(editor);
    await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
    const result = await promise;

    // Should return empty on error
    assert.deepStrictEqual(result, []);
    // Should have called handleError which shows notification
    assert.strictEqual(errorHandled, true);

    provider.dispose();
  });

  test('should handle dispose when runner is null', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    // Set runner to null
    provider.runner = null;

    // Should not throw
    assert.doesNotThrow(() => {
      provider.dispose();
    });
  });

  test('should handle missing resolver during debounce cancellation', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Mock runner
    provider.runner.lint = () => Promise.resolve({ messages: [] });

    // Start first lint
    const promise1 = provider.provideIssues(editor);

    // Get the requestId that was stored
    const pending = provider.pendingLints.get(editor);
    const requestId = pending.requestId;

    // Manually delete the resolver to simulate edge case
    provider.pendingResolvers.delete(requestId);

    // Start second lint immediately (should trigger debounce cancellation)
    const promise2 = provider.provideIssues(editor);

    // Should not throw even though oldResolver is undefined
    await new Promise(resolve => setTimeout(resolve, 350));
    await promise2;

    provider.dispose();
  });

  test('should handle missing resolver when editor closes', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    provider.provideIssues(editor);

    // Delete resolver before timeout fires
    await new Promise(resolve => setTimeout(resolve, 100));
    const pending = provider.pendingLints.get(editor);
    if (pending) {
      provider.pendingResolvers.delete(pending.requestId);
    }

    // Simulate editor closing
    editor.document = null;

    // Wait for debounce to complete - should not throw even though resolver is undefined
    await new Promise(resolve => setTimeout(resolve, 350));

    provider.dispose();
  });

  test('should handle missing resolver when lint is already active', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    // Add URI to activeLints
    provider.activeLints.add('file://test/file.js');

    provider.provideIssues(editor);

    // Delete resolver before timeout fires
    await new Promise(resolve => setTimeout(resolve, 100));
    const pending = provider.pendingLints.get(editor);
    if (pending) {
      provider.pendingResolvers.delete(pending.requestId);
    }

    // Wait for debounce to complete - should not throw even though resolver is undefined
    await new Promise(resolve => setTimeout(resolve, 350));

    provider.dispose();
  });

  test('should handle missing resolver on successful lint', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    provider.runner.lint = () => Promise.resolve({ messages: [] });

    provider.provideIssues(editor);

    // Delete resolver before lint completes
    await new Promise(resolve => setTimeout(resolve, 100));
    const pending = provider.pendingLints.get(editor);
    if (pending) {
      provider.pendingResolvers.delete(pending.requestId);
    }

    // Wait for debounce and lint to complete - should not throw even though resolver is undefined
    await new Promise(resolve => setTimeout(resolve, 350));

    provider.dispose();
  });

  test('should handle missing resolver on lint error', async () => {
    setupMocks();

    global.nova.notifications = {
      add: () => {},
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/EslintProvider.js');
    const provider = new ESLintProvider();

    const editor = {
      document: {
        isDirty: false,
        length: 100,
        path: '/test/file.js',
        uri: 'file://test/file.js',
      },
    };

    provider.runner.lint = () => Promise.reject(new Error('ESLint not found'));

    provider.provideIssues(editor);

    // Delete resolver before error occurs
    await new Promise(resolve => setTimeout(resolve, 100));
    const pending = provider.pendingLints.get(editor);
    if (pending) {
      provider.pendingResolvers.delete(pending.requestId);
    }

    // Wait for debounce and error to occur - should not throw even though resolver is undefined
    await new Promise(resolve => setTimeout(resolve, 350));

    provider.dispose();
  });
});
