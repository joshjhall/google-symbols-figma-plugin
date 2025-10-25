/**
 * Shared utilities for Figma plugin
 *
 * Lightweight, plugin-optimized utilities adapted from @terroir/core
 * These will eventually be extracted to a shared package when repos split
 */

// Error handling
export * from './errors';

// Logging
export * from './logger';

// Type guards and assertions
export * from './guards';

// Hashing utilities
export * from './hash';

// Re-export commonly used together
export { logger } from './logger';
export { FigmaPluginError, wrapError, isFigmaPluginError } from './errors';
export { isDefined, assertDefined, assert, isComponentSet } from './guards';
