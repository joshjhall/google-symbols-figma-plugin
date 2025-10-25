# Icons Module

**AI Metadata**: Critical for understanding icon generation pipeline
**Token Cost**: ~1200 tokens
**Stability**: High (core functionality)
**Last Updated**: 2025-10-17

## Purpose

Complete icon generation and management system for Material Symbols icons with 504 variants per icon (7 styles × 6 weights × 4 fills × 3 grades).

## Architecture

```text
lib/icons/
├── generator.ts               # 704 lines - Core IconGenerator class
├── batch-fetcher.ts           # SVG batch downloading with rate limiting
├── batch-generator.ts         # Multi-icon batch processing
├── incremental-updater.ts     # Smart update/skip logic
├── metadata-helpers.ts        # Metadata reading utilities
├── deprecation-handler.ts     # Deprecate removed icons
├── variant-utils.ts           # Variant selection & naming
├── all-icons.ts               # Icon list utilities
└── all-icons-data.json        # Icon list (generated)
```

## Key Files

### generator.ts (704 lines)

**Purpose**: Core `IconGenerator` class - creates/updates icon components

**Key Methods**:

```typescript
class IconGenerator {
  // Generate single icon with all variants
  async generateIcon(iconName: string, variants: VariantData[]): Promise<GenerationResult>;

  // Check if component needs update
  checkNeedsUpdate(page: PageNode, iconName: string, commitSha: string): UpdateCheck;

  // Create single variant component
  createVariantComponent(iconName: string, variant: VariantData, svg: string): ComponentNode;
}
```

**Features**:

- 504-variant generation per icon
- Smart caching (skip unchanged icons)
- Metadata storage in plugin data
- Hash-based change detection
- Token/variable integration

### incremental-updater.ts

**Purpose**: Minimize Figma version bloat by only updating changed variants

**Key Functions**:

- `analyzeComponentForUpdate()` - Determine what needs updating
- `updateVariantComponent()` - Update single variant
- `addVariantToComponentSet()` - Add missing variant
- `reorderComponentSetVariants()` - Maintain consistent order

**Smart Logic**:

1. Read existing metadata (commit SHA, hash)
2. Compare with new data
3. Only update changed/missing variants
4. Update metadata atomically

### batch-fetcher.ts

**Purpose**: Batch download SVG files from GitHub with rate limiting

**Key Features**:

- Concurrent requests (20 max)
- Automatic retry with exponential backoff
- Rate limit detection
- Progress reporting

```typescript
const results = await batchFetchSVGs(
  itemsToFetch, // Array of {iconName, variant, url}
  onProgress, // Progress callback
  () => isCancelled // Cancellation check
);
```

### deprecation-handler.ts

**Purpose**: Mark icons that were removed from Material Symbols

**Flow**:

1. Find all existing ComponentSet nodes (recursive)
2. Compare against icons being imported
3. Rename non-matching icons with `deprecated_` prefix
4. Preserve components for backwards compatibility

### metadata-helpers.ts

**Purpose**: Read/write plugin metadata on Figma nodes

**Key Functions**:

- `getComponentCommitSha()` - Read stored commit SHA
- `getComponentHash()` - Read stored SVG hash
- `checkIconNeedsUpdate()` - Determine if update needed

**Metadata Keys**:

```typescript
const PLUGIN_DATA_KEYS = {
  COMMIT_SHA: 'commitSha', // Source commit
  COMPONENT_HASH: 'componentHash', // SVG content hash
  VARIANT_COUNT: 'variantCount', // Expected 504
};
```

## Data Flow

### Icon Generation Pipeline

```text
1. User selects category
   ↓
2. Get icon list (all-icons.ts)
   ↓
3. Check metadata (needs update?)
   ↓
4. Batch fetch SVGs (batch-fetcher.ts)
   ↓
5. Generate/update components (generator.ts)
   ↓
6. Apply deprecation (deprecation-handler.ts)
   ↓
7. Organize page (handlers/page-organization.ts)
```

### Incremental Update Flow

```text
1. Read existing component metadata
   ↓
2. Compare commit SHA & hash
   ↓
3. If unchanged: Skip (fast path)
   ↓
4. If changed: Analyze variants
   ↓
5. Update only changed variants
   ↓
6. Update metadata atomically
```

## Variant System

### Variant Properties

```typescript
interface IconVariant {
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade: -25 | 0 | 200;
  opticalSize: 20 | 24 | 40 | 48;
  fill: 0 | 1;
}
```

### Total Combinations

```text
Styles:       7 (rounded, sharp, outlined, etc.)
Weights:      6 (100, 200, 300, 400, 500, 600, 700)
Grades:       3 (-25, 0, 200)
Fills:        2 (0, 1)
Optical:      4 (20dp, 24dp, 40dp, 48dp)
────────────────────────────────────
Total:      504 variants per icon
```

## Performance Considerations

### Memory Management

- Each set: ~150 icons × 504 variants = 75,600 components
- Memory: ~20-25% per set
- Recommendation: Process one set at a time

### Optimization Strategies

1. **Smart Skip**: Only update changed icons (metadata comparison)
2. **Incremental Update**: Only update changed variants
3. **Batch Fetching**: Parallel downloads with rate limiting
4. **Caching**: Store SVG hashes to detect changes

## Testing Strategy

```text
__tests__/
├── generator.test.ts          # Core generation logic
├── batch-fetcher.test.ts      # SVG downloading
├── incremental-updater.test.ts # Update logic
├── metadata-helpers.test.ts   # Metadata operations
├── deprecation-handler.test.ts # Deprecation flow
└── variant-utils.test.ts      # Variant selection
```

## Common Operations

### Generate Single Icon

```typescript
const generator = new IconGenerator();
const result = await generator.generateIcon('home', variantDataArray);
```

### Batch Generate Icons

```typescript
const results = await batchGenerateIcons(page, iconNames, variantDataArray, onProgress);
```

### Check if Update Needed

```typescript
const check = checkIconNeedsUpdate(
  page,
  'home',
  'bb04090f' // new commit SHA
);

if (check.needsUpdate) {
  console.log(check.reason); // "Hash mismatch", "Missing variant", etc.
}
```

## Related Documentation

- `/packages/figma/src/handlers/README.ai.md` - Handler orchestration
- `/packages/figma/src/lib/github/README.ai.md` - SVG fetching
- `/docs/resources/standards/error-handling.md` - Error patterns
