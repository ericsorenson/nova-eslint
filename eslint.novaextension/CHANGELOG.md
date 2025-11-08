# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-08

### Fixed
- Corrected repository and bugs URLs to use correct GitHub username (ericsorenson)

### Changed
- Updated ESLint to version 9.39.1 with latest bug fixes and improvements
- Updated all dependencies to use exact versions for consistent resolution

## [1.0.0]

### Added
- Initial development release
- ESLint integration for JavaScript, TypeScript, JSX, and TSX files
- Real-time linting with inline error and warning display
- Lint on save (default) or lint on change modes
- Fix on save - automatically applies ESLint fixes when saving files
- Automatic ESLint executable detection in project node_modules
- Support for custom ESLint executable paths
- Support for custom ESLint configuration file paths
- User-friendly error messages when ESLint is not found
- Configuration error notifications
- Debounced linting (300ms) for better performance
- Respects ESLint configuration and ignore patterns
- Minimum runtime version requirement (Nova 11.0+)

### Performance Optimizations
- Uses `--stdin` to pass content directly to ESLint (eliminates temp file I/O)
- Cached severity mapping to avoid object recreation
- Cached config path resolution
- Duplicate lint prevention with active lints tracking

### Configuration Options
- Global: Enable/disable ESLint, lint on save, lint on change, fix on save
- Workspace: Custom ESLint executable path, custom config file path

### Code Quality
- Comprehensive test suite with 62 passing tests
  - ~95% line coverage, ~94% branch coverage
  - ESLintRunner: 87.88% line coverage
  - Tests cover process execution, ESLint discovery, error handling, exit codes, stdin/stdout, and timeouts
- Clean code with ESLint validation
- Modular architecture with separate provider and runner components
- Proper error handling and user notifications
- Magic strings extracted to constants for better maintainability

### Known Limitations
- ESLint must be installed locally in each project
