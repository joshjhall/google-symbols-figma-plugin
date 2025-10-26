import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        // Config files
        '*.config.js',
        '*.config.ts',
        '.releaserc.json',
        // Build and dev scripts
        'scripts/**',
        // Entry points and UI (require Figma runtime)
        'src/ui.tsx',
        'src/code.ts',
        // Handlers that require Figma API (integration-level code)
        'src/handlers/page-organization.ts',
        'src/handlers/cumulative-changes.ts',
        'src/handlers/index.ts',
        'src/handlers/category-generation/icon-processor.ts',
        'src/handlers/category-generation/progress-tracker.ts',
        'src/handlers/category-generation/rate-limiter.ts',
        // Icon modules that require Figma runtime or are integration-level
        'src/lib/icons/all-icons.ts',
        'src/lib/icons/batch-fetcher.ts',
        'src/lib/icons/batch-generator.ts',
        'src/lib/icons/icon-list-fetcher.ts',
        'src/lib/icons/incremental-updater.ts',
        'src/lib/icons/deprecation-handler.ts',
        'src/lib/icons/metadata-helpers.ts',
        'src/lib/icons/index.ts',
        // Page management (requires Figma API)
        'src/lib/pages/**',
        // Token system (requires Figma variables API)
        'src/lib/tokens/**',
        // Message handler (integration code)
        'src/lib/message-handler.ts',
        // Icon generator (requires Figma API)
        'src/lib/icon-generator.ts',
        // Index/barrel files
        'src/lib/github/index.ts',
        'src/lib/utils/index.ts',
        // Guards (mostly type guards, less critical)
        'src/lib/utils/guards.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Test matching patterns
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.spec.ts'],

    // Globals for convenience
    globals: true,

    // Timeout for async operations
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  // Path aliases matching tsconfig
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@handlers': path.resolve(__dirname, './src/handlers'),
      '@utils': path.resolve(__dirname, './src/lib/utils'),
    },
  },
});
