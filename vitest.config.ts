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
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/ui.tsx', // Browser-based UI
        'src/code.ts', // Plugin entry point
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
