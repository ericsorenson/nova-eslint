const assert = require('node:assert');
const { beforeEach, describe, test } = require('node:test');

const {
  NovaProcessAdapter,
} = require('../../eslint.novaextension/Scripts/adapters/NovaProcessAdapter.js');

describe('NovaProcessAdapter', () => {
  let adapter;
  let mockProcess;

  beforeEach(() => {
    // Mock Nova Process class
    global.Process = class MockProcess {
      constructor(command, options) {
        this.command = command;
        this.options = options;
        this.terminated = false;
        this.callbacks = {}; // Each process has its own callbacks
        mockProcess = this;

        // Mock stdin writer
        this.stdin = {
          getWriter: () => ({
            close: () => {
              this.stdinClosed = true;
            },
            ready: Promise.resolve(),
            write: data => {
              this.stdinData = data;
            },
          }),
        };
      }

      onDidExit(callback) {
        this.callbacks.exit = callback;
      }

      onStderr(callback) {
        this.callbacks.stderr = callback;
      }

      onStdout(callback) {
        this.callbacks.stdout = callback;
      }

      start() {
        this.started = true;
        // Simulate async process execution
        if (this.command === 'fail-start') {
          throw new Error('Failed to start');
        }
      }

      terminate() {
        this.terminated = true;
        // Immediately trigger exit callback when terminated (synchronously for tests)
        if (this.callbacks.exit) {
          this.callbacks.exit(-1);
        }
      }
    };

    adapter = new NovaProcessAdapter();
  });

  test('execute should run process and return output', async () => {
    const promise = adapter.execute({
      args: ['node', '--version'],
      command: '/usr/bin/env',
      cwd: '/test',
    });

    // Simulate process output
    mockProcess.callbacks.stdout('v20.0.0\n');
    mockProcess.callbacks.exit(0);

    const result = await promise;

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, 'v20.0.0\n');
    assert.strictEqual(result.stderr, '');
  });

  test('execute should collect multiple stdout chunks', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });

    mockProcess.callbacks.stdout('line 1\n');
    mockProcess.callbacks.stdout('line 2\n');
    mockProcess.callbacks.stdout('line 3\n');
    mockProcess.callbacks.exit(0);

    const result = await promise;

    assert.strictEqual(result.stdout, 'line 1\nline 2\nline 3\n');
  });

  test('execute should collect stderr output', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });

    mockProcess.callbacks.stderr('Error: something failed\n');
    mockProcess.callbacks.exit(1);

    const result = await promise;

    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.stderr, 'Error: something failed\n');
  });

  test('execute should handle stdin input', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
      stdin: 'console.log("hello");',
    });

    // Wait for stdin to be written
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(mockProcess.stdinData, 'console.log("hello");');
    assert.strictEqual(mockProcess.stdinClosed, true);

    mockProcess.callbacks.exit(0);
    await promise;
  });

  test('execute should track active processes', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });

    assert.strictEqual(adapter.activeProcesses.size, 1);
    assert.ok(adapter.activeProcesses.has(mockProcess));

    mockProcess.callbacks.exit(0);
    await promise;

    assert.strictEqual(adapter.activeProcesses.size, 0);
  });

  // Note: Timeout behavior is tested implicitly through the real timeout mechanism
  // in integration tests. Mocking setTimeout is complex due to interactions with
  // process lifecycle, so we skip explicit unit testing of timeout logic here.

  test('execute should prevent double-resolution with settleOnce guard', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });

    // First resolution
    mockProcess.callbacks.exit(0);

    // Attempt second resolution (should be ignored)
    mockProcess.callbacks.exit(1);

    const result = await promise;

    // Should use first exit code
    assert.strictEqual(result.exitCode, 0);
  });

  test('execute should handle process start failure', async () => {
    const promise = adapter.execute({
      args: [],
      command: 'fail-start',
      cwd: '/test',
    });

    await assert.rejects(promise, {
      message: /Failed to start process/,
    });

    assert.strictEqual(adapter.activeProcesses.size, 0);
  });

  test('execute should use provided cwd', async () => {
    const promise = adapter.execute({
      args: ['pwd'],
      command: '/usr/bin/env',
      cwd: '/custom/path',
    });

    assert.strictEqual(mockProcess.options.cwd, '/custom/path');
    assert.strictEqual(mockProcess.options.shell, true);

    mockProcess.callbacks.exit(0);
    await promise;
  });

  test('execute should handle undefined cwd', async () => {
    const promise = adapter.execute({
      args: ['pwd'],
      command: '/usr/bin/env',
    });

    assert.strictEqual(mockProcess.options.cwd, undefined);

    mockProcess.callbacks.exit(0);
    await promise;
  });

  test('dispose should terminate all active processes', async () => {
    // Start multiple processes
    const promise1 = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });
    const process1 = mockProcess;

    const promise2 = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });
    const process2 = mockProcess;

    assert.strictEqual(adapter.activeProcesses.size, 2);

    // Dispose adapter (this terminates processes)
    adapter.dispose();

    assert.strictEqual(process1.terminated, true);
    assert.strictEqual(process2.terminated, true);
    assert.strictEqual(adapter.activeProcesses.size, 0);

    // Catch promise rejections from terminated processes
    await promise1.catch(() => {});
    await promise2.catch(() => {});
  });

  test('dispose should handle process termination errors', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });
    const process = mockProcess;

    // Make terminate throw error
    process.terminate = () => {
      throw new Error('Termination failed');
    };

    // Should not throw (disposal catches the error)
    assert.doesNotThrow(() => {
      adapter.dispose();
    });

    assert.strictEqual(adapter.activeProcesses.size, 0);

    // Manually trigger exit to prevent hanging timeout
    process.callbacks.exit(1);
    await promise.catch(() => {});
  });

  test('dispose should clear activeProcesses Set', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
    });

    assert.strictEqual(adapter.activeProcesses.size, 1);

    adapter.dispose();

    assert.strictEqual(adapter.activeProcesses.size, 0);

    // Catch promise rejection from terminated process
    await promise.catch(() => {});
  });

  test('execute should handle null stdin', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
      stdin: null,
    });

    // Should not write to stdin
    assert.strictEqual(mockProcess.stdinData, undefined);

    mockProcess.callbacks.exit(0);
    await promise;
  });

  test('execute should handle undefined stdin', async () => {
    const promise = adapter.execute({
      args: ['node'],
      command: '/usr/bin/env',
      cwd: '/test',
      stdin: undefined,
    });

    // Should not write to stdin
    assert.strictEqual(mockProcess.stdinData, undefined);

    mockProcess.callbacks.exit(0);
    await promise;
  });
});
