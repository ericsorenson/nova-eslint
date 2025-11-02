import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
// import eslint from '@eslint/js';

export default [
  // eslint.configs.recommended,
  {
    files: ['eslint.novaextension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Nova global objects
        nova: 'readonly',
        console: 'readonly',

        // Nova API classes
        Process: 'readonly',
        Range: 'readonly',
        Issue: 'readonly',
        IssueSeverity: 'readonly',
        IssueCollection: 'readonly',
        NotificationRequest: 'readonly',
        CompositeDisposable: 'readonly',

        // CommonJS
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      // Possible Errors
      'no-console': 'off', // We use console.log for debugging
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Best Practices
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-arrow-callback': 'warn',
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
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-arrow-callback': 'warn',
    },
  },
  {
    // Ignore patterns
    ignores: ['node_modules/**', 'dist/**', '.git/**', 'test.js'],
  },
  eslintPluginPrettierRecommended,
];
