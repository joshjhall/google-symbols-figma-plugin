# Figma Plugin Utilities

Lightweight utilities optimized for Figma plugin development.

## Overview

These utilities are adapted from `@terroir/core` but tailored specifically for the Figma plugin environment:

- Smaller bundle size
- Plugin-specific error types
- Figma API type guards
- Simplified logging for browser console

## Modules

### errors.ts

- `FigmaPluginError` - Base error class with code and details
- `VariableNotFoundError` - For variable resolution failures
- `VariableBindingError` - For binding failures
- `IconGenerationError` - For icon generation issues
- `FetchError` - For network/API failures

### logger.ts

- Structured logging with levels (debug, info, warn, error)
- Figma notification integration
- Execution timing utilities
- Context-aware logging

### guards.ts

- Basic type guards (`isString`, `isNumber`, etc.)
- Figma-specific guards (`isComponentSet`, `hasAutoLayout`)
- Assertion utilities (`assert`, `assertDefined`)

## Usage

```typescript
import { logger, FigmaPluginError, assertDefined } from '../utils';

// Logging
logger.info('Processing icons', { count: 100 });
logger.error('Failed to bind variable', error);
logger.notify('Icon generated successfully');

// Error handling
throw new VariableNotFoundError('M3/palette/primary');

// Type guards
if (isComponentSet(node)) {
  // TypeScript knows node is ComponentSetNode
}

// Assertions
assertDefined(variable, 'Variable must exist');
```

## Migration Strategy

Currently these utilities are copied into the plugin. When repos split:

1. **Option A**: Publish as `@terroir/utils` NPM package
2. **Option B**: Use Git submodules
3. **Option C**: Continue copying (if utilities diverge)

The utilities are designed to be:

- Self-contained (no external dependencies)
- Tree-shakeable (only import what you use)
- Type-safe (full TypeScript support)
- Plugin-optimized (browser environment)
