/**
 * @module @figma/icons/variant-formatter
 *
 * Variant naming and formatting utilities for Material Icons.
 *
 * This module provides pure functions for generating consistent variant names
 * and managing default variant ordering in component sets. All functions are
 * deterministic and have no side effects, making them easy to test.
 *
 * **Naming Convention**:
 * Variants follow Material Design naming: `Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp`
 *
 * **Default Variant**:
 * The default variant is Rounded/400/Off/Normal/24dp, matching Material Design guidelines.
 * This variant should always be first in the component set for proper Figma behavior.
 *
 * **Grade Names**:
 * - -25 → "Dark theme" (adjusted for dark backgrounds)
 * - 0 → "Normal" (standard grade)
 * - 200 → "Emphasis" (heavier appearance)
 *
 * @example Basic variant naming
 * ```typescript
 * import { getVariantName } from '@figma/icons/variant-formatter';
 *
 * const name = getVariantName({
 *   iconName: 'home',
 *   style: 'rounded',
 *   variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   svgContent: '...'
 * });
 * // Returns: "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 *
 * @example Sorting for default
 * ```typescript
 * import { sortComponentsForDefault } from '@figma/icons/variant-formatter';
 *
 * const components: ComponentNode[] = [...];
 * sortComponentsForDefault(components);
 * // Default variant (Rounded/400/Off/Normal/24dp) is now first
 * ```
 *
 * @example Ensuring default first
 * ```typescript
 * import { ensureDefaultVariantFirst } from '@figma/icons/variant-formatter';
 *
 * const componentSet = figma.getNodeById('...') as ComponentSetNode;
 * ensureDefaultVariantFirst(componentSet);
 * // Best default variant is now at index 0
 * ```
 */

import { logger } from '@lib/utils';
import { findBestDefaultVariant } from './variant-utils';
import type { VariantData } from './generator';

/**
 * Default variant properties for Material Icons
 *
 * This represents the most common/standard variant combination:
 * - **Rounded**: Friendliest style (most commonly used)
 * - **400**: Regular weight (standard text weight)
 * - **Off**: No fill (outline icons)
 * - **Normal**: Standard grade (0)
 * - **24dp**: Standard optical size
 *
 * This combination should be the default variant shown in Figma and
 * should always appear first in the component set's layer order.
 *
 * @constant
 */
export const DEFAULT_VARIANT = {
  style: 'Rounded',
  weight: 400,
  fill: 'Off',
  grade: 'Normal',
  opticalSize: '24dp',
} as const;

/**
 * Get human-readable grade name
 *
 * Converts numeric grade values to descriptive names that match
 * Material Design terminology.
 *
 * **Grade Values**:
 * - **-25**: "Dark theme" - Slightly lighter weight for dark backgrounds
 * - **0**: "Normal" - Standard grade for most use cases
 * - **200**: "Emphasis" - Heavier appearance for emphasis
 *
 * @param {number} grade - Numeric grade value (-25, 0, or 200)
 * @returns {string} Human-readable grade name
 *
 * @example
 * ```typescript
 * getGradeName(-25); // "Dark theme"
 * getGradeName(0);   // "Normal"
 * getGradeName(200); // "Emphasis"
 * ```
 */
export function getGradeName(grade: number): string {
  switch (grade) {
    case 200:
      return 'Emphasis';
    case -25:
      return 'Dark theme';
    default:
      return 'Normal';
  }
}

/**
 * Get formatted variant name for a component
 *
 * Generates a consistent variant name string following Material Design
 * conventions. The name includes all variant properties in a specific order.
 *
 * **Name Format**:
 * `Style={Rounded|Outlined|Sharp}, Weight={100-700}, Fill={On|Off}, Grade={Dark theme|Normal|Emphasis}, Optical size={20|24|40|48}dp`
 *
 * **Naming Rules**:
 * - Style names are capitalized (Rounded, not rounded)
 * - Fill is On/Off (not 1/0)
 * - Grade uses descriptive names (not numeric values)
 * - Optical size includes "dp" suffix
 *
 * @param {VariantData} variantData - Variant data with icon properties
 * @returns {string} Formatted variant name
 *
 * @example Standard variant
 * ```typescript
 * getVariantName({
 *   iconName: 'home',
 *   style: 'rounded',
 *   variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   svgContent: '...'
 * });
 * // "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 *
 * @example Filled variant with emphasis
 * ```typescript
 * getVariantName({
 *   iconName: 'star',
 *   style: 'rounded',
 *   variant: { weight: 700, fill: 1, grade: 200, opticalSize: 48 },
 *   svgContent: '...'
 * });
 * // "Style=Rounded, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp"
 * ```
 */
export function getVariantName(variantData: VariantData): string {
  const styleName = variantData.style.charAt(0).toUpperCase() + variantData.style.slice(1);
  return [
    `Style=${styleName}`,
    `Weight=${variantData.variant.weight}`,
    `Fill=${variantData.variant.fill ? 'On' : 'Off'}`,
    `Grade=${getGradeName(variantData.variant.grade)}`,
    `Optical size=${variantData.variant.opticalSize}dp`,
  ].join(', ');
}

/**
 * Get the default variant name
 *
 * Returns the formatted name for the default Material Icons variant.
 * This is the variant that should appear first in component sets and
 * be shown as the default preview in Figma.
 *
 * **Default Variant**:
 * - Style: Rounded (friendliest, most common)
 * - Weight: 400 (regular weight)
 * - Fill: Off (outline)
 * - Grade: Normal (standard)
 * - Optical size: 24dp (standard size)
 *
 * @returns {string} Formatted default variant name
 *
 * @example
 * ```typescript
 * const defaultName = getDefaultVariantName();
 * // "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 *
 * // Use to identify default variant
 * const isDefault = component.name === defaultName;
 * ```
 */
export function getDefaultVariantName(): string {
  return [
    `Style=${DEFAULT_VARIANT.style}`,
    `Weight=${DEFAULT_VARIANT.weight}`,
    `Fill=${DEFAULT_VARIANT.fill}`,
    `Grade=${DEFAULT_VARIANT.grade}`,
    `Optical size=${DEFAULT_VARIANT.opticalSize}`,
  ].join(', ');
}

/**
 * Sort components array to put default variant first
 *
 * Modifies the components array in-place to ensure the default variant
 * appears first. Uses the canonical default variant name for matching.
 *
 * **Sort Order**:
 * 1. Default variant (Rounded/400/Off/Normal/24dp)
 * 2. All other variants (unchanged order)
 *
 * **Note**: This only sorts the array, it does not change Figma layer order.
 * Use `ensureDefaultVariantFirst()` to update the actual layer stack.
 *
 * @param {ComponentNode[]} components - Array of component nodes to sort
 *
 * @example
 * ```typescript
 * const components = componentSet.children as ComponentNode[];
 * sortComponentsForDefault(components);
 *
 * // Now components[0] is the default variant
 * console.log(components[0].name);
 * // "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 */
export function sortComponentsForDefault(components: ComponentNode[]): void {
  const defaultName = getDefaultVariantName();
  components.sort((a, b) => {
    if (a.name === defaultName) return -1;
    if (b.name === defaultName) return 1;
    return 0;
  });
}

/**
 * Ensure default variant is first in component set layer order
 *
 * Uses smart fallback logic to find the best default variant and moves it
 * to the first position (index 0) in the component set's layer stack. This
 * ensures Figma shows the most appropriate variant as the default preview.
 *
 * **Fallback Logic**:
 * 1. Exact match: Rounded/400/Off/Normal/24dp
 * 2. Close matches: Same style/weight with different fill/grade/size
 * 3. Style matches: Same style, closest weight
 * 4. Any variant: First child as last resort
 *
 * **Why This Matters**:
 * Figma uses the first child in a component set as the default variant shown
 * in the asset panel and when dragging from the library. Having the standard
 * variant first provides the best user experience.
 *
 * @param {ComponentSetNode} componentSet - Component set to reorder
 *
 * @example
 * ```typescript
 * const componentSet = figma.getNodeById('...') as ComponentSetNode;
 * ensureDefaultVariantFirst(componentSet);
 *
 * // The best default variant is now at index 0
 * const defaultVariant = componentSet.children[0] as ComponentNode;
 * console.log(`Default: ${defaultVariant.name}`);
 * ```
 *
 * @example Handling missing exact match
 * ```typescript
 * // Component set has Outlined/300/Off/Normal/24dp but no Rounded variants
 * ensureDefaultVariantFirst(componentSet);
 * // Falls back to closest match (Outlined/300/...)
 * // Logs: "Could not find exact default, using best match: ..."
 * ```
 */
export function ensureDefaultVariantFirst(componentSet: ComponentSetNode): void {
  // Use the smart fallback system to find the best default variant
  const bestDefault = findBestDefaultVariant(componentSet.children);

  if (bestDefault) {
    const currentIndex = componentSet.children.indexOf(bestDefault as ComponentNode);
    if (currentIndex !== 0) {
      logger.info(`Moving best default variant to top: ${bestDefault.name}`);
      // Move it to position 0 (top of the layer stack)
      componentSet.insertChild(0, bestDefault as ComponentNode);
    } else {
      logger.info(`Best default variant already at top: ${bestDefault.name}`);
    }
  } else {
    logger.warn('Could not find any suitable default variant');
    // As a last resort, just use the first child
    if (componentSet.children.length > 0) {
      logger.info(`Using first variant as default: ${componentSet.children[0].name}`);
    }
  }
}
