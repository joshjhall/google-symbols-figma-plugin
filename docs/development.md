# Development Setup

This guide covers setting up a development environment for contributing to the plugin.

## Prerequisites

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **pnpm** 8 or higher ([Install](https://pnpm.io/installation))
- **Git** ([Download](https://git-scm.com/))
- **Figma Desktop** ([Download](https://www.figma.com/downloads/))
- **VS Code** (recommended) ([Download](https://code.visualstudio.com/))

## Initial Setup

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/google-symbols-figma-plugin.git
cd google-symbols-figma-plugin

# Add upstream remote
git remote add upstream https://github.com/your-org/google-symbols-figma-plugin.git
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs all dependencies including:

- TypeScript and type definitions
- Build tools (esbuild)
- Testing framework (Vitest)
- Linting and formatting tools

### 3. Build the Plugin

```bash
# Production build
pnpm build

# Development build (unminified)
pnpm build:dev
```

### 4. Load in Figma

1. Open Figma Desktop
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select `manifest.json` from your project directory
4. Plugin appears in **Plugins → Development**

## Development Workflow

### Watch Mode

For active development, use watch mode:

```bash
# Watch both plugin code and UI
pnpm dev

# Watch plugin code only
pnpm dev:code

# Watch UI only
pnpm dev:ui
```

**Hot Reloading:**

- In Figma: **Plugins → Development → Hot reload plugin**
- Or close and reopen the plugin

### Making Changes

1. **Create a branch:**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes** to source files in `src/`

3. **Test locally:**
   - Plugin code changes: Reload in Figma
   - UI changes: Reopen plugin UI

4. **Run quality checks:**

   ```bash
   pnpm lint        # Check for linting errors
   pnpm typecheck   # Verify types
   pnpm test        # Run tests
   ```

5. **Commit changes:**

   ```bash
   git add .
   git commit -m "feat: add my feature"
   ```

   _Note: Pre-commit hooks will run automatically_

## Available Commands

### Build Commands

```bash
pnpm build          # Production build (minified)
pnpm build:dev      # Development build (unminified)
pnpm build:code     # Build plugin code only
pnpm build:ui       # Build UI only
pnpm clean          # Remove dist directory
```

### Quality Commands

```bash
pnpm lint           # Run ESLint
pnpm lint:fix       # Fix linting issues
pnpm format         # Format code with Prettier
pnpm format:check   # Check formatting
pnpm typecheck      # Type check without building
```

### Test Commands

```bash
pnpm test           # Run tests in watch mode
pnpm test:run       # Run tests once
pnpm test:coverage  # Generate coverage report
pnpm test:watch     # Watch mode for TDD
```

### Icon Update Commands

```bash
pnpm icons:update   # Fetch latest icon list from Google
pnpm icons:compare  # Generate comparison delta
```

## Project Structure

```
google-symbols-figma-plugin/
├── src/
│   ├── code.ts              # Main plugin code (Figma sandbox)
│   ├── ui.tsx               # Plugin UI (React)
│   ├── types.ts             # Shared TypeScript types
│   ├── lib/
│   │   ├── icons/           # Icon generation logic
│   │   ├── github/          # GitHub API integration
│   │   ├── pages/           # Page organization
│   │   ├── tokens/          # Token system
│   │   └── utils/           # Shared utilities
│   └── handlers/            # UI message handlers
├── scripts/
│   ├── update-icon-list.ts  # Update icons from Google
│   ├── compare-and-generate.ts  # Generate comparison delta
│   └── build-html.js        # Build UI HTML
├── dist/                    # Build output (gitignored)
│   ├── code.js              # Bundled plugin code
│   ├── ui.js                # Bundled UI code
│   └── ui.html              # Plugin UI HTML
├── .vscode/                 # VS Code settings
├── .github/                 # GitHub Actions workflows
└── docs/                    # Documentation
```

## Debugging

### Plugin Code (Figma Sandbox)

1. Open Figma Desktop
2. Run the plugin
3. **Plugins → Development → Show/Hide Console**
4. Use `console.log()` in `src/code.ts`

### UI Code (iframe)

1. Open Figma Desktop
2. Run the plugin
3. Right-click the plugin UI → **Inspect**
4. Use browser DevTools

### TypeScript Debugging

In VS Code:

1. Set breakpoints in source files
2. Run debug configuration (F5)
3. Attach to Figma process

## Testing

### Writing Tests

Tests are co-located with source files in `__tests__` directories:

```
src/lib/icons/
├── generator.ts
└── __tests__/
    └── generator.test.ts
```

**Example test:**

```typescript
import { describe, it, expect } from 'vitest';
import { IconGenerator } from '../generator';

describe('IconGenerator', () => {
  it('should generate icons correctly', async () => {
    const generator = new IconGenerator();
    const result = await generator.generate('home');

    expect(result.name).toBe('home');
    expect(result.variants).toHaveLength(72);
  });
});
```

### Running Tests

```bash
# Watch mode (recommended during development)
pnpm test

# Run once
pnpm test:run

# With coverage
pnpm test:coverage

# Specific test file
pnpm test generator
```

## Code Quality

### Pre-commit Hooks

Automatically run before each commit:

- **Linting**: ESLint checks
- **Formatting**: Prettier formatting
- **Type checking**: TypeScript validation

### Pre-push Hooks

Automatically run before pushing:

- **Type checking**: Full type check
- **Tests**: All tests must pass

### Manual Checks

```bash
# Run all quality checks
pnpm lint && pnpm typecheck && pnpm test:run && pnpm build
```

## DevContainer (Optional)

For a consistent development environment:

1. Install **Docker Desktop**
2. Install **VS Code Remote - Containers** extension
3. Open project in VS Code
4. **Command Palette** → "Reopen in Container"

See [.devcontainer/README.md](../.devcontainer/README.md) for details.

## Troubleshooting

### "Cannot find module" errors

```bash
# Clear and reinstall dependencies
rm -rf node_modules
pnpm install
```

### Build failures

```bash
# Clean and rebuild
pnpm clean
pnpm build
```

### Type errors after update

```bash
# Restart TypeScript server in VS Code
# Command Palette → "TypeScript: Restart TS Server"
```

### Git hooks not running

```bash
# Reinstall hooks
pnpm prepare
```

## Next Steps

- Read [Architecture Overview](architecture.md)
- Review [Contributing Guide](../CONTRIBUTING.md)
- Check [Scripts Reference](scripts.md)

## Getting Help

- 💬 [Discussions](https://github.com/your-org/google-symbols-figma-plugin/discussions)
- 🐛 [Report Issues](https://github.com/your-org/google-symbols-figma-plugin/issues)
