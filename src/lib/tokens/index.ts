/**
 * @module @figma/tokens
 *
 * Styling utilities for Figma icon components.
 *
 * This module provides hardcoded styling for icon components to keep them
 * portable and free from external variable dependencies.
 *
 * **Core Feature**:
 * - **Hardcoded Styling**: Fixed values for colors, spacing, and sizing
 * - **No Dependencies**: No reliance on external variables or libraries
 * - **Portability**: Components work across any Figma file
 *
 * **Usage Pattern**:
 * ```typescript
 * import { applyMUIVariables } from '@figma/tokens';
 *
 * const componentSet = figma.createComponentSet();
 * await applyMUIVariables(componentSet);
 * // Component now has hardcoded fill (#FAF9FD), stroke (#9747FF), and corner radius (12px)
 * ```
 */

// Main exports
export { applyMUIVariables } from './binder';

// Re-export types if needed in the future
