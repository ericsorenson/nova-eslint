const assert = require('node:assert');
const { describe, test } = require('node:test');

const {
  LintConfig,
} = require('../../eslint.novaextension/Scripts/domain/LintConfig.js');

describe('Domain - LintConfig', () => {
  test('should create config with defaults', () => {
    const config = new LintConfig();
    assert.strictEqual(config.configPath, null);
    assert.strictEqual(config.executablePath, null);
  });

  test('should create config with values', () => {
    const config = new LintConfig({
      configPath: '/.eslintrc.js',
      executablePath: '/bin/eslint',
    });
    assert.strictEqual(config.configPath, '/.eslintrc.js');
    assert.strictEqual(config.executablePath, '/bin/eslint');
  });
});
