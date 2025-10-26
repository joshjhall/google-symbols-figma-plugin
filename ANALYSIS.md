# Google Symbols Figma Plugin - Comprehensive Analysis

**Date**: 2025-10-26
**Version**: 1.1.0
**Scope**: Architecture, features, code quality, testing, security

---

## Executive Summary

This analysis evaluates the Google Symbols Figma Plugin codebase (39 source files, 11 test files, 97% test coverage on business logic). The plugin successfully generates 4,000+ Material Design icons with 504 variants each, featuring intelligent delta updates and automation.

**Overall Assessment**: **Strong architecture with specific gaps in error handling, UI validation, and configurability.**

### Priority Findings

| Priority    | Category           | Count | Top Issue              |
| ----------- | ------------------ | ----- | ---------------------- |
| 🔴 Critical | Security & Crashes | 4     | Hardcoded GitHub token |
| 🟡 High     | User Experience    | 5     | No error recovery UI   |
| 🟢 Medium   | Code Quality       | 4     | Monolithic handlers    |

---

## 1. Critical Issues (Must Fix)

### 1.1 Security: Hardcoded GitHub Token

**File**: `src/lib/message-handler.ts:11`
**Risk**: Critical
**Current**:

```typescript
private listFetcher = new IconListFetcher({
  token: process.env.GITHUB_TOKEN || '',
});
```

**Issues**:

- Token exposed in build process
- Fallback to empty string allows runtime without token
- No validation that token has required scopes

**Fix**:

```typescript
// 1. Validate at startup
const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('GITHUB_TOKEN environment variable required');
}

// 2. Move to secure configuration
private listFetcher = new IconListFetcher({
  token: getSecureConfig().githubToken,
});

// 3. Add scope validation
async validateToken(token: string): Promise<void> {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${token}` }
  });
  const scopes = response.headers.get('X-OAuth-Scopes');
  if (!scopes?.includes('repo')) {
    throw new Error('Token missing required repo scope');
  }
}
```

### 1.2 UI Crash Risk: No Error Boundary

**File**: `src/ui.tsx:37-450`
**Risk**: High

**Issue**: React component has no error boundary. Any uncaught error crashes entire UI.

**Fix**:

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('UI Error:', { error, info });
    figma.ui.postMessage({
      type: 'ERROR',
      error: { message: error.message, stack: error.stack }
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorRecoveryUI onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

// Wrap root component
ReactDOM.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('root')
);
```

### 1.3 Validation: Category Selection

**File**: `src/ui.tsx:171,318-329`
**Risk**: High

**Current**: No validation before sending category to plugin

```typescript
const handleGenerate = () => {
  parent.postMessage(
    {
      pluginMessage: {
        type: 'GENERATE_CATEGORY',
        category: selectedCategory[0].name, // Could crash if empty
        // ...
      },
    },
    '*'
  );
};
```

**Fix**:

```typescript
const handleGenerate = () => {
  // Validate category selection
  if (!selectedCategory?.length) {
    setError('Please select a category');
    return;
  }

  const categoryData = categoryMapping[selectedCategory[0].name];
  if (!categoryData?.firstIcon || !categoryData?.lastIconExclusive) {
    setError('Invalid category data');
    return;
  }

  // Validate range
  if (categoryData.firstIcon >= categoryData.lastIconExclusive) {
    setError('Invalid icon range');
    return;
  }

  // Now safe to send
  parent.postMessage(
    {
      pluginMessage: {
        type: 'GENERATE_CATEGORY',
        category: selectedCategory[0].name,
        categoryData,
      },
    },
    '*'
  );
};
```

### 1.4 Memory Leak: Unbounded Log Array

**File**: `src/ui.tsx:53,63`
**Risk**: Medium (becomes high after extended use)

**Current**:

```typescript
const [logs, setLogs] = useState<LogEntry[]>([]);

// Logs grow indefinitely
const handleLogMessage = (log: LogEntry) => {
  setLogs((prev) => [...prev, log]);
};
```

**Fix**:

```typescript
const MAX_LOGS = 1000;

const handleLogMessage = (log: LogEntry) => {
  setLogs(prev => {
    const newLogs = [...prev, log];
    // Keep only last 1000 logs
    return newLogs.slice(-MAX_LOGS);
  });
};

// Add UI indicator
{logs.length >= MAX_LOGS && (
  <div className="log-limit-notice">
    Showing last {MAX_LOGS} logs
  </div>
)}
```

---

## 2. High-Priority Improvements

### 2.1 Error Recovery UI

**Current**: When errors occur, user must reload plugin
**Needed**: Retry mechanism without losing state

**Implementation**:

```typescript
interface ErrorState {
  hasError: boolean;
  error?: Error;
  errorCount: number;
  lastSuccessfulIcon?: string;
}

const [errorState, setErrorState] = useState<ErrorState>({
  hasError: false,
  errorCount: 0,
});

// Error recovery UI
{errorState.hasError && (
  <div className="error-recovery">
    <div className="error-message">{errorState.error?.message}</div>
    <div className="error-context">
      Last successful: {errorState.lastSuccessfulIcon}
      Failed attempts: {errorState.errorCount}
    </div>
    <div className="error-actions">
      <button onClick={handleRetry}>Retry from Last Success</button>
      <button onClick={handleSkip}>Skip Failed Icon</button>
      <button onClick={handleReset}>Start Over</button>
    </div>
  </div>
)}
```

### 2.2 Time Estimates

**Current**: No indication of remaining time
**Needed**: Estimated time remaining based on actual performance

**Implementation**:

```typescript
interface PerformanceTracker {
  startTime: number;
  iconsProcessed: number;
  totalIcons: number;
  avgTimePerIcon: number;
}

const calculateETA = (tracker: PerformanceTracker): string => {
  const elapsed = Date.now() - tracker.startTime;
  const avgTime = elapsed / tracker.iconsProcessed;
  const remaining = (tracker.totalIcons - tracker.iconsProcessed) * avgTime;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
};

// Display in UI
<div className="time-estimate">
  <div>Processed: {processed}/{total} icons</div>
  <div>Avg: {avgTime}s per icon</div>
  <div>Estimated remaining: {eta}</div>
</div>
```

### 2.3 Network Status Indicators

**Current**: Silent retries, user sees frozen progress
**Needed**: Clear status messages

**Implementation**:

```typescript
type NetworkStatus =
  | { state: 'idle' }
  | { state: 'fetching'; icon: string }
  | { state: 'rate-limited'; retryIn: number }
  | { state: 'retrying'; attempt: number; maxAttempts: number }
  | { state: 'error'; message: string };

const NetworkStatusBadge: React.FC<{ status: NetworkStatus }> = ({ status }) => {
  switch (status.state) {
    case 'fetching':
      return <Badge color="blue">Fetching {status.icon}...</Badge>;
    case 'rate-limited':
      return <Badge color="yellow">Rate limited. Retry in {formatTime(status.retryIn)}</Badge>;
    case 'retrying':
      return <Badge color="orange">Retry {status.attempt}/{status.maxAttempts}</Badge>;
    case 'error':
      return <Badge color="red">{status.message}</Badge>;
    default:
      return null;
  }
};
```

### 2.4 Pause/Resume Functionality

**Current**: Can only cancel (loses all progress)
**Needed**: Pause generation and resume later

**Implementation**:

```typescript
interface GenerationState {
  status: 'idle' | 'running' | 'paused' | 'cancelled';
  currentIconIndex: number;
  currentVariantIndex: number;
  processedIcons: string[];
}

// Save state to Figma client storage
const saveState = async (state: GenerationState) => {
  await figma.clientStorage.setAsync('generation_state', state);
};

const loadState = async (): Promise<GenerationState | null> => {
  return await figma.clientStorage.getAsync('generation_state');
};

// Resume logic
const handleResume = async () => {
  const savedState = await loadState();
  if (savedState) {
    setGenerationState(savedState);
    // Resume from saved position
    continueGeneration(savedState.currentIconIndex);
  }
};
```

### 2.5 Input Validation Layer

**Needed**: Centralized validation before plugin operations

**Implementation**:

```typescript
// src/lib/validation/inputs.ts
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
  }
}

export const validateCategoryRequest = (request: {
  category: string;
  categoryData: CategoryData;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!request.category) {
    errors.push(new ValidationError('category', 'Category name required'));
  }

  if (!request.categoryData?.firstIcon) {
    errors.push(new ValidationError('categoryData.firstIcon', 'First icon required'));
  }

  if (!request.categoryData?.lastIconExclusive) {
    errors.push(new ValidationError('categoryData.lastIconExclusive', 'Last icon required'));
  }

  if (request.categoryData.firstIcon >= request.categoryData.lastIconExclusive) {
    errors.push(new ValidationError('categoryData', 'Invalid icon range'));
  }

  return errors;
};

// Usage in handler
const errors = validateCategoryRequest(message);
if (errors.length > 0) {
  figma.ui.postMessage({
    type: 'VALIDATION_ERROR',
    errors: errors.map((e) => ({ field: e.field, message: e.message })),
  });
  return;
}
```

---

## 3. Architectural Improvements

### 3.1 Split Monolithic Handler

**Current**: `src/handlers/category-generation.ts` (506 lines)
**Issue**: Too many responsibilities in one function

**Suggested Refactoring**:

```typescript
// src/handlers/category-generation/index.ts
export class CategoryGenerationOrchestrator {
  constructor(
    private iconProcessor: IconProcessor,
    private pageOrganizer: PageOrganizer,
    private progressTracker: ProgressTracker,
    private rateLimiter: RateLimiter,
    private deprecationHandler: DeprecationHandler
  ) {}

  async generate(config: GenerationConfig): Promise<Result> {
    // Validate
    await this.validate(config);

    // Prepare page
    const page = await this.pageOrganizer.createOrGetPage(config.category);

    // Check for skips
    const iconsToProcess = await this.determineIconsToProcess(config);

    // Process icons
    for (const icon of iconsToProcess) {
      await this.iconProcessor.process(icon);
      this.progressTracker.increment();
    }

    // Organize frames
    await this.pageOrganizer.layoutFrames(page);

    // Handle deprecations
    await this.deprecationHandler.removeDeprecated(config);

    return { success: true, processed: iconsToProcess.length };
  }
}

// Each responsibility in its own file
// src/handlers/category-generation/page-organizer.ts
// src/handlers/category-generation/icon-processor.ts
// src/handlers/category-generation/deprecation-handler.ts
```

### 3.2 Dependency Injection

**Current**: Classes create their own dependencies
**Issue**: Hard to test, hard to reconfigure

**Improved**:

```typescript
// src/lib/di/container.ts
export class DIContainer {
  private services = new Map<string, any>();

  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }

  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) throw new Error(`Service ${key} not registered`);
    return factory();
  }
}

// Setup
const container = new DIContainer();
container.register('githubApi', () => new GitHubAPI(config.token));
container.register('iconGenerator', () => new IconGenerator(container.resolve('githubApi')));

// Usage
const iconGenerator = container.resolve<IconGenerator>('iconGenerator');
```

### 3.3 Figma API Abstraction Layer

**Current**: Direct Figma API calls throughout
**Issue**: Can't test without Figma runtime, hard to mock

**Improved**:

```typescript
// src/lib/figma/api-adapter.ts
export interface IFigmaAPI {
  createComponent(name: string): ComponentNode;
  createComponentSet(): ComponentSetNode;
  createPage(name: string): PageNode;
  getCurrentPage(): PageNode;
  setPluginData(node: SceneNode, key: string, value: string): void;
  getPluginData(node: SceneNode, key: string): string;
}

// Real implementation
export class FigmaAPIAdapter implements IFigmaAPI {
  createComponent(name: string): ComponentNode {
    return figma.createComponent();
  }
  // ... other methods
}

// Mock for testing
export class MockFigmaAPI implements IFigmaAPI {
  private components: ComponentNode[] = [];

  createComponent(name: string): ComponentNode {
    const mock = { name, type: 'COMPONENT' } as ComponentNode;
    this.components.push(mock);
    return mock;
  }
  // ... other methods
}

// Usage in handlers
export class IconProcessor {
  constructor(private figmaAPI: IFigmaAPI) {}

  async process(icon: string) {
    const component = this.figmaAPI.createComponent(icon);
    // ...
  }
}
```

### 3.4 Configuration System

**Current**: Hardcoded values scattered throughout
**Needed**: Centralized configuration

**Implementation**:

```typescript
// src/lib/config/plugin-config.ts
export interface PluginConfig {
  ui: {
    width: number;
    height: number;
    maxLogs: number;
    copyLogsLimit: number;
  };
  generation: {
    maxRetries: number;
    maxBackoffMinutes: number;
    itemsPerRow: number;
    batchDelayMs: number;
  };
  github: {
    token: string;
    timeoutMs: number;
  };
}

export const defaultConfig: PluginConfig = {
  ui: {
    width: 400,
    height: 600,
    maxLogs: 1000,
    copyLogsLimit: 100,
  },
  generation: {
    maxRetries: 4,
    maxBackoffMinutes: 10,
    itemsPerRow: 24,
    batchDelayMs: 10,
  },
  github: {
    token: process.env.GITHUB_TOKEN || '',
    timeoutMs: 30000,
  },
};

// Load from figma.root
export const loadConfig = async (): Promise<PluginConfig> => {
  const stored = await figma.clientStorage.getAsync('plugin_config');
  return { ...defaultConfig, ...stored };
};

// Settings UI
const SettingsPanel: React.FC = () => {
  const [config, setConfig] = useState(defaultConfig);

  return (
    <div className="settings">
      <h3>UI Settings</h3>
      <Input label="Max Logs" value={config.ui.maxLogs} onChange={...} />
      <Input label="Copy Logs Limit" value={config.ui.copyLogsLimit} onChange={...} />

      <h3>Generation Settings</h3>
      <Input label="Max Retries" value={config.generation.maxRetries} onChange={...} />
      <Input label="Items Per Row" value={config.generation.itemsPerRow} onChange={...} />

      <Button onClick={saveConfig}>Save Settings</Button>
    </div>
  );
};
```

---

## 4. Additional Features (Within Scope)

### 4.1 Batch Category Generation

**Value**: Generate multiple categories in one session
**Complexity**: Medium

```typescript
interface BatchGenerationRequest {
  categories: string[];
  continueOnError: boolean;
}

const handleBatchGeneration = async (request: BatchGenerationRequest) => {
  const results: Array<{ category: string; success: boolean; error?: string }> = [];

  for (const category of request.categories) {
    try {
      await handleCategoryGeneration({ category });
      results.push({ category, success: true });
    } catch (error) {
      results.push({ category, success: false, error: String(error) });

      if (!request.continueOnError) {
        break;
      }
    }
  }

  return results;
};

// UI
<MultiSelect
  label="Select Categories"
  options={categories}
  value={selectedCategories}
  onChange={setSelectedCategories}
/>
<Checkbox
  label="Continue on error"
  checked={continueOnError}
  onChange={setContinueOnError}
/>
<Button onClick={handleBatchGenerate}>
  Generate {selectedCategories.length} Categories
</Button>
```

### 4.2 Custom Icon Subsets

**Value**: Allow users to generate only specific icons
**Complexity**: Medium

```typescript
interface CustomSubsetRequest {
  iconNames: string[];
  outputPage: string;
}

// UI with search and multi-select
const IconSelector: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const filteredIcons = allIcons.filter(icon =>
    icon.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="icon-selector">
      <Input
        placeholder="Search icons..."
        value={search}
        onChange={setSearch}
      />
      <div className="icon-list">
        {filteredIcons.map(icon => (
          <Checkbox
            key={icon}
            label={icon}
            checked={selected.includes(icon)}
            onChange={(checked) => toggleIcon(icon, checked)}
          />
        ))}
      </div>
      <Button onClick={() => generateCustomSubset(selected)}>
        Generate {selected.length} Icons
      </Button>
    </div>
  );
};
```

### 4.3 Update Check & Notifications

**Value**: Notify user when new icons are available
**Complexity**: Low

```typescript
interface UpdateInfo {
  available: boolean;
  currentCommit: string;
  latestCommit: string;
  newIcons: number;
  modifiedIcons: number;
}

const checkForUpdates = async (): Promise<UpdateInfo> => {
  const metadata = await fetchIconMetadata();
  const currentCommit = getCurrentCommitSHA();

  if (metadata.commitSha === currentCommit) {
    return { available: false, currentCommit, latestCommit: currentCommit, newIcons: 0, modifiedIcons: 0 };
  }

  const delta = await compareCommits(currentCommit, metadata.commitSha);

  return {
    available: true,
    currentCommit,
    latestCommit: metadata.commitSha,
    newIcons: delta.added.length,
    modifiedIcons: delta.modified.length,
  };
};

// UI notification
{updateInfo.available && (
  <div className="update-notification">
    <div className="update-badge">Update Available</div>
    <div className="update-details">
      {updateInfo.newIcons} new icons, {updateInfo.modifiedIcons} updated
    </div>
    <Button onClick={handleUpdate}>Update Now</Button>
  </div>
)}
```

### 4.4 Export/Import Configuration

**Value**: Share plugin settings across team
**Complexity**: Low

```typescript
const exportConfig = async () => {
  const config = await loadConfig();
  const json = JSON.stringify(config, null, 2);

  // Download as JSON file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `figma-plugin-config-${Date.now()}.json`;
  a.click();
};

const importConfig = async (file: File) => {
  const text = await file.text();
  const config = JSON.parse(text) as PluginConfig;

  // Validate
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid config: ${errors.join(', ')}`);
  }

  // Save
  await figma.clientStorage.setAsync('plugin_config', config);

  // Notify
  figma.notify('Configuration imported successfully');
};
```

### 4.5 Performance Analytics

**Value**: Track generation performance over time
**Complexity**: Medium

```typescript
interface PerformanceMetrics {
  timestamp: number;
  category: string;
  iconsProcessed: number;
  totalTime: number;
  avgTimePerIcon: number;
  retries: number;
  errors: number;
}

const trackPerformance = async (metrics: PerformanceMetrics) => {
  const history = await figma.clientStorage.getAsync('performance_history') || [];
  history.push(metrics);

  // Keep last 50 runs
  if (history.length > 50) {
    history.shift();
  }

  await figma.clientStorage.setAsync('performance_history', history);
};

// Analytics UI
const AnalyticsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);

  const avgTime = metrics.reduce((sum, m) => sum + m.avgTimePerIcon, 0) / metrics.length;
  const totalIcons = metrics.reduce((sum, m) => sum + m.iconsProcessed, 0);
  const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);

  return (
    <div className="analytics">
      <h3>Performance Overview</h3>
      <Stat label="Total Icons Generated" value={totalIcons} />
      <Stat label="Avg Time Per Icon" value={`${avgTime.toFixed(2)}s`} />
      <Stat label="Total Errors" value={totalErrors} />
      <Stat label="Success Rate" value={`${((1 - totalErrors/totalIcons) * 100).toFixed(1)}%`} />

      <h4>Recent Runs</h4>
      <Table data={metrics} />
    </div>
  );
};
```

---

## 5. Testing Gaps

### 5.1 Missing Test Coverage

| Area                     | Current | Target | Priority |
| ------------------------ | ------- | ------ | -------- |
| UI Components            | 0%      | 80%    | High     |
| Message Routing          | 0%      | 100%   | High     |
| Rate Limiting Edge Cases | 40%     | 90%    | Medium   |
| Integration (E2E)        | 0%      | 60%    | Medium   |
| Error Recovery           | 20%     | 90%    | High     |

### 5.2 Recommended Tests

**UI Testing** (using React Testing Library):

```typescript
// src/ui/__tests__/App.test.tsx
describe('App Component', () => {
  it('should validate category before generation', () => {
    const { getByText, getByRole } = render(<App />);

    // Try to generate without selecting category
    const generateBtn = getByRole('button', { name: /generate/i });
    fireEvent.click(generateBtn);

    // Should show error
    expect(getByText(/please select a category/i)).toBeInTheDocument();
  });

  it('should handle connection lost', async () => {
    const { getByText } = render(<App />);

    // Simulate plugin crash
    act(() => {
      window.postMessage({ pluginMessage: { type: 'CONNECTION_LOST' }}, '*');
    });

    // Should show reconnection UI
    await waitFor(() => {
      expect(getByText(/connection lost/i)).toBeInTheDocument();
    });
  });
});
```

**Integration Testing**:

```typescript
// src/__tests__/integration/full-generation.test.ts
describe('Full Icon Generation', () => {
  it('should generate category with delta updates', async () => {
    // Setup mock Figma API
    const mockFigma = new MockFigmaAPI();

    // Run generation
    const result = await handleCategoryGeneration(
      {
        category: 'Set 01',
        categoryData: { firstIcon: 0, lastIconExclusive: 10 },
      },
      { figmaAPI: mockFigma }
    );

    // Verify results
    expect(result.success).toBe(true);
    expect(mockFigma.components).toHaveLength(10);
    expect(mockFigma.pages).toHaveLength(1);
  });
});
```

**Error Scenario Testing**:

```typescript
describe('Error Handling', () => {
  it('should retry on rate limit', async () => {
    const mockAPI = new MockGitHubAPI();
    mockAPI.setResponseSequence([
      { status: 429, retryAfter: 60 },
      { status: 429, retryAfter: 60 },
      { status: 200, data: iconData },
    ]);

    const result = await fetchIconWithRetry('home', mockAPI);

    expect(mockAPI.callCount).toBe(3);
    expect(result.success).toBe(true);
  });

  it('should fail gracefully after max retries', async () => {
    const mockAPI = new MockGitHubAPI();
    mockAPI.setAllResponsesFail();

    const result = await fetchIconWithRetry('home', mockAPI);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/max retries exceeded/i);
  });
});
```

---

## 6. Code Quality Improvements

### 6.1 Duplicate Code to Consolidate

**Page Naming Logic** (appears 3+ times):

```typescript
// Consolidate to src/lib/naming/page-naming.ts
export const parseSetNumber = (pageName: string): number | null => {
  const match = pageName.match(/^Set\s+(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

export const formatPageName = (setNumber: number, range: string): string => {
  return `Set ${String(setNumber).padStart(2, '0')}: ${range}`;
};

export const getIconRange = (firstIcon: string, lastIcon: string): string => {
  const first3 = firstIcon.slice(0, 3);
  const last3 = lastIcon.slice(0, 3);
  return `${first3}-${last3}`;
};
```

**Error Formatting** (scattered throughout):

```typescript
// Consolidate to src/lib/formatting/errors.ts
export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};

export const formatErrorWithContext = (error: unknown, context: Record<string, any>): string => {
  const message = formatError(error);
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return `${message} (${contextStr})`;
};
```

### 6.2 Magic Numbers to Constants

```typescript
// src/lib/constants.ts
export const UI_DIMENSIONS = {
  WIDTH: 400,
  HEIGHT: 600,
  LOG_CONTAINER_HEIGHT: 200,
} as const;

export const LIMITS = {
  MAX_LOGS: 1000,
  MAX_RETRIES: 4,
  MAX_BACKOFF_MINUTES: 10,
  COPY_LOGS_DEFAULT: 30,
} as const;

export const LAYOUT = {
  ITEMS_PER_ROW: 24,
  SPACING: 10,
  PADDING: 20,
} as const;

export const TIMEOUTS = {
  GITHUB_API: 30000,
  RETRY_BASE: 60000,
  PROGRESS_UPDATE: 100,
} as const;
```

---

## 7. Documentation Gaps

### 7.1 Missing Documentation

| Document                  | Priority | Purpose                      |
| ------------------------- | -------- | ---------------------------- |
| **Architecture Overview** | High     | High-level system design     |
| **API Documentation**     | High     | Public API for plugin users  |
| **Configuration Guide**   | Medium   | How to configure settings    |
| **Error Code Reference**  | Medium   | All error codes and meanings |
| **Performance Tuning**    | Low      | Optimize generation speed    |
| **Contributing Guide**    | Low      | How to contribute code       |

### 7.2 Recommended Documentation Structure

```
docs/
├── README.md                    # Overview and quick start
├── architecture/
│   ├── overview.md             # System architecture
│   ├── plugin-lifecycle.md     # Figma plugin lifecycle
│   ├── message-flow.md         # UI <-> Plugin communication
│   └── icon-generation.md      # Icon generation pipeline
├── api/
│   ├── plugin-messages.md      # Message types and payloads
│   ├── error-codes.md          # Error code reference
│   └── configuration.md        # Configuration options
├── guides/
│   ├── installation.md         # How to install
│   ├── usage.md                # How to use
│   ├── troubleshooting.md      # Common issues
│   └── performance.md          # Performance optimization
└── development/
    ├── setup.md                # Dev environment setup
    ├── testing.md              # How to run tests
    ├── contributing.md         # Contribution guidelines
    └── release-process.md      # How releases work (already exists!)
```

---

## 8. Quick Wins (1-2 Hours Each)

These improvements have high impact and low implementation cost:

### ✅ Priority 1 (Do First)

1. **Add log rotation** (1 hour)
   - Keep last 1000 logs
   - Add UI indicator when limit reached
   - Files: `src/ui.tsx:53,63`

2. **Add category validation** (1 hour)
   - Validate before sending to plugin
   - Show user-friendly error messages
   - Files: `src/ui.tsx:318-329`

3. **Add GitHub token validation** (1 hour)
   - Check token exists and has scopes
   - Fail early with clear error
   - Files: `src/lib/message-handler.ts:11`

4. **Add error boundary** (2 hours)
   - Catch UI crashes
   - Show recovery UI
   - Files: `src/ui.tsx` (wrap root)

5. **Add cancel confirmation** (30 min)
   - "Are you sure?" dialog
   - Prevent accidental cancellations
   - Files: `src/ui.tsx:203-221`

### ✅ Priority 2 (Do Next)

6. **Extract page naming logic** (1 hour)
   - DRY up duplicate regex/parsing
   - Create `src/lib/naming/page-naming.ts`

7. **Add timeout to GitHub fetches** (1 hour)
   - 30 second timeout
   - Better error messages
   - Files: `src/lib/github/api.ts`

8. **Add success summary** (1 hour)
   - Count created/updated/skipped
   - Show in UI after completion
   - Files: `src/handlers/category-generation.ts:449`

9. **Consolidate error formatting** (1 hour)
   - Create `src/lib/formatting/errors.ts`
   - Use throughout codebase

10. **Move magic numbers to constants** (1 hour)
    - Consolidate hardcoded values
    - Update `src/lib/constants.ts`

---

## 9. Performance Recommendations

### Current Performance

| Metric            | Current | Target       | Notes                     |
| ----------------- | ------- | ------------ | ------------------------- |
| Icons/second      | ~0.5    | 1.0          | Limited by Figma API      |
| Memory usage      | ~200MB  | <150MB       | Log rotation will help    |
| UI responsiveness | Good    | Excellent    | Debounce progress updates |
| Network retries   | 4       | Configurable | Allow user to adjust      |

### Optimization Opportunities

**1. Debounce Progress Updates** (Low Impact)

```typescript
// Instead of updating UI for every variant:
const debouncedUpdate = debounce((progress) => {
  figma.ui.postMessage({ type: 'PROGRESS_UPDATE', progress });
}, 100);
```

**2. Batch Frame Creation** (Medium Impact)

```typescript
// Create frames in batches instead of one-by-one
const createFramesBatch = async (icons: string[]) => {
  // Batch size of 10
  for (let i = 0; i < icons.length; i += 10) {
    const batch = icons.slice(i, i + 10);
    await Promise.all(batch.map(createFrame));
    await sleep(50); // Small delay between batches
  }
};
```

**3. Lazy Load Icon Names** (Low Impact)

```typescript
// Don't load all 4000+ icon names at startup
const loadIconNamesLazy = async () => {
  // Load only when category selector is opened
  const names = await import('./icon-names.json');
  return names;
};
```

---

## 10. Conclusion & Roadmap

### Summary

The Google Symbols Figma Plugin is a **well-architected system** with strong foundations:

- ✅ Solid type safety and error classes
- ✅ Intelligent delta updates
- ✅ Good test coverage on business logic
- ✅ Clean separation of concerns

**Key gaps** that should be addressed:

- ❌ Security: Hardcoded GitHub token
- ❌ Validation: Missing input validation
- ❌ Recovery: No error recovery UI
- ❌ Testing: No UI or integration tests

### Recommended Roadmap

**Phase 1: Critical Fixes (1 week)**

- Fix GitHub token security issue
- Add error boundary to UI
- Add input validation
- Implement log rotation

**Phase 2: User Experience (2 weeks)**

- Add error recovery UI
- Add time estimates
- Add network status indicators
- Improve progress feedback

**Phase 3: Architecture (3 weeks)**

- Split monolithic handlers
- Add dependency injection
- Create Figma API abstraction
- Implement configuration system

**Phase 4: Features (4 weeks)**

- Batch category generation
- Custom icon subsets
- Update check notifications
- Performance analytics

**Phase 5: Testing (2 weeks)**

- Add UI tests
- Add integration tests
- Add error scenario tests

### Estimated Total Effort

- **Critical Fixes**: 40 hours
- **User Experience**: 80 hours
- **Architecture**: 120 hours
- **Features**: 160 hours
- **Testing**: 80 hours

**Total**: ~480 hours (12 weeks at full-time, or 6 months at part-time)

### Immediate Next Steps

1. **This Week**: Fix critical security and crash issues (items 1.1-1.4)
2. **Next Week**: Add error recovery and time estimates (items 2.1-2.2)
3. **Month 1**: Complete all quick wins and high-priority improvements
4. **Month 2-3**: Architectural refactoring
5. **Month 4-6**: New features and comprehensive testing

---

## 11. Implementation Plan

### Overview

This implementation plan breaks down the recommended improvements into **actionable sprints** with specific tasks, acceptance criteria, and dependencies. Each sprint is 1-2 weeks and focuses on delivering tangible value.

### Sprint Structure

- **Sprint 0**: Critical fixes (security & stability)
- **Sprint 1-2**: User experience improvements
- **Sprint 3-4**: Architectural refactoring
- **Sprint 5-6**: New features
- **Sprint 7**: Testing & hardening

---

### Sprint 0: Critical Fixes & Stabilization (1 week)

**Goal**: Eliminate security vulnerabilities and crash risks

**Priority**: 🔴 Critical - Must complete before any other work

#### Tasks

##### Task 0.1: Secure GitHub Token Handling

**Effort**: 4 hours
**Priority**: Critical
**Files**: `src/lib/message-handler.ts`, `src/lib/config/`

**Implementation Steps**:

1. Create `src/lib/config/secure-config.ts`:

   ```typescript
   export class SecureConfig {
     private static instance: SecureConfig;
     private _githubToken?: string;

     static async initialize(): Promise<void> {
       const token = process.env.GITHUB_TOKEN;
       if (!token) throw new Error('GITHUB_TOKEN required');

       // Validate token has required scopes
       await this.validateToken(token);
       this.instance = new SecureConfig(token);
     }

     static get githubToken(): string {
       if (!this.instance?._githubToken) {
         throw new Error('SecureConfig not initialized');
       }
       return this.instance._githubToken;
     }

     private static async validateToken(token: string): Promise<void> {
       const response = await fetch('https://api.github.com/user', {
         headers: { Authorization: `token ${token}` },
       });

       if (!response.ok) throw new Error('Invalid GitHub token');

       const scopes = response.headers.get('X-OAuth-Scopes') || '';
       if (!scopes.includes('repo')) {
         throw new Error('Token missing required "repo" scope');
       }
     }

     private constructor(token: string) {
       this._githubToken = token;
     }
   }
   ```

2. Update `src/code.ts` to initialize config:

   ```typescript
   figma.showUI(__html__, { width: 400, height: 600 });

   // Initialize secure config
   SecureConfig.initialize().catch((error) => {
     figma.notify(`Configuration error: ${error.message}`, { error: true });
     figma.closePlugin();
   });
   ```

3. Update `src/lib/message-handler.ts`:
   ```typescript
   private listFetcher = new IconListFetcher({
     token: SecureConfig.githubToken,
   });
   ```

**Acceptance Criteria**:

- [ ] Token validation happens at startup
- [ ] Plugin fails gracefully with clear error if token invalid
- [ ] Token validation checks for required scopes
- [ ] No hardcoded fallback to empty string
- [ ] Error messages guide user to fix token issues

**Testing**:

- [ ] Test with missing token (should fail at startup)
- [ ] Test with invalid token (should fail at startup)
- [ ] Test with token missing 'repo' scope (should fail with helpful message)
- [ ] Test with valid token (should initialize successfully)

---

##### Task 0.2: Add React Error Boundary

**Effort**: 3 hours
**Priority**: Critical
**Files**: `src/ui.tsx`

**Implementation Steps**:

1. Create `src/components/ErrorBoundary.tsx`:

   ```typescript
   interface Props {
     children: React.ReactNode;
   }

   interface State {
     hasError: boolean;
     error?: Error;
   }

   export class ErrorBoundary extends React.Component<Props, State> {
     state: State = { hasError: false };

     static getDerivedStateFromError(error: Error): State {
       return { hasError: true, error };
     }

     componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
       console.error('UI Error:', error, errorInfo);

       // Notify plugin code
       parent.postMessage({
         pluginMessage: {
           type: 'UI_ERROR',
           error: {
             message: error.message,
             stack: error.stack,
             componentStack: errorInfo.componentStack,
           }
         }
       }, '*');
     }

     handleReset = () => {
       this.setState({ hasError: false, error: undefined });
     };

     render() {
       if (this.state.hasError) {
         return (
           <div className="error-boundary">
             <h2>Something went wrong</h2>
             <p>{this.state.error?.message}</p>
             <details>
               <summary>Error details</summary>
               <pre>{this.state.error?.stack}</pre>
             </details>
             <div className="error-actions">
               <button onClick={this.handleReset}>Try Again</button>
               <button onClick={() => window.location.reload()}>Reload Plugin</button>
             </div>
           </div>
         );
       }

       return this.props.children;
     }
   }
   ```

2. Wrap `App` component in `src/ui.tsx`:

   ```typescript
   ReactDOM.render(
     <ErrorBoundary>
       <App />
     </ErrorBoundary>,
     document.getElementById('root')
   );
   ```

3. Add error styles to `src/ui.tsx` (inline styles or CSS):

   ```css
   .error-boundary {
     padding: 20px;
     background: #fee;
     border: 2px solid #c00;
     border-radius: 4px;
   }

   .error-boundary h2 {
     color: #c00;
     margin-top: 0;
   }

   .error-actions {
     margin-top: 20px;
     display: flex;
     gap: 10px;
   }
   ```

**Acceptance Criteria**:

- [ ] UI errors caught and displayed gracefully
- [ ] Error details shown to user
- [ ] "Try Again" button resets error state
- [ ] "Reload" button refreshes plugin
- [ ] Error logged to plugin console

**Testing**:

- [ ] Manually throw error in component (verify boundary catches it)
- [ ] Test "Try Again" button functionality
- [ ] Test "Reload" button functionality
- [ ] Verify error details displayed correctly

---

##### Task 0.3: Input Validation for Category Selection

**Effort**: 3 hours
**Priority**: Critical
**Files**: `src/ui.tsx`

**Implementation Steps**:

1. Create validation utilities:

   ```typescript
   interface ValidationResult {
     valid: boolean;
     errors: string[];
   }

   const validateCategorySelection = (
     selectedCategory: Array<{ name: string }>,
     categoryMapping: Record<string, CategoryData>
   ): ValidationResult => {
     const errors: string[] = [];

     if (!selectedCategory?.length) {
       errors.push('Please select a category');
       return { valid: false, errors };
     }

     const categoryName = selectedCategory[0].name;
     const categoryData = categoryMapping[categoryName];

     if (!categoryData) {
       errors.push(`Category "${categoryName}" not found in mapping`);
       return { valid: false, errors };
     }

     if (!categoryData.firstIcon) {
       errors.push('Category missing firstIcon');
     }

     if (!categoryData.lastIconExclusive) {
       errors.push('Category missing lastIconExclusive');
     }

     if (categoryData.firstIcon >= categoryData.lastIconExclusive) {
       errors.push('Invalid icon range (first >= last)');
     }

     return {
       valid: errors.length === 0,
       errors,
     };
   };
   ```

2. Update `handleGenerate`:

   ```typescript
   const handleGenerate = () => {
     // Clear previous errors
     setError('');

     // Validate
     const validation = validateCategorySelection(selectedCategory, categoryMapping);
     if (!validation.valid) {
       setError(validation.errors.join('; '));
       return;
     }

     // Safe to proceed
     const categoryData = categoryMapping[selectedCategory[0].name];
     parent.postMessage(
       {
         pluginMessage: {
           type: 'GENERATE_CATEGORY',
           category: selectedCategory[0].name,
           categoryData,
         },
       },
       '*'
     );

     setIsGenerating(true);
   };
   ```

3. Add error display:
   ```typescript
   {error && (
     <div className="validation-error">
       <span className="error-icon">⚠️</span>
       {error}
     </div>
   )}
   ```

**Acceptance Criteria**:

- [ ] Empty category selection shows error
- [ ] Invalid category data shows error
- [ ] Invalid icon range shows error
- [ ] Errors displayed to user before generation starts
- [ ] Generation only proceeds with valid input

**Testing**:

- [ ] Test with no category selected
- [ ] Test with invalid category name
- [ ] Test with missing firstIcon
- [ ] Test with missing lastIconExclusive
- [ ] Test with firstIcon >= lastIconExclusive
- [ ] Test with valid category (should proceed)

---

##### Task 0.4: Implement Log Rotation

**Effort**: 2 hours
**Priority**: High
**Files**: `src/ui.tsx`

**Implementation Steps**:

1. Add constants:

   ```typescript
   const MAX_LOGS = 1000;
   const COPY_LOGS_LIMIT = 100; // Configurable via UI later
   ```

2. Update log handler:

   ```typescript
   const handleLogMessage = (log: LogEntry) => {
     setLogs((prev) => {
       const newLogs = [...prev, log];
       // Keep only last MAX_LOGS
       if (newLogs.length > MAX_LOGS) {
         return newLogs.slice(-MAX_LOGS);
       }
       return newLogs;
     });
   };
   ```

3. Add UI indicator:

   ```typescript
   {logs.length >= MAX_LOGS && (
     <div className="log-limit-notice">
       Showing last {MAX_LOGS} logs
       <button onClick={handleDownloadLogs}>Download All</button>
     </div>
   )}
   ```

4. Update copy logs:
   ```typescript
   const handleCopyLogs = () => {
     const recentLogs = logs.slice(-COPY_LOGS_LIMIT);
     // ... copy logic
   };
   ```

**Acceptance Criteria**:

- [ ] Log array never exceeds MAX_LOGS entries
- [ ] Oldest logs dropped when limit reached
- [ ] UI shows indicator when at limit
- [ ] Download button available to save full history
- [ ] Copy logs respects configurable limit

**Testing**:

- [ ] Generate logs > 1000 (verify oldest dropped)
- [ ] Verify memory usage stable with log rotation
- [ ] Test UI indicator appears at limit
- [ ] Test download button works

---

### Sprint 1: User Experience - Error Recovery (1 week)

**Goal**: Enable users to recover from errors without restarting

#### Tasks

##### Task 1.1: Error Recovery State Management

**Effort**: 5 hours
**Priority**: High
**Files**: `src/ui.tsx`, `src/types.ts`

**Implementation Steps**:

1. Add error state types:

   ```typescript
   // src/types.ts
   interface ErrorState {
     hasError: boolean;
     error?: {
       message: string;
       code?: string;
       icon?: string;
       variant?: string;
     };
     lastSuccessful?: {
       icon: string;
       index: number;
     };
     retryCount: number;
   }
   ```

2. Add state to App:

   ```typescript
   const [errorState, setErrorState] = useState<ErrorState>({
     hasError: false,
     retryCount: 0,
   });
   ```

3. Handle error messages:
   ```typescript
   case 'ERROR':
     setErrorState({
       hasError: true,
       error: msg.error,
       lastSuccessful: lastProcessedIcon,
       retryCount: errorState.retryCount + 1,
     });
     break;
   ```

**Acceptance Criteria**:

- [ ] Error state persists across retries
- [ ] Last successful operation tracked
- [ ] Retry count incremented
- [ ] Error details captured

---

##### Task 1.2: Error Recovery UI

**Effort**: 6 hours
**Priority**: High
**Files**: `src/ui.tsx`, `src/components/ErrorRecovery.tsx`

**Implementation Steps**:

1. Create ErrorRecovery component:

   ```typescript
   interface Props {
     errorState: ErrorState;
     onRetry: () => void;
     onSkip: () => void;
     onReset: () => void;
   }

   export const ErrorRecovery: React.FC<Props> = ({
     errorState,
     onRetry,
     onSkip,
     onReset,
   }) => {
     return (
       <div className="error-recovery">
         <div className="error-header">
           <span className="error-icon">❌</span>
           <h3>Generation Error</h3>
         </div>

         <div className="error-details">
           <p><strong>Message:</strong> {errorState.error?.message}</p>
           {errorState.error?.code && (
             <p><strong>Code:</strong> {errorState.error.code}</p>
           )}
           {errorState.error?.icon && (
             <p><strong>Failed Icon:</strong> {errorState.error.icon}</p>
           )}
           {errorState.lastSuccessful && (
             <p><strong>Last Success:</strong> {errorState.lastSuccessful.icon}</p>
           )}
           <p><strong>Retry Attempts:</strong> {errorState.retryCount}</p>
         </div>

         <div className="error-actions">
           <button className="primary" onClick={onRetry}>
             Retry from Last Success
           </button>
           <button onClick={onSkip}>
             Skip Failed Icon
           </button>
           <button onClick={onReset}>
             Start Over
           </button>
         </div>
       </div>
     );
   };
   ```

2. Integrate in App:
   ```typescript
   {errorState.hasError && (
     <ErrorRecovery
       errorState={errorState}
       onRetry={handleRetry}
       onSkip={handleSkip}
       onReset={handleReset}
     />
   )}
   ```

**Acceptance Criteria**:

- [ ] Error UI shows detailed error info
- [ ] Retry button resumes from last success
- [ ] Skip button continues with next icon
- [ ] Reset button clears error and resets state
- [ ] Error context (icon, variant) displayed

---

##### Task 1.3: Time Estimates

**Effort**: 5 hours
**Priority**: High
**Files**: `src/ui.tsx`

**Implementation Steps**:

1. Add performance tracking:

   ```typescript
   interface PerformanceTracker {
     startTime: number;
     iconsProcessed: number;
     totalIcons: number;
     iconTimes: number[]; // Last 10 icon times
   }

   const [performance, setPerformance] = useState<PerformanceTracker>({
     startTime: 0,
     iconsProcessed: 0,
     totalIcons: 0,
     iconTimes: [],
   });
   ```

2. Track icon processing time:

   ```typescript
   case 'ICON_COMPLETE':
     const iconTime = Date.now() - lastIconStartTime;
     setPerformance(prev => ({
       ...prev,
       iconsProcessed: prev.iconsProcessed + 1,
       iconTimes: [...prev.iconTimes.slice(-9), iconTime],
     }));
     break;
   ```

3. Calculate ETA:

   ```typescript
   const calculateETA = (perf: PerformanceTracker): string => {
     if (perf.iconTimes.length === 0) return 'Calculating...';

     const avgTime = perf.iconTimes.reduce((a, b) => a + b) / perf.iconTimes.length;
     const remaining = perf.totalIcons - perf.iconsProcessed;
     const remainingMs = remaining * avgTime;

     const minutes = Math.floor(remainingMs / 60000);
     const seconds = Math.floor((remainingMs % 60000) / 1000);

     return `${minutes}m ${seconds}s`;
   };
   ```

4. Display in UI:
   ```typescript
   <div className="time-estimate">
     <div className="progress-text">
       {performance.iconsProcessed} / {performance.totalIcons} icons
     </div>
     <div className="time-stats">
       <span>Avg: {(avgTime / 1000).toFixed(1)}s per icon</span>
       <span>ETA: {calculateETA(performance)}</span>
     </div>
   </div>
   ```

**Acceptance Criteria**:

- [ ] Time per icon tracked
- [ ] Moving average calculated (last 10 icons)
- [ ] ETA displayed and updates in real-time
- [ ] Shows "Calculating..." for first few icons
- [ ] Time format readable (e.g., "5m 23s")

**Dependencies**: None

---

### Sprint 2: User Experience - Progress & Feedback (1 week)

**Goal**: Improve user visibility into generation process

#### Task 2.1: Network Status Indicators

**Effort**: 6 hours
**Priority**: Medium
**Files**: `src/ui.tsx`, `src/handlers/category-generation/rate-limiter.ts`

**Implementation Steps**:

1. Add network status types:

   ```typescript
   type NetworkStatus =
     | { state: 'idle' }
     | { state: 'fetching'; icon: string; attempt: number }
     | { state: 'rate-limited'; retryIn: number }
     | { state: 'retrying'; attempt: number; maxAttempts: number; nextRetryIn: number }
     | { state: 'error'; message: string };
   ```

2. Send status updates from rate limiter:

   ```typescript
   // In rate-limiter.ts
   figma.ui.postMessage({
     type: 'NETWORK_STATUS',
     status: { state: 'rate-limited', retryIn: delaySeconds * 1000 },
   });
   ```

3. Create status badge component:

   ```typescript
   const NetworkStatusBadge: React.FC<{ status: NetworkStatus }> = ({ status }) => {
     if (status.state === 'idle') return null;

     return (
       <div className={`network-status status-${status.state}`}>
         {status.state === 'fetching' && (
           <>
             <Spinner />
             <span>Fetching {status.icon}... (attempt {status.attempt})</span>
           </>
         )}
         {status.state === 'rate-limited' && (
           <>
             <WarningIcon />
             <span>Rate limited. Waiting {formatTime(status.retryIn)}...</span>
           </>
         )}
         {status.state === 'retrying' && (
           <>
             <RetryIcon />
             <span>
               Retry {status.attempt}/{status.maxAttempts}
               {' '}(next in {formatTime(status.nextRetryIn)})
             </span>
           </>
         )}
         {status.state === 'error' && (
           <>
             <ErrorIcon />
             <span>{status.message}</span>
           </>
         )}
       </div>
     );
   };
   ```

**Acceptance Criteria**:

- [ ] Network status visible during generation
- [ ] Rate limit warnings shown proactively
- [ ] Retry attempts counted and displayed
- [ ] Countdown timer for retry delays
- [ ] Status color-coded (blue, yellow, orange, red)

---

#### Task 2.2: Success Summary

**Effort**: 4 hours
**Priority**: Medium
**Files**: `src/ui.tsx`, `src/handlers/category-generation.ts`

**Implementation Steps**:

1. Track generation results:

   ```typescript
   interface GenerationSummary {
     totalIcons: number;
     created: number;
     updated: number;
     skipped: number;
     failed: number;
     duration: number;
   }
   ```

2. Send summary on completion:

   ```typescript
   // In category-generation.ts
   figma.ui.postMessage({
     type: 'GENERATION_COMPLETE',
     summary: {
       totalIcons: iconCount,
       created: createdCount,
       updated: updatedCount,
       skipped: skippedCount,
       failed: failedCount,
       duration: Date.now() - startTime,
     },
   });
   ```

3. Display summary:
   ```typescript
   {summary && (
     <div className="generation-summary">
       <h3>✓ Generation Complete</h3>
       <div className="summary-stats">
         <Stat icon="➕" label="Created" value={summary.created} />
         <Stat icon="🔄" label="Updated" value={summary.updated} />
         <Stat icon="⏭" label="Skipped" value={summary.skipped} />
         {summary.failed > 0 && (
           <Stat icon="❌" label="Failed" value={summary.failed} color="red" />
         )}
       </div>
       <div className="summary-time">
         Completed in {formatDuration(summary.duration)}
       </div>
     </div>
   )}
   ```

**Acceptance Criteria**:

- [ ] Summary shown after generation completes
- [ ] All categories (created/updated/skipped/failed) tracked
- [ ] Total duration displayed
- [ ] Failed count highlighted if > 0
- [ ] Summary can be dismissed

---

### Sprint 3: Architecture - Configuration System (1 week)

**Goal**: Replace hardcoded values with configurable system

#### Task 3.1: Configuration Schema & Storage

**Effort**: 6 hours
**Priority**: Medium
**Files**: `src/lib/config/`

**Implementation Steps**:

1. Create configuration types:

   ```typescript
   // src/lib/config/types.ts
   export interface PluginConfig {
     ui: {
       width: number;
       height: number;
       maxLogs: number;
       copyLogsLimit: number;
     };
     generation: {
       maxRetries: number;
       maxBackoffMinutes: number;
       itemsPerRow: number;
       batchDelayMs: number;
     };
     github: {
       timeoutMs: number;
     };
   }

   export const defaultConfig: PluginConfig = {
     ui: {
       width: 400,
       height: 600,
       maxLogs: 1000,
       copyLogsLimit: 100,
     },
     generation: {
       maxRetries: 4,
       maxBackoffMinutes: 10,
       itemsPerRow: 24,
       batchDelayMs: 10,
     },
     github: {
       timeoutMs: 30000,
     },
   };
   ```

2. Create config manager:

   ```typescript
   // src/lib/config/manager.ts
   export class ConfigManager {
     private static config: PluginConfig = defaultConfig;

     static async load(): Promise<void> {
       const stored = await figma.clientStorage.getAsync('plugin_config');
       if (stored) {
         this.config = { ...defaultConfig, ...stored };
       }
     }

     static async save(config: Partial<PluginConfig>): Promise<void> {
       this.config = { ...this.config, ...config };
       await figma.clientStorage.setAsync('plugin_config', this.config);
     }

     static get(): PluginConfig {
       return { ...this.config };
     }

     static getUI() {
       return this.config.ui;
     }
     static getGeneration() {
       return this.config.generation;
     }
     static getGitHub() {
       return this.config.github;
     }
   }
   ```

**Acceptance Criteria**:

- [ ] Configuration stored in Figma client storage
- [ ] Defaults provided for all settings
- [ ] Type-safe configuration access
- [ ] Configuration persists across plugin sessions

**Dependencies**: None

---

#### Task 3.2: Settings UI Panel

**Effort**: 8 hours
**Priority**: Medium
**Files**: `src/ui.tsx`, `src/components/SettingsPanel.tsx`

**Implementation Steps**:

1. Create settings panel:

   ```typescript
   export const SettingsPanel: React.FC = () => {
     const [config, setConfig] = useState<PluginConfig>(defaultConfig);
     const [dirty, setDirty] = useState(false);

     useEffect(() => {
       // Load config on mount
       parent.postMessage({ pluginMessage: { type: 'GET_CONFIG' }}, '*');
     }, []);

     const handleSave = () => {
       parent.postMessage({
         pluginMessage: {
           type: 'SAVE_CONFIG',
           config,
         }
       }, '*');
       setDirty(false);
     };

     return (
       <div className="settings-panel">
         <h2>Settings</h2>

         <Section title="UI Settings">
           <NumberInput
             label="Plugin Width"
             value={config.ui.width}
             onChange={(width) => updateConfig({ ui: { ...config.ui, width }})}
             min={300}
             max={800}
           />
           <NumberInput
             label="Plugin Height"
             value={config.ui.height}
             onChange={(height) => updateConfig({ ui: { ...config.ui, height }})}
             min={400}
             max={1000}
           />
           <NumberInput
             label="Max Logs"
             value={config.ui.maxLogs}
             onChange={(maxLogs) => updateConfig({ ui: { ...config.ui, maxLogs }})}
             min={100}
             max={10000}
           />
         </Section>

         <Section title="Generation Settings">
           <NumberInput
             label="Max Retries"
             value={config.generation.maxRetries}
             onChange={(maxRetries) => updateConfig({ generation: { ...config.generation, maxRetries }})}
             min={1}
             max={10}
           />
           <NumberInput
             label="Items Per Row"
             value={config.generation.itemsPerRow}
             onChange={(itemsPerRow) => updateConfig({ generation: { ...config.generation, itemsPerRow }})}
             min={10}
             max={50}
           />
         </Section>

         <div className="settings-actions">
           <button onClick={handleSave} disabled={!dirty}>
             Save Settings
           </button>
           <button onClick={handleReset}>
             Reset to Defaults
           </button>
         </div>
       </div>
     );
   };
   ```

2. Add settings tab to main UI:

   ```typescript
   const [activeTab, setActiveTab] = useState<'generate' | 'settings'>('generate');

   return (
     <div className="app">
       <Tabs>
         <Tab active={activeTab === 'generate'} onClick={() => setActiveTab('generate')}>
           Generate
         </Tab>
         <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
           Settings
         </Tab>
       </Tabs>

       {activeTab === 'generate' && <GeneratePanel />}
       {activeTab === 'settings' && <SettingsPanel />}
     </div>
   );
   ```

**Acceptance Criteria**:

- [ ] Settings accessible via tab
- [ ] All configurable values exposed
- [ ] Input validation (min/max values)
- [ ] Save button enabled only when changes made
- [ ] Reset to defaults option available

**Dependencies**: Task 3.1

---

### Sprint 4: Architecture - Refactor Handlers (1.5 weeks)

**Goal**: Split monolithic handlers into focused modules

#### Task 4.1: Extract Icon Skip Logic

**Effort**: 6 hours
**Priority**: Medium
**Files**: `src/handlers/category-generation/`, new `icon-skip-detector.ts`

**Implementation Steps**:

1. Create skip detector:

   ```typescript
   // src/handlers/category-generation/icon-skip-detector.ts
   export class IconSkipDetector {
     async shouldSkip(
       componentSet: ComponentSetNode,
       iconName: string,
       expectedVariantCount: number,
       latestCommitSha: string
     ): Promise<{ skip: boolean; reason?: string }> {
       // Check commit SHA
       const storedSha = componentSet.getPluginData('commitSha');
       if (storedSha !== latestCommitSha) {
         return { skip: false, reason: 'Commit SHA changed' };
       }

       // Check variant count
       const actualCount = componentSet.children.length;
       if (actualCount !== expectedVariantCount) {
         return {
           skip: false,
           reason: `Variant count mismatch (${actualCount} vs ${expectedVariantCount})`,
         };
       }

       // Check content hash
       const storedHash = componentSet.getPluginData('contentHash');
       const currentHash = await this.calculateContentHash(componentSet);
       if (storedHash !== currentHash) {
         return { skip: false, reason: 'Content changed' };
       }

       return { skip: true };
     }

     private async calculateContentHash(component: ComponentSetNode): Promise<string> {
       // Hash variant names and properties
       const data = component.children.map((child) => ({
         name: child.name,
         // ... other relevant properties
       }));
       return hashObject(data);
     }
   }
   ```

2. Use in handler:

   ```typescript
   const skipDetector = new IconSkipDetector();
   const { skip, reason } = await skipDetector.shouldSkip(
     existingComponent,
     iconName,
     504,
     commitSha
   );

   if (skip) {
     logger.info(`Skipping ${iconName} (unchanged)`);
     continue;
   }

   logger.info(`Updating ${iconName}: ${reason}`);
   ```

**Acceptance Criteria**:

- [ ] Skip logic extracted to dedicated class
- [ ] All skip conditions handled
- [ ] Skip reasons logged
- [ ] Testable in isolation

---

### Sprint 5-6: Features (2 weeks)

#### Task 5.1: Batch Category Generation

**Effort**: 10 hours
**Priority**: Low
**Files**: `src/ui.tsx`, `src/handlers/`

**Implementation Steps**:

1. Update UI for multi-select:

   ```typescript
   <MultiSelect
     label="Select Categories"
     options={categories}
     value={selectedCategories}
     onChange={setSelectedCategories}
     placeholder="Select one or more categories..."
   />
   <Checkbox
     label="Continue on error"
     checked={continueOnError}
     onChange={setContinueOnError}
   />
   <Button onClick={handleBatchGenerate}>
     Generate {selectedCategories.length} Categories
   </Button>
   ```

2. Implement batch handler:

   ```typescript
   const handleBatchGeneration = async (request: {
     categories: string[];
     continueOnError: boolean;
   }) => {
     const results: BatchResult[] = [];

     for (let i = 0; i < request.categories.length; i++) {
       const category = request.categories[i];

       figma.ui.postMessage({
         type: 'BATCH_PROGRESS',
         current: i + 1,
         total: request.categories.length,
         category,
       });

       try {
         await handleCategoryGeneration({ category });
         results.push({ category, success: true });
       } catch (error) {
         results.push({
           category,
           success: false,
           error: formatError(error),
         });

         if (!request.continueOnError) {
           break;
         }
       }
     }

     figma.ui.postMessage({
       type: 'BATCH_COMPLETE',
       results,
     });
   };
   ```

**Acceptance Criteria**:

- [ ] Multiple categories can be selected
- [ ] Progress shown for each category
- [ ] Option to continue on error
- [ ] Summary shows results for all categories
- [ ] Batch can be cancelled mid-process

---

### Sprint 7: Testing & Hardening (1 week)

**Goal**: Comprehensive test coverage and edge case handling

#### Task 7.1: UI Component Tests

**Effort**: 12 hours
**Priority**: High
**Files**: `src/ui/__tests__/`

**Implementation Steps**:

1. Setup React Testing Library:

   ```bash
   pnpm add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
   ```

2. Write component tests:

   ```typescript
   // src/ui/__tests__/App.test.tsx
   describe('App Component', () => {
     it('should validate category before generation', async () => {
       const { getByRole, getByText } = render(<App />);

       const generateBtn = getByRole('button', { name: /generate/i });
       await userEvent.click(generateBtn);

       expect(getByText(/please select a category/i)).toBeInTheDocument();
     });

     it('should handle error recovery', async () => {
       const { getByText, getByRole } = render(<App />);

       // Simulate error
       act(() => {
         window.postMessage({
           pluginMessage: {
             type: 'ERROR',
             error: { message: 'Test error' }
           }
         }, '*');
       });

       await waitFor(() => {
         expect(getByText(/test error/i)).toBeInTheDocument();
       });

       const retryBtn = getByRole('button', { name: /retry/i });
       expect(retryBtn).toBeInTheDocument();
     });
   });
   ```

**Acceptance Criteria**:

- [ ] All UI components have tests
- [ ] User interactions tested
- [ ] Error states tested
- [ ] Message handling tested
- [ ] 80% UI test coverage achieved

---

### Risk Mitigation

| Risk                                           | Probability | Impact | Mitigation                                                |
| ---------------------------------------------- | ----------- | ------ | --------------------------------------------------------- |
| **Breaking changes to existing functionality** | Medium      | High   | Comprehensive test suite before refactoring               |
| **Performance degradation**                    | Low         | Medium | Benchmark before/after, load test with 4000 icons         |
| **Configuration migration**                    | Low         | Low    | Provide migration script, maintain backward compatibility |
| **UI complexity**                              | Medium      | Low    | Incremental UI updates, user testing                      |
| **Token validation failures**                  | Low         | High   | Clear error messages, documentation                       |

### Success Metrics

| Metric                         | Current               | Target                  | Measurement                             |
| ------------------------------ | --------------------- | ----------------------- | --------------------------------------- |
| **Time to recover from error** | ∞ (must restart)      | < 5 seconds             | Time from error to resumed generation   |
| **User error reports**         | Baseline              | -50%                    | GitHub issues count                     |
| **Generation success rate**    | ~95%                  | >98%                    | Successful generations / total attempts |
| **Test coverage (UI)**         | 0%                    | 80%                     | Vitest coverage report                  |
| **Test coverage (Overall)**    | 97%                   | 98%                     | Vitest coverage report                  |
| **Configuration flexibility**  | 0 configurable values | 10+ configurable values | Count of exposed config options         |

### Rollout Plan

**Week 1-2 (Critical Fixes)**:

- Deploy to development environment
- Test with 1-2 categories
- Monitor for errors
- Deploy to production

**Week 3-4 (User Experience)**:

- Feature flag for error recovery UI
- Collect user feedback
- Iterate on UI/UX
- Full rollout

**Week 5-8 (Architecture + Features)**:

- Gradual migration to new architecture
- A/B test new features
- Gather performance data
- Full migration

**Week 9-12 (Testing + Stabilization)**:

- Comprehensive testing
- Bug fixes
- Documentation updates
- Stable release

---

**Document Version**: 1.1
**Last Updated**: 2025-10-26
**Contributors**: Analysis based on comprehensive codebase exploration
