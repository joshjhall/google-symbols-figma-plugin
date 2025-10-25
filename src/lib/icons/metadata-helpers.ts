/**
 * @module @figma/icons/metadata-helpers
 *
 * Helper functions for reading and working with plugin metadata stored on Figma nodes.
 * These utilities support the smart skip/update logic for icon generation.
 */

import { logger } from '@lib/utils';
import { PLUGIN_DATA_KEYS, EXPECTED_VARIANT_COUNT } from '@lib/constants';

/**
 * Get the commit SHA stored on a ComponentSet
 * @param componentSet The ComponentSet to read from
 * @returns The commit SHA string, or null if not set
 */
export function getCommitSha(componentSet: ComponentSetNode): string | null {
  try {
    const sha = componentSet.getPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA);
    return sha || null;
  } catch (error) {
    logger.warn(`Failed to read commit SHA from ${componentSet.name}:`, error);
    return null;
  }
}

/**
 * Get the SVG hash stored on a variant (ComponentNode)
 * @param variant The variant component to read from
 * @returns The SVG hash string, or null if not set
 */
export function getSvgHash(variant: ComponentNode): string | null {
  try {
    const hash = variant.getPluginData(PLUGIN_DATA_KEYS.SVG_HASH);
    return hash || null;
  } catch (error) {
    logger.warn(`Failed to read SVG hash from ${variant.name}:`, error);
    return null;
  }
}

/**
 * Check if a ComponentSet is complete (has all expected variants)
 * @param componentSet The ComponentSet to check
 * @returns True if the ComponentSet has exactly 504 variants
 */
export function isComponentSetComplete(componentSet: ComponentSetNode): boolean {
  const variantCount = componentSet.children.length;
  return variantCount === EXPECTED_VARIANT_COUNT;
}

/**
 * Get the count of variants in a ComponentSet
 * @param componentSet The ComponentSet to count
 * @returns The number of variants
 */
export function getVariantCount(componentSet: ComponentSetNode): number {
  return componentSet.children.length;
}

/**
 * Check if a ComponentSet should be skipped (already up-to-date)
 * A ComponentSet should be skipped if:
 * - It has all 504 variants
 * - It has a commit SHA that matches the current plugin commit SHA
 *
 * @param componentSet The ComponentSet to check
 * @param currentCommitSha The current commit SHA from the plugin
 * @returns True if the ComponentSet should be skipped
 */
export function shouldSkipComponentSet(
  componentSet: ComponentSetNode,
  currentCommitSha: string
): boolean {
  // Check if complete
  if (!isComponentSetComplete(componentSet)) {
    logger.info(
      `${componentSet.name}: Not complete (${getVariantCount(componentSet)}/${EXPECTED_VARIANT_COUNT} variants)`
    );
    return false;
  }

  // Check commit SHA
  const storedSha = getCommitSha(componentSet);
  if (!storedSha) {
    logger.info(`${componentSet.name}: No commit SHA stored`);
    return false;
  }

  if (storedSha !== currentCommitSha) {
    logger.info(
      `${componentSet.name}: Commit SHA mismatch (stored: ${storedSha.substring(0, 7)}, current: ${currentCommitSha.substring(0, 7)})`
    );
    return false;
  }

  logger.info(`${componentSet.name}: Already up-to-date (complete with matching commit SHA)`);
  return true;
}

/**
 * Get all variant hashes from a ComponentSet
 * @param componentSet The ComponentSet to read from
 * @returns A map of variant names to their SVG hashes
 */
export function getVariantHashes(componentSet: ComponentSetNode): Map<string, string> {
  const hashes = new Map<string, string>();

  for (const child of componentSet.children) {
    if (child.type === 'COMPONENT') {
      const hash = getSvgHash(child);
      if (hash) {
        hashes.set(child.name, hash);
      }
    }
  }

  return hashes;
}

/**
 * Find a ComponentSet by name on a page
 * @param page The page to search
 * @param iconName The name of the icon to find
 * @returns The ComponentSet if found, null otherwise
 */
export function findComponentSet(page: PageNode, iconName: string): ComponentSetNode | null {
  const node = page.findOne((n) => n.type === 'COMPONENT_SET' && n.name === iconName);
  return node as ComponentSetNode | null;
}

/**
 * Result of checking if an icon needs updating
 */
export interface UpdateCheckResult {
  /** Whether the icon needs any updates */
  needsUpdate: boolean;
  /** Reason for the update decision */
  reason: string;
  /** If true, all variants should be regenerated */
  fullRegeneration: boolean;
  /** If true, only missing variants should be added */
  fillGapsOnly: boolean;
  /** Existing ComponentSet if found */
  existingComponentSet: ComponentSetNode | null;
  /** Number of existing variants */
  existingVariantCount: number;
  /** Stored commit SHA */
  storedCommitSha: string | null;
}

/**
 * Determine if an icon needs updating and what kind of update
 * @param page The page to search
 * @param iconName The name of the icon
 * @param currentCommitSha The current commit SHA from the plugin
 * @returns Details about whether and how the icon should be updated
 */
export function checkIconNeedsUpdate(
  page: PageNode,
  iconName: string,
  currentCommitSha: string
): UpdateCheckResult {
  const existingComponentSet = findComponentSet(page, iconName);

  // Icon doesn't exist - needs full generation
  if (!existingComponentSet) {
    return {
      needsUpdate: true,
      reason: 'Icon does not exist',
      fullRegeneration: true,
      fillGapsOnly: false,
      existingComponentSet: null,
      existingVariantCount: 0,
      storedCommitSha: null,
    };
  }

  const variantCount = getVariantCount(existingComponentSet);
  const storedSha = getCommitSha(existingComponentSet);

  // Log the actual values for debugging
  logger.info(`${iconName} metadata check:`, {
    variantCount,
    isComplete: variantCount === EXPECTED_VARIANT_COUNT,
    storedSha: storedSha ? storedSha.substring(0, 7) : 'null',
    currentSha: currentCommitSha.substring(0, 7),
    shaMatch: storedSha === currentCommitSha,
  });

  // Icon is incomplete - fill gaps with current commit
  if (!isComponentSetComplete(existingComponentSet)) {
    return {
      needsUpdate: true,
      reason: `Incomplete (${variantCount}/${EXPECTED_VARIANT_COUNT} variants)`,
      fullRegeneration: false,
      fillGapsOnly: true,
      existingComponentSet,
      existingVariantCount: variantCount,
      storedCommitSha: storedSha,
    };
  }

  // No commit SHA stored - treat as outdated, full regeneration
  if (!storedSha) {
    return {
      needsUpdate: true,
      reason: 'No commit SHA stored (legacy component)',
      fullRegeneration: true,
      fillGapsOnly: false,
      existingComponentSet,
      existingVariantCount: variantCount,
      storedCommitSha: null,
    };
  }

  // Commit SHA matches - icon is up-to-date
  if (storedSha === currentCommitSha) {
    return {
      needsUpdate: false,
      reason: 'Already up-to-date (complete with matching commit SHA)',
      fullRegeneration: false,
      fillGapsOnly: false,
      existingComponentSet,
      existingVariantCount: variantCount,
      storedCommitSha: storedSha,
    };
  }

  // Commit SHA differs - needs update (will compare SVG hashes per variant)
  return {
    needsUpdate: true,
    reason: `Commit SHA mismatch (stored: ${storedSha.substring(0, 7)}, current: ${currentCommitSha.substring(0, 7)})`,
    fullRegeneration: false,
    fillGapsOnly: false,
    existingComponentSet,
    existingVariantCount: variantCount,
    storedCommitSha: storedSha,
  };
}

/**
 * Log the update check result for debugging
 * @param iconName The icon name
 * @param result The update check result
 */
export function logUpdateCheckResult(iconName: string, result: UpdateCheckResult): void {
  if (!result.needsUpdate) {
    logger.info(`${iconName}: SKIP - ${result.reason}`);
    return;
  }

  if (result.fullRegeneration) {
    logger.info(`${iconName}: REGENERATE ALL - ${result.reason}`);
  } else if (result.fillGapsOnly) {
    logger.info(`${iconName}: FILL GAPS - ${result.reason}`);
  } else {
    logger.info(`${iconName}: SMART UPDATE - ${result.reason}`);
  }
}
