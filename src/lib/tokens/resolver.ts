/**
 * Variable resolver that dynamically finds and caches variable IDs at runtime.
 *
 * This system ensures that variable IDs are always resolved correctly, regardless of:
 * - Project changes
 * - Library version updates
 * - Different Figma files
 * - Variable ID changes over time
 *
 * Priority order:
 * 1. Library sources (authoritative, up-to-date)
 * 2. Page elements (fallback when library unavailable)
 */

import { logger } from '@lib/utils';

/**
 * Paint with bound variable (partial type for our needs)
 */
interface PaintWithBinding {
  boundVariables?: {
    color?: { id: string };
  };
}

/**
 * Node with bound variables
 */
interface NodeWithBoundVars {
  boundVariables?: {
    topLeftRadius?: { id: string };
  };
}

interface VariableInfo {
  id: string;
  key: string;
  name: string;
  collection?: string;
  source: 'library' | 'page';
}

// Cache for resolved variables
const variableCache = new Map<string, VariableInfo>();

/**
 * Resolve a variable by name, using library as primary source
 */
export async function resolveVariable(targetName: string): Promise<VariableInfo | null> {
  // Check cache first
  const cached = variableCache.get(targetName);
  if (cached) {
    logger.debug(`Using cached variable: ${targetName} (${cached.source})`);
    return cached;
  }

  logger.debug(`Resolving variable: ${targetName}`);

  // Method 1: Try library sources first (most reliable)
  const libraryVar = await resolveFromLibrary(targetName);
  if (libraryVar) {
    variableCache.set(targetName, libraryVar);
    logger.info(`✓ Resolved from library: ${targetName}`);
    return libraryVar;
  }

  // Method 2: Fall back to existing page elements
  const pageVar = await resolveFromPage(targetName);
  if (pageVar) {
    variableCache.set(targetName, pageVar);
    logger.info(`✓ Resolved from page: ${targetName}`);
    return pageVar;
  }

  logger.warn(`✗ Could not resolve: ${targetName}`);
  return null;
}

/**
 * Method 1: Resolve from library collections (primary source)
 */
async function resolveFromLibrary(targetName: string): Promise<VariableInfo | null> {
  try {
    const libraryCollections =
      await figma.teamLibrary?.getAvailableLibraryVariableCollectionsAsync?.();
    if (!libraryCollections || libraryCollections.length === 0) {
      return null;
    }

    let bestMatch: {
      score: number;
      variable: { name: string; key: string; resolvedType: string };
      collection: { name: string };
    } | null = null;

    // Search through each collection
    for (const collection of libraryCollections) {
      try {
        const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
          collection.key
        );

        // Find the best matching variable
        for (const variable of variables) {
          const score = calculateMatchScore(variable.name, targetName);
          if (score >= 0) {
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { score, variable, collection };
            }
          }
        }
      } catch (e) {
        console.log(`Could not search collection ${collection.name}: ${e}`);
      }
    }

    // Import the best match if found
    if (bestMatch) {
      try {
        const imported = await figma.variables.importVariableByKeyAsync(bestMatch.variable.key);
        if (imported) {
          console.log(
            `Best match for "${targetName}": ${imported.name} (score: ${bestMatch.score})`
          );
          return {
            id: imported.id,
            key: bestMatch.variable.key,
            name: imported.name,
            collection: bestMatch.collection.name,
            source: 'library',
          };
        }
      } catch (e) {
        console.log(`Could not import variable ${bestMatch.variable.name}: ${e}`);
      }
    }
  } catch {
    console.log('Library access not available');
  }

  return null;
}

/**
 * Method 2: Resolve from existing page components (fallback)
 */
async function resolveFromPage(targetName: string): Promise<VariableInfo | null> {
  try {
    const componentSets = figma.currentPage.findAll((node) => node.type === 'COMPONENT_SET');

    // Collect all bound variables with their scores
    let bestMatch: { score: number; name: string; id: string } | null = null;

    for (const componentSet of componentSets) {
      // Check fills
      if ('fills' in componentSet) {
        const fills = componentSet.fills as readonly PaintWithBinding[];
        for (const fill of fills) {
          if (fill.boundVariables?.color?.id) {
            try {
              const variable = await figma.variables.getVariableByIdAsync(
                fill.boundVariables.color.id
              );
              if (variable) {
                const score = calculateMatchScore(variable.name, targetName);
                if (score >= 0 && (!bestMatch || score > bestMatch.score)) {
                  bestMatch = { score, name: variable.name, id: variable.id };
                }
              }
            } catch {
              // Variable might not be accessible
            }
          }
        }
      }

      // Check strokes
      if ('strokes' in componentSet) {
        const strokes = componentSet.strokes as readonly PaintWithBinding[];
        for (const stroke of strokes) {
          if (stroke.boundVariables?.color?.id) {
            try {
              const variable = await figma.variables.getVariableByIdAsync(
                stroke.boundVariables.color.id
              );
              if (variable) {
                const score = calculateMatchScore(variable.name, targetName);
                if (score >= 0 && (!bestMatch || score > bestMatch.score)) {
                  bestMatch = { score, name: variable.name, id: variable.id };
                }
              }
            } catch {
              // Variable might not be accessible
            }
          }
        }
      }

      // Check corner radius
      const boundVars = (componentSet as NodeWithBoundVars).boundVariables;
      if (boundVars?.topLeftRadius?.id) {
        try {
          const variable = await figma.variables.getVariableByIdAsync(boundVars.topLeftRadius.id);
          if (variable) {
            const score = calculateMatchScore(variable.name, targetName);
            if (score >= 0 && (!bestMatch || score > bestMatch.score)) {
              bestMatch = { score, name: variable.name, id: variable.id };
            }
          }
        } catch {
          // Variable might not be accessible
        }
      }
    }

    // Return the best match if found
    if (bestMatch) {
      console.log(
        `Best page match for "${targetName}": ${bestMatch.name} (score: ${bestMatch.score})`
      );
      return {
        id: bestMatch.id,
        key: '', // Not available from page elements
        name: bestMatch.name,
        source: 'page',
      };
    }
  } catch {
    console.log('Page search failed');
  }

  return null;
}

/**
 * Calculate a match score for a variable name against a target
 * Uses hierarchical scoring similar to CSS specificity
 *
 * Scoring system:
 * - Exact match: 1000 points
 * - Leaf node match: 100 points
 * - Each parent segment match: 10 points
 * - Partial matches get lower scores
 *
 * @returns Score >= 0 if match, -1 if no match
 */
function calculateMatchScore(variableName: string, targetName: string): number {
  // Exact match is highest priority
  if (variableName === targetName) {
    return 1000;
  }

  // Split into path segments
  const varSegments = variableName.split('/');
  const targetSegments = targetName.split('/');

  // Get the leaf (last segment) of each path
  const varLeaf = varSegments[varSegments.length - 1];
  const targetLeaf = targetSegments[targetSegments.length - 1];

  // No match if leaf nodes don't match (considering variations)
  if (!isLeafMatch(varLeaf, targetLeaf)) {
    return -1;
  }

  // Start with base score for leaf match
  let score = 100;

  // Add points for each matching parent segment
  // Work backwards from the leaf to give more weight to closer parents
  for (let i = 0; i < targetSegments.length - 1; i++) {
    const targetSegment = targetSegments[i].toLowerCase();

    // Check if this parent segment appears in the variable path
    for (let j = 0; j < varSegments.length - 1; j++) {
      const varSegment = varSegments[j].toLowerCase();

      if (varSegment === targetSegment) {
        // Higher score for matches closer to the leaf
        const distance = Math.min(
          Math.abs(targetSegments.length - 1 - i),
          Math.abs(varSegments.length - 1 - j)
        );
        score += 10 * (1 / (distance + 1));
      }
    }
  }

  return score;
}

/**
 * Check if two leaf segments match (with variations)
 */
function isLeafMatch(varLeaf: string, targetLeaf: string): boolean {
  // Exact match
  if (varLeaf === targetLeaf) {
    return true;
  }

  // Case-insensitive match
  if (varLeaf.toLowerCase() === targetLeaf.toLowerCase()) {
    return true;
  }

  // Handle hyphen/camelCase variations
  const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, '');
  if (normalize(varLeaf) === normalize(targetLeaf)) {
    return true;
  }

  // Handle special cases
  // surface-bright might be stored as surfaceBright
  if (targetLeaf === 'surface-bright' && varLeaf === 'surfaceBright') return true;
  if (targetLeaf === 'on-background' && varLeaf === 'onBackground') return true;
  if (targetLeaf === 'small' && varLeaf === 'smallBorderRadius') return true;

  return false;
}

/**
 * Check if a variable name matches our target (legacy function for compatibility)
 * NOTE: Currently unused, but kept for potential future use
 */
/*
function isVariableMatch(variableName: string, targetName: string): boolean {
  return calculateMatchScore(variableName, targetName) >= 0;
}
*/

/**
 * Batch resolve multiple variables
 */
export async function resolveVariables(targetNames: string[]): Promise<Map<string, VariableInfo>> {
  const resolved = new Map<string, VariableInfo>();

  for (const name of targetNames) {
    const info = await resolveVariable(name);
    if (info) {
      resolved.set(name, info);
    }
  }

  return resolved;
}

/**
 * Clear the variable cache (useful when library might have changed)
 */
export function clearVariableCache(): void {
  variableCache.clear();
  console.log('Variable cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; sources: { library: number; page: number } } {
  let library = 0;
  let page = 0;

  for (const info of variableCache.values()) {
    if (info.source === 'library') library++;
    else if (info.source === 'page') page++;
  }

  return {
    size: variableCache.size,
    sources: { library, page },
  };
}
