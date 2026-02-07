const assert = require('node:assert');
const { describe, test, beforeEach } = require('node:test');

const {
  NovaConfigAdapter,
} = require('../../eslint.novaextension/Scripts/adapters/NovaConfigAdapter.js');

describe('NovaConfigAdapter', () => {
  let adapter;
  let mockWorkspaceConfig;

  beforeEach(() => {
    // Mock Nova workspace config
    mockWorkspaceConfig = new Map();
    global.nova = {
      workspace: {
        config: {
          get: (key, type) => {
            return mockWorkspaceConfig.get(key);
          },
        },
        path: '/test/workspace',
      },
    };

    adapter = new NovaConfigAdapter();
  });

  test('getLintConfig should return config with null values when not set', () => {
    const config = adapter.getLintConfig();

    assert.strictEqual(config.executablePath, null);
    assert.strictEqual(config.configPath, null);
  });

  test('getLintConfig should return config with values when set', () => {
    mockWorkspaceConfig.set('eslint.executablePath', '/usr/local/bin/eslint');
    mockWorkspaceConfig.set('eslint.configPath', '/project/.eslintrc.js');

    const config = adapter.getLintConfig();

    assert.strictEqual(config.executablePath, '/usr/local/bin/eslint');
    assert.strictEqual(config.configPath, '/project/.eslintrc.js');
  });

  test('getLintConfig should handle partial config', () => {
    mockWorkspaceConfig.set('eslint.executablePath', '/custom/eslint');

    const config = adapter.getLintConfig();

    assert.strictEqual(config.executablePath, '/custom/eslint');
    assert.strictEqual(config.configPath, null);
  });

  test('getWorkspacePath should return workspace path', () => {
    const path = adapter.getWorkspacePath();

    assert.strictEqual(path, '/test/workspace');
  });

  test('getWorkspacePath should return null when no workspace', () => {
    global.nova.workspace.path = null;

    const path = adapter.getWorkspacePath();

    assert.strictEqual(path, null);
  });
});
