/**
 * @module @figma/icons/incremental-updater
 *
 * Handles incremental updates of existing icon components
 *
 * Key features:
 * - Only updates changed variants (based on content hash)
 * - Adds missing variants to existing component sets
 * - Minimizes Figma version bloat by avoiding unnecessary updates
 * - Preserves existing variant order and structure
 *
 * This is critical for performance when updating large icon libraries (3900+ icons × 504 variants)
 */

import { logger } from '@lib/utils';
import type { IconStyle, IconVariant } from '@lib/github';
import { cleanupVariantFills } from './variant-utils';

/**
 * Unique identifier for an icon variant
 *
 * @interface VariantKey
 * @property {IconStyle} style - Icon style (rounded, sharp, outlined)
 * @property {IconVariant} variant - Variant properties (weight, fill, grade, size)
 */
export interface VariantKey {
  style: IconStyle;
  variant: IconVariant;
}

/**
 * Information about a variant's update status
 *
 * @interface VariantUpdateInfo
 * @property {VariantKey} key - Variant identifier
 * @property {boolean} exists - Whether variant exists in component set
 * @property {boolean} needsUpdate - Whether variant needs updating (hash changed)
 * @property {Date} [figmaDate] - Last modified date in Figma
 * @property {Date} [githubDate] - Last modified date from GitHub
 * @property {ComponentNode} [component] - Reference to existing component if present
 */
export interface VariantUpdateInfo {
  key: VariantKey;
  exists: boolean;
  needsUpdate: boolean;
  figmaDate?: Date;
  githubDate?: Date;
  component?: ComponentNode;
}

/**
 * Result of analyzing a component for update needs
 *
 * @interface ComponentUpdateResult
 * @property {ComponentSetNode | null} componentSet - The component set being analyzed
 * @property {boolean} exists - Whether component set exists
 * @property {number} totalVariants - Total number of variants expected (504)
 * @property {number} existingVariants - Number of variants currently present
 * @property {VariantKey[]} missingVariants - Variants that need to be added
 * @property {VariantUpdateInfo[]} staleVariants - Variants that need updating (changed)
 * @property {number} upToDateVariants - Variants that don't need changes
 */
export interface ComponentUpdateResult {
  componentSet: ComponentSetNode | null;
  exists: boolean;
  totalVariants: number;
  existingVariants: number;
  missingVariants: VariantKey[];
  staleVariants: VariantUpdateInfo[];
  upToDateVariants: number;
}

/**
 * Format variant name using legacy Figma naming convention
 * Format: "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 */
function formatVariantName(style: IconStyle, variant: IconVariant): string {
  // Capitalize style
  const styleCapitalized = style.charAt(0).toUpperCase() + style.slice(1);

  // Convert fill to On/Off
  const fillText = variant.fill === 1 ? 'On' : 'Off';

  // Convert grade to text
  let gradeText: string;
  if (variant.grade === 200) {
    gradeText = 'Emphasis';
  } else if (variant.grade === -25) {
    gradeText = 'Dark theme';
  } else {
    gradeText = 'Normal';
  }

  return `Style=${styleCapitalized}, Weight=${variant.weight}, Fill=${fillText}, Grade=${gradeText}, Optical size=${variant.opticalSize}dp`;
}

/**
 * Generate a variant property string for matching (normalized format)
 * Format: "style=rounded, weight=400, fill=0, grade=0, size=24"
 */
function generateVariantProps(style: IconStyle, variant: IconVariant): string {
  return `style=${style}, weight=${variant.weight}, fill=${variant.fill}, grade=${variant.grade}, size=${variant.opticalSize}`;
}

/**
 * Parse variant properties from component name
 * Safer than accessing variantProperties which can fail on problematic component sets
 * Handles multiple formats:
 * - New: "style=rounded, weight=400, fill=0, grade=0, size=24"
 * - Legacy: "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 */
function parseVariantPropsFromName(componentName: string): VariantKey | null {
  try {
    // Split by comma and parse key=value pairs
    const pairs = componentName.split(',').map((p) => p.trim());
    const props: Record<string, string> = {};

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map((s) => s.trim());
      if (key && value) {
        // Normalize key to lowercase
        props[key.toLowerCase().replace(/\s+/g, '')] = value;
      }
    }

    // Parse style (handle both lowercase and capitalized)
    const style = (props.style || props.Style)?.toLowerCase() as IconStyle;

    // Parse weight
    const weight = parseInt(props.weight || props.Weight) as IconVariant['weight'];

    // Parse fill (handle both numeric and string values)
    let fill: 0 | 1;
    const fillValue = props.fill || props.Fill;
    if (fillValue === 'On' || fillValue === '1' || fillValue === 'true') {
      fill = 1;
    } else if (fillValue === 'Off' || fillValue === '0' || fillValue === 'false') {
      fill = 0;
    } else {
      fill = parseInt(fillValue) as 0 | 1;
    }

    // Parse grade (handle both numeric and string values)
    let grade: IconVariant['grade'];
    const gradeValue = props.grade || props.Grade;
    if (gradeValue === 'Emphasis') {
      grade = 200;
    } else if (gradeValue === 'Dark theme') {
      grade = -25;
    } else if (gradeValue === 'Normal') {
      grade = 0;
    } else {
      grade = parseInt(gradeValue) as IconVariant['grade'];
    }

    // Parse size (handle both with and without "dp" suffix)
    const sizeValue = props.size || props.opticalsize;
    let size: IconVariant['opticalSize'];
    if (sizeValue) {
      size = parseInt(sizeValue.replace('dp', '')) as IconVariant['opticalSize'];
    } else {
      return null; // Invalid - can't parse size
    }

    if (!style || isNaN(weight) || isNaN(fill) || isNaN(grade) || isNaN(size)) {
      return null;
    }

    return {
      style,
      variant: { weight, fill, grade, opticalSize: size },
    };
  } catch {
    // Don't log - parsing failures are normal and we have a fallback
    return null;
  }
}

/**
 * Parse variant properties from a Figma component
 * Returns null if the component doesn't have the expected properties
 * First tries component name (safer), then falls back to variantProperties
 */
function parseVariantProps(component: ComponentNode): VariantKey | null {
  // Try parsing from name first (safer, doesn't access problematic variantProperties)
  const fromName = parseVariantPropsFromName(component.name);
  if (fromName) return fromName;

  // Fallback to variantProperties (may fail on problematic component sets)
  // Don't log warnings here since name parsing failure is expected for some formats
  try {
    const props = component.variantProperties;
    if (!props) return null;

    // Expected properties: style, weight, fill, grade, size
    const style = props.style as IconStyle;
    const weight = parseInt(props.weight) as IconVariant['weight'];
    const fill = parseInt(props.fill) as 0 | 1;
    const grade = parseInt(props.grade) as IconVariant['grade'];
    const size = parseInt(props.size) as IconVariant['opticalSize'];

    if (!style || !weight || fill === undefined || grade === undefined || !size) {
      return null;
    }

    return {
      style,
      variant: { weight, fill, grade, opticalSize: size },
    };
  } catch {
    // Silently return null - this is expected for components with problematic parent sets
    return null;
  }
}

/**
 * Find an existing ComponentSet by icon name on the page
 * Searches recursively to handle nested components
 */
export function findExistingComponentSet(
  page: PageNode,
  iconName: string
): ComponentSetNode | null {
  function search(node: SceneNode): ComponentSetNode | null {
    if (node.type === 'COMPONENT_SET') {
      // Extract icon name from component name
      // Handle formats like: "home", "Material/home", "Icons/home"
      const name = node.name.split('/').pop()?.toLowerCase().trim();
      if (name === iconName.toLowerCase()) {
        return node;
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
    }

    return null;
  }

  for (const child of page.children) {
    const found = search(child);
    if (found) return found;
  }

  return null;
}

/**
 * Get the last modified date of a component in Figma
 * Uses the component's editedAt property if available
 */
function getComponentModifiedDate(component: ComponentNode): Date | null {
  try {
    // Figma doesn't expose editedAt directly, so we'll use a workaround:
    // Check if the component has a description with a timestamp
    // Format: "Last updated: 2025-10-12T18:00:00.000Z"
    if (component.description) {
      const match = component.description.match(/Last updated: (.+)/);
      if (match) {
        return new Date(match[1]);
      }
    }

    // If no timestamp found, assume it's old (needs update)
    // Return a very old date so it will be updated
    return new Date('2000-01-01');
  } catch (error) {
    logger.warn(`Failed to get modified date for component: ${error}`);
    return null;
  }
}

/**
 * Fetch the last commit date for an SVG file from GitHub
 * Uses the GitHub API to get commit history
 *
 * NOTE: Currently unused, but kept for potential future use
 */
/*
async function getSVGLastModifiedDate(url: string): Promise<Date | null> {
  try {
    // Convert raw GitHub URL to API URL
    // From: https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/home/materialsymbolsrounded/home_24px.svg
    // To: https://api.github.com/repos/google/material-design-icons/commits?path=symbols/web/home/materialsymbolsrounded/home_24px.svg&page=1&per_page=1

    const match = url.match(/githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (!match) {
      logger.warn(`Could not parse GitHub URL: ${url}`);
      return null;
    }

    const [, owner, repo, _ref, filePath] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}&page=1&per_page=1`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      // Rate limit or other error - assume file is new
      return new Date();
    }

    const commits = await response.json();
    if (commits && commits.length > 0) {
      const lastCommit = commits[0];
      const commitDate = lastCommit.commit.author.date;
      return new Date(commitDate);
    }

    // No commits found - assume file is new
    return new Date();
  } catch (error) {
    logger.warn(`Failed to get GitHub last modified date: ${error}`);
    // On error, assume file is new (will trigger update)
    return new Date();
  }
}
*/

/**
 * Analyze an existing ComponentSet to determine what needs updating
 */
export async function analyzeComponentForUpdate(
  componentSet: ComponentSetNode,
  expectedVariants: VariantKey[],
  variantUrls: Map<string, string> // Map of variant key string to GitHub URL
): Promise<ComponentUpdateResult> {
  logger.info(`Analyzing existing component: ${componentSet.name}`);

  // Get all existing variants
  const existingVariants = componentSet.children as ComponentNode[];
  const existingVariantMap = new Map<string, ComponentNode>();

  for (const component of existingVariants) {
    const variantKey = parseVariantProps(component);
    if (variantKey) {
      const keyStr = generateVariantProps(variantKey.style, variantKey.variant);
      existingVariantMap.set(keyStr, component);
    }
  }

  // Determine missing and stale variants
  const missingVariants: VariantKey[] = [];
  const staleVariants: VariantUpdateInfo[] = [];
  let upToDateVariants = 0;

  for (const expectedVariant of expectedVariants) {
    const keyStr = generateVariantProps(expectedVariant.style, expectedVariant.variant);
    const existingComponent = existingVariantMap.get(keyStr);

    if (!existingComponent) {
      // Variant is missing - needs to be added
      missingVariants.push(expectedVariant);
    } else {
      // Variant exists - check if it needs updating
      const figmaDate = getComponentModifiedDate(existingComponent);
      const githubUrl = variantUrls.get(keyStr);

      if (!githubUrl) {
        logger.warn(`No URL found for variant: ${keyStr}`);
        upToDateVariants++;
        continue;
      }

      // For now, skip GitHub date check to avoid rate limiting
      // In production, you'd want to cache these dates or batch check them
      // For simplicity, we'll update based on description timestamp only

      if (!figmaDate || !existingComponent.description.includes('Last updated:')) {
        // No timestamp - assume it's old and needs update
        staleVariants.push({
          key: expectedVariant,
          exists: true,
          needsUpdate: true,
          figmaDate: figmaDate || undefined,
          component: existingComponent,
        });
      } else {
        // Has timestamp - assume it's up to date for now
        // In production, compare with GitHub date
        upToDateVariants++;
      }
    }
  }

  logger.info(`Component analysis:`);
  logger.info(`  Total expected variants: ${expectedVariants.length}`);
  logger.info(`  Existing variants: ${existingVariantMap.size}`);
  logger.info(`  Missing variants: ${missingVariants.length}`);
  logger.info(`  Stale variants: ${staleVariants.length}`);
  logger.info(`  Up-to-date variants: ${upToDateVariants}`);

  return {
    componentSet,
    exists: true,
    totalVariants: expectedVariants.length,
    existingVariants: existingVariantMap.size,
    missingVariants,
    staleVariants,
    upToDateVariants,
  };
}

/**
 * Get SVG content hash from a component for fast comparison
 * Uses pluginData to store/retrieve a simple hash of the SVG content
 */
function getComponentSvgHash(component: ComponentNode): string | null {
  try {
    return component.getPluginData('svgHash') || null;
  } catch {
    return null;
  }
}

/**
 * Store SVG content hash in component pluginData for future comparisons
 */
function setComponentSvgHash(component: ComponentNode, svgContent: string): void {
  try {
    // Simple hash: use length and first/last 100 chars
    // This is fast and catches most differences without full comparison
    const hash = `${svgContent.length}:${svgContent.substring(0, 100)}:${svgContent.substring(Math.max(0, svgContent.length - 100))}`;
    component.setPluginData('svgHash', hash);
  } catch (error) {
    logger.warn(`Failed to store SVG hash: ${error}`);
  }
}

/**
 * Get SVG content from a component by exporting it
 * This is slower than hash comparison but more accurate
 */
async function getComponentSvgContent(component: ComponentNode): Promise<string> {
  try {
    // First try to get from cache/hash
    const cachedHash = getComponentSvgHash(component);
    if (cachedHash) {
      // Return the hash for comparison (not the actual SVG)
      return cachedHash;
    }

    // Fall back to exporting (slower but works for legacy components)
    const svgData = await component.exportAsync({ format: 'SVG' });
    const svgString = new TextDecoder().decode(svgData);
    return svgString;
  } catch (error) {
    logger.warn(`Failed to export component SVG: ${error}`);
    return '';
  }
}

/**
 * Compare SVG content efficiently using hash if available, full content otherwise
 */
async function isSvgContentEqual(
  component: ComponentNode,
  newSvgContent: string
): Promise<boolean> {
  const cachedHash = getComponentSvgHash(component);

  if (cachedHash) {
    // Fast path: compare hashes
    const newHash = `${newSvgContent.length}:${newSvgContent.substring(0, 100)}:${newSvgContent.substring(Math.max(0, newSvgContent.length - 100))}`;
    return cachedHash === newHash;
  }

  // Slow path: export and compare full content
  const existingSvg = await getComponentSvgContent(component);
  return existingSvg === newSvgContent;
}

/**
 * Update a specific variant component with new SVG content
 */
export async function updateVariantComponent(
  component: ComponentNode,
  svgContent: string,
  variantKey: VariantKey
): Promise<void> {
  try {
    logger.info(`Updating variant: ${component.name}`);

    // Remove existing children
    for (const child of component.children) {
      child.remove();
    }

    // Create SVG node from content - this creates a Frame with vector inside
    const svgFrame = figma.createNodeFromSvg(svgContent);

    // Extract vector children from frame and add directly to component
    // This avoids the extra frame nesting
    const children = [...svgFrame.children];
    for (const child of children) {
      try {
        component.appendChild(child);
      } catch (error) {
        logger.warn(`Failed to move child node: ${error}`);
      }
    }

    // Remove the now-empty frame
    svgFrame.remove();

    // Resize component to optical size
    const size = variantKey.variant.opticalSize;
    component.resize(size, size);

    // Remove any fills from the component frame itself (icons should have no background)
    component.fills = [];

    // Update description with timestamp
    const timestamp = new Date().toISOString();
    component.description = `Last updated: ${timestamp}\nStyle: ${variantKey.style}, Weight: ${variantKey.variant.weight}, Fill: ${variantKey.variant.fill}, Grade: ${variantKey.variant.grade}, Size: ${variantKey.variant.opticalSize}`;

    // Store SVG hash for future comparisons
    setComponentSvgHash(component, svgContent);

    // Clean up any unnecessary fills from the component frame
    cleanupVariantFills(component);

    logger.info(`✓ Updated variant: ${component.name}`);
  } catch (error) {
    logger.error(`Failed to update variant ${component.name}: ${error}`);
    throw error;
  }
}

/**
 * Add a new variant to an existing ComponentSet
 */
export async function addVariantToComponentSet(
  componentSet: ComponentSetNode,
  svgContent: string,
  variantKey: VariantKey
): Promise<ComponentNode> {
  try {
    const { style, variant } = variantKey;

    // Check if variant already exists
    const expectedVariantKey = generateVariantProps(style, variant);
    const existingComponent = componentSet.children.find((child) => {
      if (child.type !== 'COMPONENT') return false;
      const existingKey = parseVariantProps(child as ComponentNode);
      if (!existingKey) return false;
      return generateVariantProps(existingKey.style, existingKey.variant) === expectedVariantKey;
    }) as ComponentNode | undefined;

    if (existingComponent) {
      // Variant exists - check if SVG content is different
      const isIdentical = await isSvgContentEqual(existingComponent, svgContent);

      if (isIdentical) {
        // SVG is identical - no update needed
        logger.info(`✓ Variant already up-to-date in ${componentSet.name}: ${expectedVariantKey}`);
        return existingComponent;
      } else {
        // SVG is different - update the existing component
        logger.info(`Updating existing variant in ${componentSet.name}: ${expectedVariantKey}`);
        await updateVariantComponent(existingComponent, svgContent, variantKey);
        return existingComponent;
      }
    }

    // Variant doesn't exist - create new component
    const svgFrame = figma.createNodeFromSvg(svgContent);
    const component = figma.createComponent();

    // Set component name to define variant properties using legacy Figma format
    // Format: "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
    component.name = formatVariantName(style, variant);

    // Size to optical size
    const size = variant.opticalSize;
    component.resize(size, size);
    component.fills = [];

    // Extract vector children from frame and add directly to component
    // This avoids the extra frame nesting
    const children = [...svgFrame.children];
    for (const child of children) {
      try {
        component.appendChild(child);
      } catch (error) {
        logger.warn(`Failed to move child node: ${error}`);
      }
    }

    // Remove the now-empty frame
    svgFrame.remove();

    // Set description with timestamp
    const timestamp = new Date().toISOString();
    component.description = `Last updated: ${timestamp}\nStyle: ${style}, Weight: ${variant.weight}, Fill: ${variant.fill}, Grade: ${variant.grade}, Size: ${variant.opticalSize}`;

    // Store SVG hash for future comparisons
    setComponentSvgHash(component, svgContent);

    // Add to component set - Figma will automatically set variantProperties based on the name
    componentSet.appendChild(component);

    // Clean up any unnecessary fills from the component frame
    // This prevents "hidden fill" (#FFFFFF) that adds file weight
    cleanupVariantFills(component);

    logger.info(`✓ Added new variant to ${componentSet.name}`);

    return component;
  } catch (error) {
    logger.error(`Failed to add variant: ${error}`);
    throw error;
  }
}

/**
 * Remove extra Frame wrapper from variants that have the nested structure:
 * ComponentNode -> Frame -> Vector
 *
 * Should be: ComponentNode -> Vector
 *
 * This fixes variants that were created with the bug before it was fixed.
 */
export function cleanupExtraFramesInVariant(component: ComponentNode): boolean {
  try {
    let fixed = false;

    // Check if component has exactly one child and it's a Frame
    if (component.children.length === 1 && component.children[0].type === 'FRAME') {
      const frame = component.children[0] as FrameNode;

      // Extract all children from the frame
      const frameChildren = [...frame.children];

      if (frameChildren.length > 0) {
        logger.info(`Fixing extra frame in variant: ${component.name}`);

        // Move children from frame to component
        for (const child of frameChildren) {
          try {
            component.appendChild(child);
          } catch (error) {
            logger.warn(`Failed to move child from frame: ${error}`);
          }
        }

        // Remove the now-empty frame
        frame.remove();
        fixed = true;

        logger.info(`✓ Removed extra frame from: ${component.name}`);
      }
    }

    return fixed;
  } catch (error) {
    logger.warn(`Failed to cleanup frames in ${component.name}: ${error}`);
    return false;
  }
}

/**
 * Clean up all variants in a ComponentSet that have extra frame wrappers
 */
export function cleanupExtraFramesInComponentSet(componentSet: ComponentSetNode): number {
  let fixedCount = 0;

  for (const child of componentSet.children) {
    if (child.type === 'COMPONENT') {
      if (cleanupExtraFramesInVariant(child as ComponentNode)) {
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    logger.info(`Cleaned up ${fixedCount} variants in ${componentSet.name}`);
  }

  return fixedCount;
}

/**
 * Diagnostic function to inspect ComponentSet and variant properties
 *
 * Logs detailed information about what properties exist on the ComponentSet
 * and its variants to help debug property issues.
 */
export function diagnoseComponentSetProperties(componentSet: ComponentSetNode): void {
  logger.info(`\n🔍 DIAGNOSTIC: ${componentSet.name}`);
  logger.info(`=====================================`);

  // Check ComponentSet level properties
  if ('variantGroupProperties' in componentSet) {
    logger.info(`📦 ComponentSet.variantGroupProperties:`);
    try {
      const vgp = (
        componentSet as ComponentSetNode & { variantGroupProperties?: Record<string, unknown> }
      ).variantGroupProperties;
      if (vgp) {
        Object.keys(vgp).forEach((key) => {
          logger.info(`   ${key}: ${JSON.stringify(vgp[key])}`);
        });
      } else {
        logger.info(`   (none)`);
      }
    } catch (e) {
      logger.warn(`   Error reading variantGroupProperties: ${e}`);
    }
  }

  if ('componentPropertyDefinitions' in componentSet) {
    logger.info(`📦 ComponentSet.componentPropertyDefinitions:`);
    try {
      const cpd = componentSet.componentPropertyDefinitions;
      if (cpd && Object.keys(cpd).length > 0) {
        Object.keys(cpd).forEach((key) => {
          logger.info(`   ${key}: ${JSON.stringify(cpd[key])}`);
        });
      } else {
        logger.info(`   (none)`);
      }
    } catch (e) {
      logger.warn(`   Error reading componentPropertyDefinitions: ${e}`);
    }
  }

  // Check first few variants
  logger.info(`\n📋 Sample Variants (first 3):`);
  const variants = (componentSet.children as ComponentNode[]).slice(0, 3);

  variants.forEach((variant, idx) => {
    logger.info(`\n   Variant ${idx + 1}: ${variant.name}`);

    if ('componentPropertyDefinitions' in variant) {
      const cpd = variant.componentPropertyDefinitions;
      if (cpd && Object.keys(cpd).length > 0) {
        logger.info(`   ⚠️  componentPropertyDefinitions (SHOULD BE EMPTY):`);
        Object.keys(cpd).forEach((key) => {
          logger.info(`      ${key}: ${JSON.stringify(cpd[key])}`);
        });
      } else {
        logger.info(`   ✅ componentPropertyDefinitions: (empty - correct)`);
      }
    }

    if ('variantProperties' in variant) {
      const vp = variant.variantProperties;
      if (vp && Object.keys(vp).length > 0) {
        logger.info(`   ✅ variantProperties (values):`);
        Object.keys(vp).forEach((key) => {
          logger.info(`      ${key}: ${vp[key]}`);
        });
      }
    }
  });

  logger.info(`\n=====================================\n`);
}

/**
 * Clean up unnecessary fills from all variants in a ComponentSet
 *
 * When variants are created from SVG, component frames sometimes retain
 * unnecessary fills (typically white #FFFFFF backgrounds). This adds weight
 * to the Figma file, which is problematic with 100k+ variants.
 *
 * This function scans all variants in a ComponentSet and removes any fills
 * from the component frames, ensuring they have no background.
 *
 * @param {ComponentSetNode} componentSet - The component set to clean up
 * @returns {number} Number of variants that had fills removed
 *
 * @example
 * ```typescript
 * const componentSet = page.findOne(n => n.type === 'COMPONENT_SET');
 * if (componentSet) {
 *   const cleanedCount = cleanupVariantFillsInComponentSet(componentSet);
 *   logger.info(`Cleaned up ${cleanedCount} variants`);
 * }
 * ```
 */
export function cleanupVariantFillsInComponentSet(componentSet: ComponentSetNode): number {
  let cleanedCount = 0;

  for (const child of componentSet.children) {
    if (child.type === 'COMPONENT') {
      if (cleanupVariantFills(child as ComponentNode)) {
        cleanedCount++;
      }
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Cleaned up fills on ${cleanedCount} variant(s) in ${componentSet.name}`);
  }

  return cleanedCount;
}

/**
 * Scan all ComponentSets on a page and clean up variant fills
 *
 * This is a lightweight operation that quickly scans all icon ComponentSets and removes
 * unnecessary fills from variant component frames. It runs on all variants regardless
 * of whether the component has been changed since the current git SHA.
 *
 * Removes white (#FFFFFF) and other background fills from variant frames, reducing
 * file size and memory usage for files with 100k+ variants.
 *
 * @param {PageNode} page - The page to scan
 * @param {boolean} enableCleanup - Feature flag to enable/disable cleanup (defaults to false)
 * @returns {object} Cleanup statistics
 *
 * @example
 * ```typescript
 * const page = figma.currentPage;
 * const stats = await scanAndCleanupVariantFills(page, true);
 * logger.info(`Scanned ${stats.componentSetsScanned} sets, cleaned ${stats.variantsCleanedTotal}`);
 * ```
 */
export async function scanAndCleanupVariantFills(
  page: PageNode,
  enableCleanup = false
): Promise<{
  componentSetsScanned: number;
  variantsCleanedTotal: number;
  componentSetsWithIssues: number;
}> {
  if (!enableCleanup) {
    logger.info('Variant fill cleanup is disabled (feature flag: ENABLE_VARIANT_CLEANUP)');
    return {
      componentSetsScanned: 0,
      variantsCleanedTotal: 0,
      componentSetsWithIssues: 0,
    };
  }

  logger.info('Scanning page for variant fill issues...');

  let componentSetsScanned = 0;
  let variantsCleanedTotal = 0;
  let componentSetsWithIssues = 0;

  // Find all ComponentSets on the page
  const componentSets: ComponentSetNode[] = [];

  function findComponentSets(node: SceneNode) {
    if (node.type === 'COMPONENT_SET') {
      componentSets.push(node);
    } else if ('children' in node) {
      for (const child of node.children) {
        findComponentSets(child);
      }
    }
  }

  for (const child of page.children) {
    findComponentSets(child);
  }

  // Clean up each ComponentSet
  for (const componentSet of componentSets) {
    componentSetsScanned++;
    const cleanedCount = cleanupVariantFillsInComponentSet(componentSet);
    if (cleanedCount > 0) {
      componentSetsWithIssues++;
      variantsCleanedTotal += cleanedCount;
    }
  }

  logger.info(
    `Cleanup complete: Scanned ${componentSetsScanned} component sets, ` +
      `cleaned ${variantsCleanedTotal} variants in ${componentSetsWithIssues} sets`
  );

  return {
    componentSetsScanned,
    variantsCleanedTotal,
    componentSetsWithIssues,
  };
}

/**
 * Check if a variant is the default variant
 * Default: Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp
 */
function isDefaultVariant(component: ComponentNode): boolean {
  const name = component.name;
  return (
    name.includes('Style=Rounded') &&
    name.includes('Weight=400') &&
    name.includes('Fill=Off') &&
    name.includes('Grade=Normal') &&
    name.includes('Optical size=24dp')
  );
}

/**
 * Reorder variants in a component set:
 * - Default variant first (Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp)
 * - All others sorted alphabetically
 */
export function reorderComponentSetVariants(componentSet: ComponentSetNode): void {
  try {
    const components = componentSet.children.filter(
      (c) => c.type === 'COMPONENT'
    ) as ComponentNode[];

    if (components.length <= 1) {
      return; // Nothing to sort
    }

    // Separate default variant from others
    let defaultVariant: ComponentNode | null = null;
    const otherVariants: ComponentNode[] = [];

    for (const comp of components) {
      if (isDefaultVariant(comp)) {
        defaultVariant = comp;
      } else {
        otherVariants.push(comp);
      }
    }

    // Sort other variants alphabetically by name
    otherVariants.sort((a, b) => a.name.localeCompare(b.name));

    // Reorder: default first, then alphabetically sorted
    if (defaultVariant) {
      componentSet.insertChild(0, defaultVariant);
      otherVariants.forEach((comp, index) => {
        componentSet.insertChild(index + 1, comp);
      });
    } else {
      // No default variant, just sort alphabetically
      otherVariants.forEach((comp, index) => {
        componentSet.insertChild(index, comp);
      });
    }

    logger.info(`Reordered ${components.length} variants in ${componentSet.name}`);
  } catch (error) {
    logger.warn(`Failed to reorder variants in ${componentSet.name}: ${error}`);
  }
}

/**
 * Generate a summary message for incremental updates
 */
export function getUpdateSummary(result: ComponentUpdateResult): string {
  if (!result.exists) {
    return 'Component does not exist - will create new';
  }

  const parts: string[] = [];

  if (result.missingVariants.length > 0) {
    parts.push(`${result.missingVariants.length} variants to add`);
  }

  if (result.staleVariants.length > 0) {
    parts.push(`${result.staleVariants.length} variants to update`);
  }

  if (result.upToDateVariants > 0) {
    parts.push(`${result.upToDateVariants} already up-to-date`);
  }

  return parts.join(', ') || 'All variants up-to-date';
}
