# Page Management Module

Utilities for managing Figma pages when generating icons.

## Features

- **Page Creation**: Create pages with consistent naming
- **Duplicate Prevention**: Check for existing pages before creating
- **Page Organization**: Optional prefix-based organization (e.g., "Cat 1: Navigation")
- **Content Management**: Clean or preserve existing content
- **Page Statistics**: Track component counts and organization

## Usage

```typescript
import { pageManager } from './lib/pages';

// Get or create a page
const page = await pageManager.getOrCreatePage('Navigation', {
  autoSwitch: true,
  cleanExisting: false,
});

// Find existing pages
const iconPages = pageManager.getAllIconPages();

// Get page statistics
const stats = pageManager.getPageStats(page);
console.log(`Page has ${stats.componentSets} component sets`);
```

## Page Naming Convention

Pages are created with an optional prefix to keep them organized:

- Default prefix: None (empty string)
- Example: `"Cat 1: Navigation"`, `"Cat 2: Communication"`

This makes it easy to:

- Identify generated pages
- Filter icon pages from other content
- Maintain organization in large files

## Stress Testing

The page manager is used by the stress test module to organize test results:

```typescript
import { runStressTest } from './lib/stress-test';

const results = await runStressTest({
  category: 'Cat 1: Navigation', // Creates "Cat 1: Navigation" page
  icons: ['home', 'menu'],
  weights: [300, 400],
});
```
