# Contributing to Gremlin MCP Server

Thank you for your interest in contributing to the Gremlin MCP Server! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)
- Docker (for integration tests)
- Git

### Setup Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/kpritam/gremlin-mcp.git
   cd gremlin-mcp
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run tests to ensure everything is working:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Development branch (if using GitFlow)
- Feature branches: `feature/your-feature-name`
- Bug fixes: `fix/issue-description`
- Documentation: `docs/improvement-description`

### Making Changes

1. Create a new branch for your feature or fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our [Development Rules](RULES.md)

3. Test your changes:

   ```bash
   npm run validate  # Runs format, lint, type-check, and tests
   ```

4. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new data export format support"
   ```

### Commit Message Convention

We follow conventional commits for clear and consistent commit history:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or modifying tests
- `chore:` - Maintenance tasks

Examples:

- `feat: add support for Neptune Serverless connections`
- `fix: handle connection timeout errors gracefully`
- `docs: update installation instructions for Docker`

## Code Quality Standards

### Code Style

- Follow the existing code patterns and architecture
- Use TypeScript types and Zod schemas for runtime validation
- Follow SOLID principles and DRY practices
- Write clear, self-documenting code with meaningful names

### Testing Requirements

- Write unit tests for all new functionality
- Update existing tests when modifying behavior
- Ensure integration tests pass with Docker containers
- Maintain test coverage above 85%

### Pre-commit Hooks

The project uses Husky for pre-commit hooks that will:

- Run ESLint and auto-fix issues
- Format code with Prettier
- Run type checking

These hooks ensure code quality before commits are made.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests

Integration tests use Testcontainers to spin up a Gremlin server automatically. This ensures tests are:

- Self-contained
- Reproducible
- Independent of external services

## Documentation

### Code Documentation

- Use JSDoc comments for functions and classes
- Document complex algorithms and business logic
- Include examples in documentation when helpful

### README Updates

When adding new features:

- Update usage examples
- Add new configuration options
- Update the feature list

## Submitting Changes

### Pull Request Process

1. Push your branch to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a Pull Request on GitHub with:
   - Clear title describing the change
   - Detailed description of what was changed and why
   - Link to any related issues
   - Screenshots or examples if applicable

3. Ensure your PR:
   - Passes all CI checks
   - Has been reviewed by at least one maintainer
   - Includes appropriate tests
   - Updates documentation if needed

### PR Template

When creating a PR, please include:

```markdown
## Summary

Brief description of changes

## Changes Made

- List of specific changes
- New features or fixes

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Documentation

- [ ] README updated if needed
- [ ] Code comments added
- [ ] API documentation updated

## Breaking Changes

List any breaking changes and migration steps
```

## Security

### Security Best Practices

- Never commit secrets, API keys, or credentials
- Validate all inputs with Zod schemas
- Sanitize Gremlin queries to prevent injection
- Follow principle of least privilege

### Reporting Security Issues

Please do not report security issues publicly. Instead, email us at [security email] or use our [Security Policy](SECURITY.md).

## Architecture Guidelines

### Project Structure

- `src/` - Source code
  - `gremlin/` - Gremlin client and models
  - `handlers/` - MCP request handlers
  - `utils/` - Utility functions
- `tests/` - Test files
- `.github/` - GitHub workflows and templates

### Design Principles

- **Single Responsibility**: Each module should have one reason to change
- **Open-Closed**: Open for extension, closed for modification
- **Interface Segregation**: Prefer specific interfaces over general ones
- **Dependency Inversion**: Depend on abstractions, not implementations

### Error Handling

- Use structured error handling with specific failure modes
- Provide clear error messages with context
- Log errors appropriately without exposing sensitive data

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- Breaking changes increment MAJOR
- New features increment MINOR
- Bug fixes increment PATCH

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] GitHub release created
- [ ] npm package published

## Getting Help

### Community Support

- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and discuss ideas
- Documentation: Check the README and code documentation

### Maintainer Contact

- Create an issue for bugs and feature requests
- Use discussions for questions and ideas
- Mention @maintainers for urgent issues

## Recognition

Contributors will be:

- Listed in the project README
- Recognized in release notes
- Invited to join the maintainer team for significant contributions

Thank you for contributing to the Gremlin MCP Server! 🚀
