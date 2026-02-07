const assert = require('node:assert');
const { describe, test, beforeEach } = require('node:test');

const {
  NovaFileSystemAdapter,
} = require('../../eslint.novaextension/Scripts/adapters/NovaFilesystemAdapter.js');

describe('NovaFilesystemAdapter', () => {
  let adapter;
  let mockFs;

  beforeEach(() => {
    // Mock Nova fs API
    mockFs = {
      access: (path, mode) => {
        if (path === '/exists/file.js') return true;
        if (path === '/throws/error.js')
          throw new Error('Permission denied');
        return false;
      },
      constants: {
        F_OK: 0,
      },
      open: path => {
        if (path === '/test/file.js') {
          return {
            read: () => 'file content',
            close: () => {},
          };
        }
        if (path === '/test/empty.js') {
          return {
            read: () => '',
            close: () => {},
          };
        }
        throw new Error('File not found');
      },
    };

    global.nova = {
      fs: mockFs,
    };

    adapter = new NovaFileSystemAdapter();
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
      read: () => 'content',
      close: () => {
        closeCalled = true;
      },
    });

    adapter.readFile('/test/file.js');

    assert.strictEqual(closeCalled, true);
  });

  test('readFile should close file even if read throws', () => {
    let closeCalled = false;
    mockFs.open = () => ({
      read: () => {
        throw new Error('Read error');
      },
      close: () => {
        closeCalled = true;
      },
    });

    assert.throws(() => {
      adapter.readFile('/test/file.js');
    }, /Read error/);

    assert.strictEqual(closeCalled, true);
  });
});
