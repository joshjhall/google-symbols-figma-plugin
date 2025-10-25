# GitHub Module

**AI Metadata**: Essential for understanding SVG fetching and URL generation
**Token Cost**: ~500 tokens
**Stability**: High (stable API)
**Last Updated**: 2025-10-17

## Purpose

GitHub API integration for fetching Material Symbols icons from Google's repository. Handles URL generation, API requests, and rate limiting.

## Architecture

```text
lib/github/
├── api.ts              # 455 lines - GitHub API client
├── url-generator.ts    # URL generation for SVG files
└── index.ts            # Barrel exports
```

## Key Files

### api.ts

**Purpose**: GitHub API client with rate limiting and retry logic

**Key Class**:

```typescript
class GitHubIconAPI {
  constructor(config?: { ref?: string; token?: string });

  // Fetch SVG content
  async fetchSVGContent(url: string): Promise<string | null>;

  // Test if icon exists
  async testIconExists(iconName: string, style: IconStyle): Promise<boolean>;

  // Batch test icons
  async batchTestIcons(iconNames: string[], style: IconStyle): Promise<Map<string, boolean>>;

  // Fetch current commit SHA
  async fetchCurrentCommitSha(): Promise<string>;
}
```

**Features**:

- Automatic retry with exponential backoff
- Rate limit detection (429 responses)
- GitHub token support (optional)
- Commit SHA tracking

### url-generator.ts

**Purpose**: Generate URLs for Material Symbols SVG files

**Key Function**:

```typescript
function generateGitHubUrl(iconName: string, variant: IconVariant, style: IconStyle): string;

// Example output:
// https://raw.githubusercontent.com/google/material-design-icons/
// {commitSha}/symbols/web/home/materialsymbolsrounded/
// home_rounded_24dp_wght400_grad0_fill0_opsz24.svg
```

**Configuration**:

```typescript
setGitHubRef(commitSha); // Set reference (commit SHA or branch)
```

## Types

### IconStyle

```typescript
type IconStyle = 'rounded' | 'sharp' | 'outlined';
```

### IconVariant

```typescript
interface IconVariant {
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade: -25 | 0 | 200;
  opticalSize: 20 | 24 | 40 | 48;
  fill: 0 | 1;
}
```

## Repository Structure

Material Design Icons repository:

```text
google/material-design-icons/
└── symbols/
    └── web/
        └── {icon-name}/           # e.g., "home"
            ├── materialsymbolsrounded/
            │   ├── home_rounded_20dp_wght400_grad0_fill0_opsz20.svg
            │   ├── home_rounded_24dp_wght400_grad0_fill0_opsz24.svg
            │   └── ... (504 variants)
            ├── materialsymbolssharp/
            └── materialsymbolsoutlined/
```

## Rate Limiting

### GitHub API Limits

```text
Unauthenticated: 60 requests/hour
Authenticated:   5,000 requests/hour
```

### Handling

```typescript
// Automatic detection and retry
try {
  const svg = await api.fetchSVGContent(url);
} catch (error) {
  // If 429 (rate limit), waits and retries
  // If other error, throws with context
}
```

## Usage Patterns

### Basic SVG Fetch

```typescript
import { GitHubIconAPI, generateGitHubUrl } from '@lib/github';

const api = new GitHubIconAPI({ ref: 'master' });

const url = generateGitHubUrl('home', variant, 'rounded');
const svg = await api.fetchSVGContent(url);
```

### Batch Icon Testing

```typescript
const api = new GitHubIconAPI();
const results = await api.batchTestIcons(['home', 'search', 'menu'], 'rounded');

// Map<iconName, exists>
console.log(results.get('home')); // true/false
```

### Commit SHA Tracking

```typescript
// Initialize with specific commit
const commitSha = await api.fetchCurrentCommitSha();
setGitHubRef(commitSha);

// All subsequent URLs use this commit
const url = generateGitHubUrl('home', variant, 'rounded');
// URL contains: /blob/{commitSha}/...
```

## Error Handling

### Network Errors

```typescript
try {
  const svg = await api.fetchSVGContent(url);
} catch (error) {
  if (error.message.includes('429')) {
    // Rate limited - retry handled automatically
  } else if (error.message.includes('404')) {
    // Icon/variant doesn't exist
  } else {
    // Other network error
  }
}
```

### Retry Strategy

```text
Attempt 1: Immediate
Attempt 2: Wait 1s
Attempt 3: Wait 2s
Attempt 4: Wait 4s
Max: 3 retries
```

## Testing Strategy

```text
__tests__/
├── api.test.ts           # API client tests
└── url-generator.test.ts # URL generation tests
```

### Test Considerations

- Mock `fetch()` for API tests
- Test rate limit handling
- Verify URL format correctness
- Test commit SHA integration

## Performance

### Batch Operations

Use batch methods when testing multiple icons:

```typescript
// ❌ Slow - sequential requests
for (const icon of icons) {
  await api.testIconExists(icon, style);
}

// ✅ Fast - parallel requests with concurrency limit
const results = await api.batchTestIcons(icons, style);
```

### Caching

SVG content should be cached at a higher level (batch-fetcher.ts handles this).

## Related Documentation

- `/packages/figma/src/lib/icons/README.ai.md` - Icon generation
- `/packages/figma/src/lib/icons/batch-fetcher.ts` - Batch downloading
- `/docs/resources/standards/error-handling.md` - Error patterns
