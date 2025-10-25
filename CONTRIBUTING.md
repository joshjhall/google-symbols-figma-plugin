# Contributing to Google Material Symbols Figma Plugin

Thank you for your interest in contributing! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** 8 or higher
- **Figma Desktop** application
- **Git** for version control

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/google-symbols-figma-plugin.git
   cd google-symbols-figma-plugin
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/your-org/google-symbols-figma-plugin.git
   ```

4. **Install dependencies:**
   ```bash
   pnpm install
   ```

5. **Build the plugin:**
   ```bash
   pnpm build
   ```

6. **Load plugin in Figma:**
   - Open Figma Desktop
   - Go to **Plugins → Development → Import plugin from manifest**
   - Select `manifest.json` from your local clone

## Development Workflow

### Creating a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Development Commands

```bash
# Development mode with hot reload
pnpm dev

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

### Making Changes

1. **Write code** following our coding standards
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Run quality checks:**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

### Committing Changes

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history:

**Format:**
```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes (deps, config)

**Examples:**
```bash
git commit -m "feat: add icon search functionality"
git commit -m "fix(icons): correct variant generation for filled icons"
git commit -m "docs: update installation instructions"
```

**Note:** Our git hooks will validate your commit messages automatically.

## Pull Request Process

### Before Submitting

Ensure your PR meets these requirements:

- [ ] Code follows our coding standards
- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Code is formatted: `pnpm format`
- [ ] Build succeeds: `pnpm build`
- [ ] New tests added for new features
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format

### Submitting a PR

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub:
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - List any breaking changes

3. **PR Template:**
   ```markdown
   ## Description
   Brief description of the changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   Describe how you tested your changes

   ## Screenshots (if applicable)
   Add screenshots here

   ## Related Issues
   Closes #123
   ```

### Review Process

1. Automated checks will run (CI, tests, linting)
2. Maintainers will review your code
3. Address any requested changes
4. Once approved, a maintainer will merge

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode
- Avoid `any` type (use `unknown` if needed)
- Prefer interfaces over types for objects
- Use descriptive variable names

### Code Style

- **Formatting:** Automated by Prettier
- **Indentation:** 2 spaces
- **Quotes:** Single quotes
- **Semicolons:** Always use
- **Line length:** 100 characters

### File Organization

```typescript
// 1. External imports
import React from 'react';

// 2. Internal imports
import { IconGenerator } from '@/lib/icons';

// 3. Types/Interfaces
interface Props {
  name: string;
}

// 4. Constants
const MAX_ICONS = 1000;

// 5. Component/Function
export function MyComponent({ name }: Props) {
  // implementation
}
```

### Error Handling

```typescript
// ✅ Good: Specific error types
throw new ValidationError('Invalid icon name', { name });

// ❌ Bad: Generic errors
throw new Error('Something went wrong');
```

### Logging

```typescript
// ✅ Good: Structured logging
logger.info({ iconName, count }, 'Processing icons');

// ❌ Bad: Console logging
console.log('Processing', iconName);
```

## Testing

### Writing Tests

- Co-locate tests with source: `__tests__` directories
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

**Example:**
```typescript
describe('IconGenerator', () => {
  it('should generate icon with correct variants', async () => {
    // Arrange
    const generator = new IconGenerator();
    const icon = { name: 'home', style: 'rounded' };

    // Act
    const result = await generator.generate(icon);

    // Assert
    expect(result.variants).toHaveLength(72);
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Specific test file
pnpm test icon-generator
```

### Test Coverage

- Aim for >80% coverage on new code
- Cover edge cases and error scenarios
- Don't test implementation details

## Documentation

### Code Comments

```typescript
/**
 * Generates Material Symbol icons with all variant combinations
 *
 * @param iconName - The icon ligature name (e.g., "home")
 * @param options - Generation options
 * @returns Promise resolving to generated icon data
 *
 * @example
 * ```ts
 * const icon = await generateIcon('home', { weights: [400, 700] });
 * ```
 */
export async function generateIcon(
  iconName: string,
  options: GenerateOptions
): Promise<IconData> {
  // implementation
}
```

### README Updates

Update README.md when:
- Adding new features
- Changing installation/usage steps
- Updating requirements
- Adding new scripts

### Documentation Files

Update docs/ when:
- Changing architecture
- Adding new workflows
- Updating processes
- Adding troubleshooting info

## Questions?

- 💬 [Start a Discussion](https://github.com/your-org/google-symbols-figma-plugin/discussions)
- 🐛 [Report a Bug](https://github.com/your-org/google-symbols-figma-plugin/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/your-org/google-symbols-figma-plugin/issues/new?template=feature_request.md)

Thank you for contributing! 🎉
