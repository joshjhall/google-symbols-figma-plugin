/**
 * @module @figma/icons/all-icons
 *
 * Validated icon list from Material Symbols repository.
 *
 * This module provides access to the complete list of 3933 validated Material Symbols
 * icons from Google's official repository. All icons have been verified to have SVG
 * files available in the GitHub repo.
 *
 * **Data Source**: all-icons-data.json
 * - Generated from Material Symbols repository
 * - Source: symbols/web/ directory
 * - Alphabetically sorted
 * - Validated: All icons have SVG files
 *
 * **Use Cases**:
 * - Get complete icon list for UI
 * - Check if icon name is valid
 * - Get icon ranges for category-based generation
 * - Validate user input
 *
 * @example Get all icons
 * ```typescript
 * const icons = getAllIcons();
 * console.log(`Total icons: ${icons.length}`); // 3933
 * console.log(`First: ${icons[0]}, Last: ${icons[icons.length - 1]}`);
 * ```
 *
 * @example Check icon existence
 * ```typescript
 * if (iconExists('home')) {
 *   console.log('home icon is available');
 * }
 * ```
 *
 * @example Get icon range for category
 * ```typescript
 * // Set 1: Icons from '10k_alt_1' to 'add_chart' (exclusive)
 * const set1Icons = getIconRange('10k_alt_1', 'add_chart');
 * console.log(`Set 1 has ${set1Icons.length} icons`);
 * ```
 */

import iconList from './all-icons-data.json';

/**
 * Complete list of validated Material Symbols icons
 *
 * All 3933 icons have been verified to have SVG files in the Material Symbols
 * repository. This list is alphabetically sorted and used as the source of truth
 * for all icon generation operations.
 *
 * @constant
 * @type {string[]}
 * @readonly
 *
 * @example
 * ```typescript
 * console.log(ALL_ICONS.length); // 3933
 * console.log(ALL_ICONS[0]);     // "10k_alt_1"
 * console.log(ALL_ICONS[ALL_ICONS.length - 1]); // Last icon name
 * ```
 */
export const ALL_ICONS: string[] = iconList as string[];

/**
 * Get the complete icon list
 *
 * Returns the full array of 3933 validated Material Symbols icons.
 * The list is alphabetically sorted and suitable for UI display.
 *
 * @returns {string[]} Complete array of icon names
 *
 * @example
 * ```typescript
 * const icons = getAllIcons();
 * // Display in UI
 * icons.forEach(name => {
 *   console.log(`Icon: ${name}`);
 * });
 * ```
 */
export function getAllIcons(): string[] {
  return ALL_ICONS;
}

/**
 * Check if an icon exists in the validated list
 *
 * Verifies that an icon name is valid and has SVG files available in the
 * Material Symbols repository. Case-sensitive exact match.
 *
 * @param {string} iconName - Icon name to validate
 * @returns {boolean} True if icon exists, false otherwise
 *
 * @example
 * ```typescript
 * if (iconExists('home')) {
 *   console.log('✓ home is valid');
 * }
 *
 * if (!iconExists('invalid_icon')) {
 *   console.log('✗ invalid_icon not found');
 * }
 * ```
 */
export function iconExists(iconName: string): boolean {
  return ALL_ICONS.includes(iconName);
}

/**
 * Get icons in a specific range (for category-based generation)
 *
 * Returns a slice of the icon list between two boundary icons. This is used to
 * split the 3933 icons into manageable categories/sets for generation.
 *
 * **Range Semantics**: `[inclusive, exclusive)`
 * - Includes `firstIcon`
 * - Excludes `lastIcon`
 * - Special: Use `'__END__'` as lastIcon to include all remaining icons
 *
 * **Use Case**: Set boundaries
 * ```
 * Set 1: "10k_alt_1" to "add_chart" → icons[0...250]
 * Set 2: "add_chart" to "apartment" → icons[250...500]
 * Set 16: "zoom_out_map" to "__END__" → icons[3700...3933]
 * ```
 *
 * @param {string} firstIcon - First icon in range (inclusive)
 * @param {string} lastIcon - Last icon in range (exclusive) or '__END__'
 * @returns {string[]} Array of icon names in range
 * @throws {Error} If firstIcon or lastIcon not found in list
 *
 * @example Set 1 icons
 * ```typescript
 * const set1 = getIconRange('10k_alt_1', 'add_chart');
 * console.log(set1.length);     // Number of icons in Set 1
 * console.log(set1[0]);         // "10k_alt_1"
 * console.log(set1[set1.length - 1]); // Icon before "add_chart"
 * ```
 *
 * @example Last set (to end)
 * ```typescript
 * const lastSet = getIconRange('zoom_out_map', '__END__');
 * // Includes zoom_out_map and all icons after it
 * ```
 *
 * @example Error handling
 * ```typescript
 * try {
 *   const range = getIconRange('invalid_start', 'invalid_end');
 * } catch (error) {
 *   console.error('Icon not found:', error.message);
 * }
 * ```
 */
export function getIconRange(firstIcon: string, lastIcon: string): string[] {
  const firstIndex = ALL_ICONS.indexOf(firstIcon);

  if (firstIndex === -1) {
    throw new Error(`Could not find first icon: ${firstIcon}`);
  }

  // Special marker for last category: include everything to the end
  if (lastIcon === '__END__') {
    return ALL_ICONS.slice(firstIndex);
  }

  const lastIndex = ALL_ICONS.indexOf(lastIcon);

  if (lastIndex === -1) {
    throw new Error(`Could not find last icon: ${lastIcon}`);
  }

  // Use [inclusive, exclusive) range
  return ALL_ICONS.slice(firstIndex, lastIndex);
}
