# nova-eslint

ESLint integration for the Nova code editor.

## Extension

The extension source code is in the `eslint.novaextension/` directory. See the [extension README](eslint.novaextension/README.md) for user documentation.

## Development

### Running Tests

The project includes a comprehensive test suite covering bug fixes, error handling, and core functionality:

```bash
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage report
```

**Test Coverage:**

Test coverage includes:
- **ESLintRunner:** Process execution, ESLint discovery, argument building, stdin/stdout communication
- **ESLintProvider:** Issue conversion, debouncing, error notifications, disposal
- **ESLintUtils:** Pure utility functions for parsing and conversion
- **Main:** Fix-on-save tracking and configuration management
- Bug fixes (memory leaks, disposal, caching)
- Error handling and notification logic
- Exit code handling and timeout scenarios

Tests are located in the `test/` directory and use Node.js's native test runner (no external libraries required).

### Testing the Extension

1. Open this project in Nova
2. Enable Extension Development in Nova Preferences → General
3. Select Extensions → Activate Project as Extension
4. The extension will be active in the current Nova window

### Project Structure

```
eslint.novaextension/
├── extension.json          # Extension manifest
├── Scripts/
│   ├── main.js            # Entry point
│   ├── eslint-provider.js # Issue provider
│   └── eslint-runner.js   # ESLint process runner
├── README.md              # User documentation
└── CHANGELOG.md           # Version history
```

### Key Architecture

- **main.js**: Activates the extension, registers the issue assistant, watches config changes
- **eslint-provider.js**: Implements the Nova issue assistant interface, manages issues
- **eslint-runner.js**: Finds and executes ESLint, handles process communication

### How It Works

1. Extension activates when JavaScript/TypeScript files are opened
2. `ESLintProvider` implements Nova's issue assistant interface
3. On save (or change), `provideIssues()` is called
4. `ESLintRunner` finds ESLint in `node_modules` and executes it
5. File content is sent via stdin with `--stdin-filename`
6. ESLint returns JSON results
7. Results are converted to Nova `Issue` objects
8. Issues appear inline in the editor

### Development Resources

- [Nova Extension API](https://docs.nova.app/)
- [ESLint Documentation](https://eslint.org/docs/latest/)

## License

MIT
