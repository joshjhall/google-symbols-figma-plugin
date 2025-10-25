/**
 * @module @figma/icons/deprecation-handler
 *
 * Handles deprecation of icons no longer in active category sets.
 *
 * When icon sets shift boundaries (e.g., "Set 1: aaa-bbb" becomes "Set 1: aaa-ccc"),
 * icons that fall outside the new range must be marked as deprecated. This module:
 *
 * - **Scans Recursively**: Finds all ComponentSet nodes, including nested ones
 * - **Smart Comparison**: Matches icons case-insensitively with path normalization
 * - **Non-Destructive**: Renames with "deprecated_" prefix instead of deletion
 * - **Idempotent**: Won't re-rename already deprecated components
 *
 * **Use Cases**:
 * - Set boundary shifts (icons move between sets)
 * - Icon removal from Material Icons repository
 * - Category reorganization
 * - Pre-generation cleanup
 *
 * **Naming Convention**:
 * - Active icon: `home`
 * - Deprecated icon: `deprecated_home`
 *
 * @example Basic usage
 * ```typescript
 * const iconsToImport = ['home', 'search', 'menu'];
 * const result = await handleDeprecatedIcons(page, iconsToImport);
 *
 * console.log(getDeprecationSummary(result));
 * // "Found 50 existing components, 3 will be updated, 2 deprecated"
 * ```
 *
 * @example Before generation
 * ```typescript
 * // Before generating Set 1, mark icons that moved to Set 2 as deprecated
 * const set1Icons = getIconRange('aaa', 'bbb');
 * const result = await handleDeprecatedIcons(page, set1Icons);
 *
 * // Icons "bbb", "bbc", etc. now renamed to "deprecated_bbb", "deprecated_bbc"
 * ```
 */

import { logger } from '@lib/utils';

/**
 * Result of deprecation scan and rename operation
 *
 * @interface DeprecationResult
 * @property {ComponentSetNode[]} existingComponents - All ComponentSets found on page
 * @property {ComponentSetNode[]} matchingComponents - Components that will be updated
 * @property {ComponentSetNode[]} deprecatedComponents - Components that were deprecated
 * @property {number} renamedCount - Number of components successfully renamed
 *
 * @example
 * ```typescript
 * const result = await handleDeprecatedIcons(page, ['home', 'search']);
 *
 * console.log(`Found ${result.existingComponents.length} components`);
 * console.log(`Updating ${result.matchingComponents.length}`);
 * console.log(`Deprecated ${result.renamedCount}`);
 * ```
 */
export interface DeprecationResult {
  existingComponents: ComponentSetNode[];
  matchingComponents: ComponentSetNode[];
  deprecatedComponents: ComponentSetNode[];
  renamedCount: number;
}

/**
 * Recursively find all ComponentSet nodes in a page, including nested ones
 *
 * Searches the entire node tree to find ComponentSets that may be nested inside
 * frames, groups, or other containers. This ensures deprecation detection works
 * even if icons are organized in frames.
 *
 * @private
 * @param {SceneNode} node - Node to search (will recursively search children)
 * @returns {ComponentSetNode[]} Array of all found ComponentSets
 */
function findAllComponentSets(node: SceneNode): ComponentSetNode[] {
  const componentSets: ComponentSetNode[] = [];

  if (node.type === 'COMPONENT_SET') {
    componentSets.push(node);
  }

  // Recursively search children if this node can have them
  if ('children' in node) {
    for (const child of node.children) {
      componentSets.push(...findAllComponentSets(child));
    }
  }

  return componentSets;
}

/**
 * Extract icon name from component name with normalization
 *
 * Handles various naming formats and normalizes for comparison:
 * - `"home"` → `"home"`
 * - `"Material/home"` → `"home"` (removes path prefix)
 * - `"Icons/home"` → `"home"` (removes category)
 * - `"deprecated_assessment"` → `"assessment"` (removes deprecated prefix)
 *
 * Normalization ensures accurate matching regardless of how components are named.
 *
 * @private
 * @param {string} componentName - Component name to extract from
 * @returns {string} Normalized icon name (lowercase, no prefixes)
 *
 * @example
 * ```typescript
 * extractIconName('home')                  // 'home'
 * extractIconName('Material/home')         // 'home'
 * extractIconName('deprecated_home')       // 'home'
 * extractIconName('Icons/deprecated_home') // 'home'
 * ```
 */
function extractIconName(componentName: string): string {
  // Remove "deprecated_" prefix if present
  let name = componentName.replace(/^deprecated_/, '');

  // Remove any path prefixes (e.g., "Material/", "Icons/")
  const parts = name.split('/');
  name = parts[parts.length - 1];

  return name.toLowerCase().trim();
}

/**
 * Check if a component is already marked as deprecated
 *
 * @private
 * @param {ComponentSetNode} component - Component to check
 * @returns {boolean} True if name starts with "deprecated_"
 */
function isDeprecated(component: ComponentSetNode): boolean {
  return component.name.startsWith('deprecated_');
}

/**
 * Process existing components on a page before importing new icons
 *
 * Scans the page for existing ComponentSets and marks any that aren't in the
 * import list as deprecated by renaming them. This is typically called before
 * generating icons to handle set boundary shifts.
 *
 * **Algorithm**:
 * 1. **Scan**: Recursively find all ComponentSets (including nested)
 * 2. **Normalize**: Extract icon names and normalize for comparison
 * 3. **Categorize**:
 *    - Matching: Icon in import list → will be updated
 *    - Deprecated: Icon not in import list → rename with "deprecated_" prefix
 *    - Already deprecated: Skip (don't re-rename)
 * 4. **Rename**: Apply "deprecated_" prefix to deprecated components
 * 5. **Report**: Return statistics and references
 *
 * **Use Case**: Set Boundary Shift
 * ```
 * Old: Set 1: aaa-bbb    → icons [aaa, aab, ..., bbb]
 * New: Set 1: aaa-ccc    → icons [aaa, aab, ..., ccc]
 *
 * Icons [bbb+1 to ccc] are now in Set 1
 * Icons [old bbb+1 to old end] should be deprecated
 * ```
 *
 * **Non-Destructive**: Components are renamed, not deleted, preserving:
 * - All variants
 * - All metadata
 * - All variable bindings
 * - Component hierarchy
 *
 * @param {PageNode} page - The Figma page to scan
 * @param {string[]} iconsToImport - Array of icon names that will be generated/updated
 * @returns {Promise<DeprecationResult>} Result with statistics and component references
 *
 * @example Before generating Set 1
 * ```typescript
 * const set1Icons = getIconRange('10k_alt_1', 'add_chart');
 * const result = await handleDeprecatedIcons(page, set1Icons);
 *
 * console.log(getDeprecationSummary(result));
 * // "Found 500 existing components, 480 will be updated, 20 deprecated"
 * ```
 *
 * @example After repository update
 * ```typescript
 * // Some icons were removed from Material Icons
 * const currentIcons = await githubAPI.fetchAllIcons();
 * const result = await handleDeprecatedIcons(page, currentIcons);
 *
 * // Icons no longer in repository are now marked "deprecated_*"
 * ```
 */
export async function handleDeprecatedIcons(
  page: PageNode,
  iconsToImport: string[]
): Promise<DeprecationResult> {
  logger.info(`Scanning page "${page.name}" for existing icon components...`);

  // Find all ComponentSet nodes recursively
  const allComponents: ComponentSetNode[] = [];
  for (const child of page.children) {
    allComponents.push(...findAllComponentSets(child));
  }

  logger.info(`Found ${allComponents.length} existing component sets on page`);

  // Create a Set of icon names being imported (lowercase for comparison)
  const importingSet = new Set(iconsToImport.map((name) => name.toLowerCase()));

  // Categorize existing components
  const matchingComponents: ComponentSetNode[] = [];
  const deprecatedComponents: ComponentSetNode[] = [];

  for (const component of allComponents) {
    // Skip if already deprecated
    if (isDeprecated(component)) {
      logger.info(`Component "${component.name}" is already marked as deprecated`);
      continue;
    }

    const iconName = extractIconName(component.name);

    if (importingSet.has(iconName)) {
      // This component matches an icon we're importing - it will be updated
      matchingComponents.push(component);
    } else {
      // This component is NOT in our import list - mark for deprecation
      deprecatedComponents.push(component);
    }
  }

  logger.info(`Categorized components:`);
  logger.info(`  - Matching (will be updated): ${matchingComponents.length}`);
  logger.info(`  - To deprecate: ${deprecatedComponents.length}`);

  // Rename deprecated components
  let renamedCount = 0;
  for (const component of deprecatedComponents) {
    const oldName = component.name;
    const newName = `deprecated_${oldName}`;

    try {
      component.name = newName;
      renamedCount++;
      logger.info(`Renamed "${oldName}" → "${newName}"`);
    } catch (error) {
      logger.warn(`Failed to rename "${oldName}": ${error}`);
    }
  }

  if (renamedCount > 0) {
    logger.info(`✅ Renamed ${renamedCount} deprecated components`);
  } else {
    logger.info(`No components needed deprecation`);
  }

  return {
    existingComponents: allComponents,
    matchingComponents,
    deprecatedComponents,
    renamedCount,
  };
}

/**
 * Generate a human-readable summary message for UI display
 *
 * @param {DeprecationResult} result - Deprecation scan result
 * @returns {string} Formatted summary message
 *
 * @example
 * ```typescript
 * const result = await handleDeprecatedIcons(page, iconsToImport);
 * const summary = getDeprecationSummary(result);
 * figma.ui.postMessage({ type: 'STATUS', message: summary });
 * // "Found 500 existing components, 480 will be updated, 20 deprecated"
 * ```
 */
export function getDeprecationSummary(result: DeprecationResult): string {
  const parts: string[] = [];

  parts.push(`Found ${result.existingComponents.length} existing components`);

  if (result.matchingComponents.length > 0) {
    parts.push(`${result.matchingComponents.length} will be updated`);
  }

  if (result.renamedCount > 0) {
    parts.push(`${result.renamedCount} deprecated (renamed with "deprecated_" prefix)`);
  }

  return parts.join(', ');
}
