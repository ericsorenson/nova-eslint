/**
 * Nova adapter for process execution
 * Implements ProcessPort using Nova's Process API
 */

const { ProcessPort } = require('../domain/ports.js');

const PROCESS_TIMEOUT_MS = 30000;

class NovaProcessAdapter extends ProcessPort {
  constructor() {
    super();
    this.activeProcesses = new Set();
  }

  async execute({ args, command, cwd, stdin }) {
    return new Promise((resolve, reject) => {
      const process = new Process(command, {
        args,
        cwd: cwd || undefined,
        shell: true,
      });

      this.activeProcesses.add(process);

      let stdout = '';
      let stderr = '';
      let settled = false;

      const settleOnce = (exitCode, error = null) => {
        if (settled) return;
        settled = true;

        clearTimeout(timeoutId);
        this.activeProcesses.delete(process);

        if (error) {
          reject(error);
        } else {
          resolve({ exitCode, stderr, stdout });
        }
      };

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!settled) {
          process.terminate();
          settleOnce(
            -1,
            new Error(`Process timed out after ${PROCESS_TIMEOUT_MS}ms`),
          );
        }
      }, PROCESS_TIMEOUT_MS);

      // Collect output
      process.onStdout(line => {
        stdout += line;
      });

      process.onStderr(line => {
        stderr += line;
      });

      // Handle process exit
      process.onDidExit(exitCode => {
        settleOnce(exitCode);
      });

      // Start process
      try {
        process.start();

        // Write stdin if provided
        if (stdin !== null && stdin !== undefined) {
          const writer = process.stdin.getWriter();
          writer.ready.then(() => {
            writer.write(stdin);
            writer.close();
          });
        }
      } catch (error) {
        settleOnce(-1, new Error(`Failed to start process: ${error.message}`));
      }
    });
  }

  /**
   * Terminate all active processes
   */
  dispose() {
    this.activeProcesses.forEach(process => {
      try {
        process.terminate();
      } catch (error) {
        console.error('Error terminating process:', error);
      }
    });
    this.activeProcesses.clear();
  }
}

module.exports = { NovaProcessAdapter };
