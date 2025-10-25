/**
 * @module @figma/utils/guards
 *
 * Type guards and assertion utilities for Figma plugin development.
 *
 * This module provides runtime type checking with TypeScript type narrowing,
 * including both generic JavaScript type guards and Figma-specific node type
 * guards. All guards provide proper type inference for TypeScript.
 *
 * @example Basic type guards
 * ```typescript
 * import { isDefined, isString, assertDefined } from '@figma/utils/guards';
 *
 * const value: string | undefined = getConfig('key');
 *
 * // Type guard
 * if (isDefined(value)) {
 *   // TypeScript knows value is string here
 *   console.log(value.toUpperCase());
 * }
 *
 * // Assertion
 * assertDefined(value, 'Config value must be set');
 * // TypeScript knows value is string after this line
 * ```
 *
 * @example Figma node guards
 * ```typescript
 * import { isComponentSet, hasAutoLayout } from '@figma/utils/guards';
 *
 * const node = figma.currentPage.selection[0];
 *
 * if (isComponentSet(node)) {
 *   // TypeScript knows node is ComponentSetNode
 *   console.log(node.defaultVariant);
 * }
 *
 * if (hasAutoLayout(node)) {
 *   // TypeScript knows node has layoutMode property
 *   node.layoutMode = 'VERTICAL';
 * }
 * ```
 */

/**
 * Checks if a value is defined (not undefined).
 *
 * @template T - Type of the value
 * @param value - Value to check
 * @returns True if value is not undefined
 * @category Basic Guards
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Checks if a value is not null or undefined.
 *
 * @template T - Type of the value
 * @param value - Value to check
 * @returns True if value is not null or undefined
 * @category Basic Guards
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Asserts that a value is defined, throwing if not.
 *
 * @template T - Type of the value
 * @param value - Value that must be defined
 * @param message - Error message if assertion fails
 * @throws Error if value is undefined
 * @category Assertions
 *
 * @example
 * ```typescript
 * const config = getConfig();
 * assertDefined(config, 'Configuration is required');
 * // TypeScript knows config is defined after this
 * ```
 */
export function assertDefined<T>(
  value: T | undefined,
  message = 'Value must be defined'
): asserts value is T {
  if (value === undefined) {
    throw new Error(message);
  }
}

/**
 * Assert a condition is true
 */
export function assert(condition: boolean, message = 'Assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Type guard for strings
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for numbers
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for arrays
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard for objects
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard for Figma nodes
 */
export function isSceneNode(value: unknown): value is SceneNode {
  return isObject(value) && 'type' in value && isString(value.type);
}

/**
 * Type guard for component sets
 */
export function isComponentSet(node: SceneNode): node is ComponentSetNode {
  return node.type === 'COMPONENT_SET';
}

/**
 * Type guard for components
 */
export function isComponent(node: SceneNode): node is ComponentNode {
  return node.type === 'COMPONENT';
}

/**
 * Type guard for frames
 */
export function isFrame(node: SceneNode): node is FrameNode {
  return node.type === 'FRAME';
}

/**
 * Check if node has auto-layout
 */
export function hasAutoLayout(
  node: SceneNode
): node is FrameNode | ComponentNode | ComponentSetNode {
  return 'layoutMode' in node && node.layoutMode !== 'NONE';
}

/**
 * Checks if a node has the fills property.
 *
 * @param node - Figma node to check
 * @returns True if node has fills property
 * @category Figma Guards
 */
export function hasFills(node: SceneNode): node is SceneNode & MinimalFillsMixin {
  return 'fills' in node;
}

/**
 * Checks if a node has the strokes property.
 *
 * @param node - Figma node to check
 * @returns True if node has strokes property
 * @category Figma Guards
 */
export function hasStrokes(node: SceneNode): node is SceneNode & MinimalStrokesMixin {
  return 'strokes' in node;
}

/**
 * Safely accesses a property on an object.
 *
 * @template T - Type of the object
 * @template K - Type of the key
 * @param obj - Object to access
 * @param key - Property key
 * @param defaultValue - Default value if property doesn't exist
 * @returns Property value or default
 * @category Utilities
 *
 * @example
 * ```typescript
 * const config = { theme: 'dark' };
 * const theme = getProperty(config, 'theme', 'light'); // 'dark'
 * const missing = getProperty(config, 'mode', 'auto'); // 'auto'
 * ```
 */
export function getProperty<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined {
  return key in obj ? obj[key] : defaultValue;
}
