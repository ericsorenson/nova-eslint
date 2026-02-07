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
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
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
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
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
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    // Create fake timeouts
    const timeout1 = setTimeout(() => {}, 10000);
    const timeout2 = setTimeout(() => {}, 10000);

    provider.pendingLints.set('file://test1.js', { requestId: 1, timeout: timeout1 });
    provider.pendingLints.set('file://test2.js', { requestId: 2, timeout: timeout2 });

    assert.strictEqual(provider.pendingLints.size, 2);

    // Dispose should clear timeouts and the map
    provider.dispose();
    assert.strictEqual(provider.pendingLints.size, 0);

    // Clean up - clear the timeouts to prevent test hanging
    clearTimeout(timeout1);
    clearTimeout(timeout2);
  });

  test('pendingResolvers Map should be initialized', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    assert.ok(provider.pendingResolvers instanceof Map);
    assert.strictEqual(provider.pendingResolvers.size, 0);
  });

  test('runner.dispose should be called on provider dispose', () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
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

    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found in project');
    provider.handleError(error);

    assert.ok(notificationAdded);
    assert.strictEqual(notificationAdded.id, 'eslint-not-found');
    assert.strictEqual(notificationAdded.title, 'ESLint Not Found');
    assert.ok(notificationAdded.body.includes('npm install'));
    assert.ok(provider.shownNotifications.has('eslint-not-found'));
  });

  test('should show notification for "failed" config error', () => {
    setupMocks();
    let notificationAdded = null;

    global.nova.notifications.add = request => {
      notificationAdded = request;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint failed (exit 2): Configuration error');
    provider.handleError(error);

    assert.ok(notificationAdded);
    assert.strictEqual(notificationAdded.id, 'eslint-config-error');
    assert.strictEqual(notificationAdded.title, 'ESLint Configuration Error');
    assert.ok(provider.shownNotifications.has('eslint-config-error'));
  });

  test('should not show duplicate notifications', () => {
    setupMocks();
    let notificationCount = 0;

    global.nova.notifications.add = () => {
      notificationCount++;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found');

    provider.handleError(error);
    assert.strictEqual(notificationCount, 1);

    // Second call should not show notification
    provider.handleError(error);
    assert.strictEqual(notificationCount, 1);
  });

  test('should re-show notifications after successful lint clears tracking', () => {
    setupMocks();
    let notificationCount = 0;

    global.nova.notifications.add = () => {
      notificationCount++;
    };

    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    const error = new Error('ESLint executable not found');

    // First error shows notification
    provider.handleError(error);
    assert.strictEqual(notificationCount, 1);

    // Simulate successful lint (would happen in provideIssues)
    provider.shownNotifications.clear();

    // New error should show notification again
    provider.handleError(error);
    assert.strictEqual(notificationCount, 2);
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
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
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
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
    const provider = new ESLintProvider();

    assert.deepStrictEqual(provider.convertToIssues(null), []);
    assert.deepStrictEqual(provider.convertToIssues({}), []);
    assert.deepStrictEqual(provider.convertToIssues({ messages: [] }), []);
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
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
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
    assert.strictEqual(provider.pendingLints.size, 1);

    // Second call should cancel first
    provider.provideIssues(editor);
    assert.strictEqual(provider.pendingLints.size, 1);

    // Third call should cancel second
    provider.provideIssues(editor);
    assert.strictEqual(provider.pendingLints.size, 1);

    // Clean up
    provider.dispose();
  });

  test('pendingLints should be cleared after lint completes', async () => {
    setupMocks();
    const ESLintProvider = require('../eslint.novaextension/Scripts/eslintProvider.js');
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

    // Should have pending lint
    assert.strictEqual(provider.pendingLints.size, 1);

    // Wait for debounce + execution
    await promise;

    // Should be cleared after completion
    assert.strictEqual(provider.pendingLints.size, 0);
    assert.strictEqual(provider.pendingResolvers.size, 0);

    // Clean up
    provider.dispose();
  });
});
