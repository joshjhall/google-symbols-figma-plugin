# Handlers Module

**AI Metadata**: High-value for understanding plugin message handling and business logic
**Token Cost**: ~800 tokens
**Stability**: High (core architecture)
**Last Updated**: 2025-10-17

## Purpose

Message handlers extracted from main plugin code (`code.ts`). Each handler processes specific UI messages and orchestrates business logic without cluttering the main entry point.

## Architecture

```text
handlers/
├── category-generation.ts     # 896 lines - Icon generation for categories
├── page-organization.ts        # ~160 lines - Frame styling & layout
├── cumulative-changes.ts       # ~90 lines - Change tracking utilities
└── index.ts                    # Barrel exports
```

## Key Files

### category-generation.ts

**Purpose**: Handles category-based icon generation with 504 variants per icon

**Key Functions**:

- `handleCategoryGeneration()` - Main entry point
- Smart skip/update logic using metadata
- Incremental updates (only changed icons)
- Deprecation handling
- Rate limiting with retry

**Dependencies**:

- `@lib/icons/generator` - Icon creation
- `@lib/icons/incremental-updater` - Update logic
- `@lib/github` - SVG fetching
- `@lib/pages/manager` - Page management

### page-organization.ts

**Purpose**: Organizes component sets into styled frames

**Key Features**:

- Auto layout with wrapping
- Material Design token integration
- Alphabetical sorting
- Idempotent (can run multiple times safely)

### cumulative-changes.ts

**Purpose**: Track icon changes across multiple commits

**Key Functions**:

- `getFinalSetName()` - Handle set renames across commits
- `hasIconChangedCumulatively()` - Detect changes via commit graph
- `logCumulativeChangeStatus()` - Report optimization status

**Types**:

- `CumulativeChangeData` - Change tracking data structure

## Usage Patterns

### Handler Pattern

```typescript
// From code.ts
import { handleCategoryGeneration } from '@/handlers';

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'START_GENERATION':
      await handleCategoryGeneration(msg, config);
      break;
  }
};
```

### Configuration

```typescript
interface CategoryGenerationConfig {
  commitSha: string;
  iconChangesData: IconChangesData | null;
  iconChangesCumulative: CumulativeChangeData | null;
  isCancelled: () => boolean;
}
```

## Testing Strategy

Tests should be placed in `__tests__/` subdirectory:

```text
handlers/__tests__/
├── category-generation.test.ts
├── page-organization.test.ts
└── cumulative-changes.test.ts
```

## Common Operations

### Generate Icons for a Category

```typescript
await handleCategoryGeneration(
  {
    category: 'Set 1: 10k-air',
    categoryData: {
      firstIcon: '10k',
      lastIconExclusive: 'airwave',
    },
    testIconCount: 5, // Optional: limit for testing
  },
  config
);
```

### Organize Page into Frame

```typescript
await organizePageIntoFrame(page, 'Category Frame Name', existingComponents);
```

## Related Documentation

- `/packages/figma/REFACTORING.ai.md` - Refactoring history
- `/packages/figma/src/lib/icons/README.ai.md` - Icon generation details
- `/docs/resources/standards/error-handling.md` - Error patterns
