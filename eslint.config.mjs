import eslint from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  eslint.configs.recommended,
  perfectionist.configs['recommended-natural'],
  {
    files: ['eslint.novaextension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        clearImmediate: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        CompositeDisposable: 'readonly',
        console: 'readonly',
        exports: 'readonly',
        Issue: 'readonly',
        IssueCollection: 'readonly',
        IssueSeverity: 'readonly',
        module: 'readonly',
        NotificationRequest: 'readonly',
        nova: 'readonly',
        Process: 'readonly',
        Range: 'readonly',
        require: 'readonly',
        setImmediate: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
      },
      sourceType: 'commonjs',
    },
    rules: {
      'no-console': 'off', // We use console.log for debugging
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**', 'test.js'],
  },
  eslintPluginPrettierRecommended,
];
