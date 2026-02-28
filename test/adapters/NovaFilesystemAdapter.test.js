const assert = require('node:assert');
const { beforeEach, describe, test } = require('node:test');

const {
  NovaFilesystemAdapter,
} = require('../../eslint.novaextension/Scripts/adapters/NovaFilesystemAdapter.js');

describe('NovaFilesystemAdapter', () => {
  let adapter;
  let mockFs;

  beforeEach(() => {
    // Mock Nova fs API
    mockFs = {
      access: (path, _mode) => {
        if (path === '/exists/file.js') return true;
        if (path === '/throws/error.js') throw new Error('Permission denied');
        return false;
      },
      constants: {
        F_OK: 0,
      },
      open: path => {
        if (path === '/test/file.js') {
          return {
            close: () => {},
            read: () => 'file content',
          };
        }
        if (path === '/test/empty.js') {
          return {
            close: () => {},
            read: () => '',
          };
        }
        throw new Error('File not found');
      },
    };

    global.nova = {
      fs: mockFs,
    };

    adapter = new NovaFilesystemAdapter();
  });

  test('exists should return true when file exists', () => {
    const result = adapter.exists('/exists/file.js');

    assert.strictEqual(result, true);
  });

  test('exists should return false when file does not exist', () => {
    const result = adapter.exists('/not/exists.js');

    assert.strictEqual(result, false);
  });

  test('exists should return false when access throws error', () => {
    const result = adapter.exists('/throws/error.js');

    assert.strictEqual(result, false);
  });

  test('readFile should read file content', () => {
    const content = adapter.readFile('/test/file.js');

    assert.strictEqual(content, 'file content');
  });

  test('readFile should read empty file', () => {
    const content = adapter.readFile('/test/empty.js');

    assert.strictEqual(content, '');
  });

  test('readFile should throw error when file not found', () => {
    assert.throws(() => {
      adapter.readFile('/not/found.js');
    }, /File not found/);
  });

  test('readFile should close file after reading', () => {
    let closeCalled = false;
    mockFs.open = () => ({
      close: () => {
        closeCalled = true;
      },
      read: () => 'content',
    });

    adapter.readFile('/test/file.js');

    assert.strictEqual(closeCalled, true);
  });

  test('readFile should close file even if read throws', () => {
    let closeCalled = false;
    mockFs.open = () => ({
      close: () => {
        closeCalled = true;
      },
      read: () => {
        throw new Error('Read error');
      },
    });

    assert.throws(() => {
      adapter.readFile('/test/file.js');
    }, /Read error/);

    assert.strictEqual(closeCalled, true);
  });
});
