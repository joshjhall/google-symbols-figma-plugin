# Token Management Module

This module handles design token resolution and binding for the Figma plugin.

## Structure

```text
tokens/
├── resolver.ts   # Dynamic variable resolution with hierarchical matching
├── binder.ts     # Apply resolved variables to Figma components
├── lookup.ts     # Debug utilities for variable discovery
└── index.ts      # Module exports
```

## Key Features

### Dynamic Resolution

- Resolves variable IDs at runtime from library sources
- Works across different projects and library versions
- No hardcoded IDs that can become outdated

### Hierarchical Matching

Uses a scoring system similar to CSS specificity:

- Exact match: 1000 points
- Leaf node match: 100 points
- Parent segment matches: +10 points each

Example:

- Target: `M3/palette/container/surface-bright`
- `M3/palette/surface-bright` scores 120 (better match)
- `M2/palette/surface-bright` scores 110

### Priority Order

1. **Library sources** (authoritative, up-to-date)
2. **Page elements** (fallback when library unavailable)

## Usage

```typescript
import { applyMUIVariables, resolveVariables } from './lib/tokens';

// Apply MUI design tokens to a component
await applyMUIVariables(componentSet);

// Resolve specific variables
const variables = await resolveVariables([
  'M3/palette/container/surface-bright',
  'M3/sizing/radius/small',
]);
```

## Variable Naming Convention

We use full hierarchical paths to ensure accurate matching:

- `M3/palette/container/surface-bright` (fill color)
- `M3/palette/_documentation/primary/on-background` (stroke color)
- `M3/sizing/radius/small` (corner radius)

The system handles common variations:

- camelCase vs hyphenated names
- Different naming conventions across libraries
- Special cases like `smallBorderRadius` vs `small`
