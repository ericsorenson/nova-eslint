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
    const ESLintProvider = require('./eslint-provider.js');
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
    const ESLintProvider = require('./eslint-provider.js');
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
    const ESLintProvider = require('./eslint-provider.js');
    const provider = new ESLintProvider();

    // Create fake timeouts
    const timeout1 = setTimeout(() => {}, 10000);
    const timeout2 = setTimeout(() => {}, 10000);

    provider.pendingLints.set('file://test1.js', timeout1);
    provider.pendingLints.set('file://test2.js', timeout2);

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
    const ESLintProvider = require('./eslint-provider.js');
    const provider = new ESLintProvider();

    assert.ok(provider.pendingResolvers instanceof Map);
    assert.strictEqual(provider.pendingResolvers.size, 0);
  });

  test('runner.dispose should be called on provider dispose', () => {
    setupMocks();
    const ESLintProvider = require('./eslint-provider.js');
    const provider = new ESLintProvider();

    let runnerDisposeCalled = false;
    provider.runner.dispose = () => {
      runnerDisposeCalled = true;
    };

    provider.dispose();
    assert.ok(runnerDisposeCalled);
  });
});
