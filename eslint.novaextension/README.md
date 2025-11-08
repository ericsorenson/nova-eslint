# Nova ESLint Starlight Edition

Integrates ESLint into Nova for JavaScript and TypeScript linting.

## Features

- Real-time linting for JavaScript, TypeScript, JSX, and TSX files
- Displays errors and warnings inline as you code
- Lint on save (default) or as you type
- Auto-fix on save - automatically applies ESLint fixes when saving
- Automatically detects ESLint configuration in your project
- Respects `.eslintignore` and ignore patterns
- Works with ESLint plugins (React, TypeScript, Vue, etc.)
- Optimized performance with stdin linting (no temp files)

## Requirements

ESLint must be installed in your project:

```bash
npm install --save-dev eslint
```

or

```bash
yarn add --dev eslint
```

This extension uses the ESLint installed in your project's `node_modules`, ensuring consistency with your team's configuration.

## Getting Started

1. Install ESLint in your project (see above)
2. Create an ESLint configuration file (e.g., `eslint.config.js`)
3. Open a JavaScript or TypeScript file
4. Errors and warnings will appear inline

### Creating an ESLint Configuration

If you don't have an ESLint configuration yet:

```bash
npm init @eslint/config
```

Or create `eslint.config.js` manually:

```javascript
export default [
  {
    files: ["**/*.js"],
    rules: {
      "semi": ["error", "always"],
      "quotes": ["error", "double"]
    }
  }
];
```

## Configuration

### Extension Preferences

Open Nova Preferences � Extensions � ESLint:

- **Enable ESLint**: Turn linting on or off globally
- **Lint on Save**: Run ESLint when saving files (recommended)
- **Lint on Change**: Run ESLint as you type (may impact performance)
- **Fix on Save**: Automatically apply ESLint fixes when saving files

### Workspace Preferences

Project-specific settings (stored in `.nova/Configuration.json`):

- **ESLint Executable**: Custom path to ESLint (e.g., `node_modules/.bin/eslint`)
- **Config File**: Custom ESLint config file path (e.g., `.eslintrc.custom.js`)

## How It Works

The extension:

1. Detects when you open JavaScript/TypeScript files
2. Finds ESLint in your project's `node_modules`
3. Runs ESLint with your project's configuration
4. Displays issues inline in the editor

ESLint runs from your workspace root, so it will find configuration files and respect ignore patterns just like running `npx eslint` from the command line.

## Troubleshooting

### "ESLint Not Found" Error

Make sure ESLint is installed in your project:

```bash
npm install --save-dev eslint
```

The extension looks for ESLint in:
1. The path specified in workspace preferences
2. `node_modules/.bin/eslint`
3. `node_modules/eslint/bin/eslint.js`

### No Issues Appearing

Check that:
- ESLint is installed (`node_modules/.bin/eslint` exists)
- You have an ESLint configuration file (`eslint.config.js`, `.eslintrc.*`)
- The extension is enabled (Preferences � Extensions � ESLint)
- The file type is supported (JavaScript, TypeScript, JSX, TSX)

### Configuration Errors

If you see configuration errors:
1. Test ESLint from the command line: `npx eslint yourfile.js`
2. Fix any configuration issues in `eslint.config.js`
3. Reload the extension or restart Nova

## Supported File Types

- JavaScript (`.js`, `.mjs`, `.cjs`)
- TypeScript (`.ts`, `.mts`, `.cts`)
- JSX (`.jsx`)
- TSX (`.tsx`)

## Performance Tips

- Use "Lint on Save" instead of "Lint on Change" for better performance
- Configure ESLint to ignore large files or directories
- Use ESLint's cache feature in your project: `npx eslint --cache`

## Known Limitations

- ESLint must be installed locally in each project (this ensures consistency with your project's configuration)

## Feedback

Report issues or request features at:
https://github.com/esorenson/nova-eslint/issues

## License

MIT
