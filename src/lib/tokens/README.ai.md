# Tokens Module

**AI Metadata**: Important for understanding Material Design token integration
**Token Cost**: ~600 tokens
**Stability**: Medium (evolving with M3 changes)
**Last Updated**: 2025-10-17

## Purpose

Dynamic variable resolution and token binding for Material Design 3 (M3) integration. Resolves Figma variables at runtime to ensure correct theming regardless of library changes.

## Architecture

```text
lib/tokens/
├── resolver.ts     # 359 lines - Variable resolution engine
├── lookup.ts       # Variable ID lookup utilities
├── binder.ts       # Bind variables to node properties
└── index.ts        # Barrel exports
```

## Key Concepts

### Why Runtime Resolution?

Variable IDs in Figma can change when:

- Library is updated
- Variables are reorganized
- Different Figma files are used
- Project structure changes

**Solution**: Look up variables dynamically at runtime by name, not ID.

### Resolution Priority

```text
1. Library sources (authoritative, up-to-date)
   ↓ (if unavailable)
2. Page elements (fallback, may be stale)
   ↓ (if unavailable)
3. Error / use fallback values
```

## Key Files

### resolver.ts

**Purpose**: Main variable resolution engine

**Key Function**:

```typescript
function resolveVariables(
  node: SceneNode,
  propertyPath: string[], // e.g., ['fills', 0, 'color']
  variableName: string // e.g., 'sys-color-surface'
): boolean;

// Returns true if successfully bound
```

**Features**:

- Recursive property path traversal
- Library-first resolution
- Page fallback mechanism
- Caching for performance

**Example**:

```typescript
// Bind surface color to frame fill
resolveVariables(frame, ['fills', 0, 'color'], 'sys-color-surface');
```

### lookup.ts

**Purpose**: Variable ID lookup by name

**Key Functions**:

```typescript
// Find variable in library
function findVariableInLibrary(name: string): Variable | null;

// Find variable in page elements
function findVariableInPage(page: PageNode, name: string): Variable | null;

// Get all available variables
function getAllVariables(): Variable[];
```

### binder.ts

**Purpose**: Bind variable to node property

**Key Function**:

```typescript
function bindVariable(
  node: SceneNode,
  property: string, // e.g., 'fills'
  variableId: string
): void;
```

## Material Design 3 Tokens

### Token Categories

```text
Color Tokens:
  - sys-color-surface
  - sys-color-on-surface
  - sys-color-primary
  - sys-color-on-primary
  - sys-color-surface-container
  - sys-color-outline

Spacing Tokens:
  - spacing-small (8px)
  - spacing-medium (16px)
  - spacing-large (24px)

Typography Tokens:
  - typeface-brand
  - typeface-plain
  - font-size-*
```

### Token Naming Convention

```text
{category}-{role}-{modifier}
  ↓        ↓       ↓
sys-color-surface-container
  ↓        ↓       ↓
system   color   surface (container variant)
```

## Usage Patterns

### Resolve Single Property

```typescript
import { resolveVariables } from '@lib/tokens/resolver';

// Bind background color
const success = resolveVariables(frame, ['fills', 0, 'color'], 'sys-color-surface');

if (!success) {
  // Fallback to static color
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
}
```

### Resolve Multiple Properties

```typescript
// Background
resolveVariables(frame, ['fills', 0, 'color'], 'sys-color-surface');

// Border
resolveVariables(frame, ['strokes', 0, 'color'], 'sys-color-outline');

// Corner radius (if variable)
resolveVariables(frame, ['cornerRadius'], 'corner-radius-medium');
```

### Check Variable Availability

```typescript
import { findVariableInLibrary } from '@lib/tokens/lookup';

const variable = findVariableInLibrary('sys-color-surface');
if (!variable) {
  logger.warn('M3 library not available - using fallback colors');
}
```

## Variable Binding Mechanics

### Property Paths

Property paths specify where to bind the variable:

```typescript
// Examples of property paths
['fills', 0, 'color'][('strokes', 0, 'color')][('effects', 0, 'color')]['cornerRadius'][ // First fill color // First stroke color // First effect color // Corner radius
  'paddingLeft'
]; // Left padding
```

### Supported Properties

```text
Colors:
  - fills[n].color
  - strokes[n].color
  - effects[n].color

Numbers:
  - cornerRadius
  - padding* (paddingLeft, paddingTop, etc.)
  - itemSpacing
  - fontSize

Opacity:
  - opacity
  - fills[n].opacity
```

## Caching Strategy

### Variable Cache

```typescript
// Variables are cached after first lookup
const cache = new Map<string, Variable>();

function getVariable(name: string): Variable | null {
  if (cache.has(name)) return cache.get(name);

  const variable = findVariableInLibrary(name);
  if (variable) cache.set(name, variable);

  return variable;
}
```

### Cache Invalidation

Cache is cleared when:

- Library is reloaded
- Plugin restarts
- Manual invalidation requested

## Error Handling

### Missing Variables

```typescript
try {
  const success = resolveVariables(node, path, name);
  if (!success) {
    logger.warn(`Variable not found: ${name}`);
    // Apply fallback
  }
} catch (error) {
  logger.error('Variable resolution failed', { name, error });
}
```

### Library Not Available

If M3 library isn't available:

1. Try page fallback
2. Log warning
3. Use static fallback values
4. Continue execution (graceful degradation)

## Testing Strategy

```text
__tests__/
├── resolver.test.ts  # Resolution logic
├── lookup.test.ts    # Variable lookup
└── binder.test.ts    # Property binding
```

### Test Considerations

- Mock Figma variable API
- Test priority resolution order
- Verify fallback behavior
- Test caching correctness

## Performance

### Optimization Tips

1. **Batch Operations**: Resolve multiple properties at once
2. **Cache Results**: Don't re-resolve unchanged variables
3. **Check Availability First**: Test if library is available before attempting resolution
4. **Use Fallbacks**: Always have static fallback values

## Related Documentation

- `/packages/figma/src/handlers/page-organization.ts` - Token usage
- Material Design 3 Tokens: <https://m3.material.io/foundations/design-tokens>
- Figma Variables API: <https://www.figma.com/plugin-docs/api/properties/figma-variables/>
