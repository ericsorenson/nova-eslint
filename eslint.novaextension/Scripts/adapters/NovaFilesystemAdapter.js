/**
 * Nova adapter for file system operations
 * Implements FileSystemPort using Nova's fs API
 * @implements {FileSystemPort}
 */

class NovaFilesystemAdapter {
  exists(path) {
    try {
      return nova.fs.access(path, nova.fs.constants.F_OK);
    } catch (_error) {
      return false;
    }
  }

  readFile(path) {
    const file = nova.fs.open(path, 'r');
    try {
      return file.read();
    } finally {
      file.close();
    }
  }
}

module.exports = { NovaFilesystemAdapter };
