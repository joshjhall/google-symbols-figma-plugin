#!/usr/bin/env node

/**
 * Build script for plugin code with environment variable injection
 */

import * as esbuild from 'esbuild';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Get GitHub token from environment (with fallback for CI/CD)
const githubToken = process.env.GITHUB_TOKEN || '';

if (!githubToken) {
  console.warn('Warning: GITHUB_TOKEN not set. Icon fetching may not work.');
}

// Common build options
const buildOptions = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2017',
  define: {
    'process.env.GITHUB_TOKEN': JSON.stringify(githubToken),
  },
};

// Check if this is a dev build or production build
const isDev = process.argv.includes('--dev');
const isWatch = process.argv.includes('--watch');

if (isWatch) {
  // Watch mode for development
  const ctx = await esbuild.context({
    ...buildOptions,
    sourcemap: true,
  });

  await ctx.watch();
  console.log('👀 Watching for changes...');
} else {
  // One-time build
  await esbuild.build({
    ...buildOptions,
    minify: !isDev,
    sourcemap: isDev,
  });

  console.log('✅ Build complete!');
}
