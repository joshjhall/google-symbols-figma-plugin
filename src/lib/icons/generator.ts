/**
 * @module @figma/icons/generator
 *
 * Icon generation and management module for Material Icons.
 * Handles creating, updating, and organizing icon components with all variants.
 */

import { logger, hashSvg } from '@lib/utils';
import { applyMUIVariables } from '@lib/tokens';
import { IconGenerationError } from '@lib/utils/errors';
import { PLUGIN_DATA_KEYS } from '@lib/constants';
import type { IconVariant, IconStyle } from '@lib/github';
import {
  getVariantName,
  sortComponentsForDefault,
  ensureDefaultVariantFirst,
} from './variant-formatter';
import { createVariantComponent, updateVariantComponent, getStoredHash } from './component-factory';

/**
 * Variant data with SVG content
 */
export interface VariantData {
  iconName: string;
  style: IconStyle;
  variant: IconVariant;
  svgContent: string;
}

/**
 * Update mode for existing components
 */
export type UpdateMode = 'merge' | 'replace' | 'skip';

/**
 * Configuration for icon generation
 */
export interface GeneratorConfig {
  /** Apply MUI variable bindings */
  applyVariables?: boolean;
  /** Preserve existing variable bindings when updating */
  preserveBindings?: boolean;
  /** Clean existing variants before generating */
  cleanExisting?: boolean;
  /** Page to generate icons on */
  page?: PageNode;
  /** How to handle existing components */
  updateMode?: UpdateMode;
  /** Check SVG content changes and update if different */
  checkContentChanges?: boolean;
  /** Remove variants not in the requested set */
  removeUnrequestedVariants?: boolean;
  /** Git commit SHA to store on ComponentSet for version tracking */
  commitSha?: string;
  /** Layout configuration for positioning components */
  layout?: {
    startX?: number;
    startY?: number;
    itemsPerRow?: number;
    gapX?: number;
    gapY?: number;
  };
}

/**
 * Internal config type with required defaults applied
 */
interface InitializedConfig extends GeneratorConfig {
  layout: {
    startX: number;
    startY: number;
    itemsPerRow: number;
    gapX: number;
    gapY: number;
  };
}

/**
 * Result of icon generation
 */
export interface GenerationResult {
  componentSet: ComponentSetNode;
  variantsCreated: number;
  variantsUpdated: number;
  variantsSkipped: number;
}

/**
 * Icon generator class for managing Material Icon components
 *
 * Handles the complete lifecycle of icon component creation and updates:
 * - Converts SVG content to Figma components
 * - Creates component sets with 504 variants per icon
 * - Manages incremental updates (only changed variants)
 * - Applies Material Design 3 variable bindings
 * - Tracks metadata for smart skip/update decisions
 * - Handles positioning in grid layout
 *
 * @class IconGenerator
 *
 * @example
 * ```typescript
 * const generator = new IconGenerator({
 *   applyVariables: true,
 *   commitSha: 'bb04090f',
 *   page: figma.currentPage
 * });
 *
 * const result = await generator.generateIcon('home', variantDataArray);
 * console.log(`Created ${result.variantsCreated} variants`);
 * ```
 */
export class IconGenerator {
  private config: InitializedConfig;
  private currentPosition: { x: number; y: number };
  private currentColumn: number;
  private maxHeight: number;

  /**
   * Create a new IconGenerator instance
   *
   * @param {GeneratorConfig} [config={}] - Configuration options
   * @param {boolean} [config.applyVariables=true] - Apply M3 variable bindings
   * @param {boolean} [config.preserveBindings=false] - Keep existing bindings on update
   * @param {boolean} [config.cleanExisting=false] - Remove old variants before generating
   * @param {PageNode} [config.page] - Target page for components
   * @param {UpdateMode} [config.updateMode='merge'] - How to handle existing components
   * @param {boolean} [config.checkContentChanges=true] - Compare SVG content hashes
   * @param {boolean} [config.removeUnrequestedVariants=true] - Clean up extra variants
   * @param {string} [config.commitSha] - Git SHA for version tracking
   * @param {object} [config.layout] - Grid layout configuration
   */
  constructor(config: GeneratorConfig = {}) {
    this.config = {
      applyVariables: true,
      preserveBindings: false,
      cleanExisting: false,
      updateMode: 'merge',
      checkContentChanges: true,
      removeUnrequestedVariants: true,
      ...config,
      // Layout must come after spread to ensure proper defaults
      layout: {
        startX: config.layout?.startX ?? 100,
        startY: config.layout?.startY ?? 100,
        itemsPerRow: config.layout?.itemsPerRow ?? 24,
        gapX: config.layout?.gapX ?? 24,
        gapY: config.layout?.gapY ?? 24,
      },
    } as InitializedConfig;

    // Initialize position tracking
    this.currentPosition = {
      x: this.config.layout.startX,
      y: this.config.layout.startY,
    };
    this.currentColumn = 0;
    this.maxHeight = 0;
  }

  /**
   * Get the next position for a component and update tracking
   *
   * Uses a grid-based layout system with consistent column spacing.
   * Automatically wraps to next row when reaching itemsPerRow limit.
   *
   * @private
   * @param {number} _width - Component width (unused, reserved for future use)
   * @param {number} height - Component height (typically 56px for icon sets)
   * @returns {{ x: number; y: number }} Position for the next component
   */
  private getNextPosition(_width: number, height: number): { x: number; y: number } {
    const layout = this.config.layout;

    // Use a consistent column width for uniform grid spacing
    // Component sets are typically 56x56, but may vary slightly
    // Use a standard width of 56 + gap for consistent columns
    const standardColumnWidth = 56;

    // Calculate position based on column index for consistent grid
    const position = {
      x: layout.startX + this.currentColumn * (standardColumnWidth + layout.gapX),
      y: this.currentPosition.y,
    };

    // Track the maximum height in this row
    this.maxHeight = Math.max(this.maxHeight, height);

    // Update column tracking for next component
    this.currentColumn++;

    if (this.currentColumn >= layout.itemsPerRow) {
      // Move to next row
      this.currentColumn = 0;
      this.currentPosition.y += this.maxHeight + layout.gapY;
      this.maxHeight = 0;
    }

    return position;
  }

  /**
   * Generate or update an icon component with all its variants
   *
   * Main entry point for icon generation. Handles both new icon creation and
   * incremental updates of existing icons. Uses metadata (commit SHA and content hash)
   * to determine what needs updating.
   *
   * Process:
   * 1. Check if icon exists and needs update (metadata comparison)
   * 2. Create ComponentSet or reuse existing
   * 3. Generate/update each variant (504 total)
   * 4. Apply Material Design 3 variable bindings
   * 5. Store metadata for future update checks
   * 6. Position in grid layout
   *
   * @param {string} iconName - Icon name (e.g., "home", "search")
   * @param {VariantData[]} variants - Array of variant data with SVG content (504 items)
   * @returns {Promise<GenerationResult>} Statistics about created/updated/skipped variants
   *
   * @example
   * ```typescript
   * const variants: VariantData[] = [
   *   { iconName: 'home', style: 'rounded', variant: {...}, svgContent: '<svg>...</svg>' },
   *   // ... 503 more variants
   * ];
   * const result = await generator.generateIcon('home', variants);
   * console.log(`Created: ${result.variantsCreated}, Updated: ${result.variantsUpdated}`);
   * ```
   */
  async generateIcon(iconName: string, variants: VariantData[]): Promise<GenerationResult> {
    const stopTimer = logger.time(`Generate ${iconName}`);

    try {
      // Check if component already exists
      const existingComponent = await this.findExistingComponent(iconName);

      if (existingComponent) {
        logger.info(`Updating existing component: ${iconName}`);
        return await this.updateComponent(existingComponent, variants);
      } else {
        logger.info(`Creating new component: ${iconName}`);
        return await this.createComponent(iconName, variants);
      }
    } finally {
      stopTimer();
    }
  }

  /**
   * Find existing component by name
   */
  private async findExistingComponent(iconName: string): Promise<ComponentSetNode | null> {
    const page = this.config.page || figma.currentPage;

    // Search for existing component set with matching name
    for (const node of page.children) {
      if (node.type === 'COMPONENT_SET' && node.name === iconName) {
        // Track the position of existing component for layout continuity
        // Don't move existing components, but update our position tracker
        // so new components continue from the right place
        this.updatePositionTracking(node.x + node.width, node.y, node.height);
        return node;
      }
    }

    return null;
  }

  /**
   * Update position tracking based on existing component location
   */
  private updatePositionTracking(rightEdge: number, y: number, height: number): void {
    const layout = this.config.layout;
    const standardColumnWidth = 56; // Same as in getNextPosition

    // Calculate which column this component is in based on its position
    const columnIndex = Math.round(
      (rightEdge - standardColumnWidth - layout.startX) / (standardColumnWidth + layout.gapX)
    );

    // Update our column tracking
    if (columnIndex >= 0) {
      this.currentColumn = columnIndex + 1; // Next component goes in next column

      // If we've filled a row, prepare for next row
      if (this.currentColumn >= layout.itemsPerRow) {
        this.currentColumn = 0;
        this.currentPosition.y = y + height + layout.gapY;
        this.maxHeight = 0;
      }
    }

    // Track max height for proper row spacing
    if (Math.abs(y - this.currentPosition.y) < 5) {
      // Allow small variance
      this.maxHeight = Math.max(this.maxHeight, height);
    }
  }

  /**
   * Create new component set from variants
   */
  private async createComponent(
    iconName: string,
    variants: VariantData[]
  ): Promise<GenerationResult> {
    const page = this.config.page || figma.currentPage;
    const components: ComponentNode[] = [];

    // Create individual component for each variant
    for (const variantData of variants) {
      const component = await createVariantComponent(variantData);
      if (component) {
        page.appendChild(component);
        components.push(component);
      }
    }

    if (components.length === 0) {
      throw new IconGenerationError(iconName, 'No components could be created', {
        variantCount: variants.length,
      });
    }

    // Sort to put default variant first
    sortComponentsForDefault(components);

    // Wait for components to be ready
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Combine into component set
    const componentSet = figma.combineAsVariants(components, page);
    componentSet.name = iconName;

    // Position the component set using grid layout
    const position = this.getNextPosition(componentSet.width, componentSet.height);
    componentSet.x = position.x;
    componentSet.y = position.y;

    // Ensure default variant is first in layer order
    ensureDefaultVariantFirst(componentSet);

    // Apply standard configuration
    await this.configureComponentSet(componentSet);

    return {
      componentSet,
      variantsCreated: components.length,
      variantsUpdated: 0,
      variantsSkipped: 0,
    };
  }

  /**
   * Update existing component with new/changed variants
   */
  private async updateComponent(
    componentSet: ComponentSetNode,
    variants: VariantData[]
  ): Promise<GenerationResult> {
    let variantsCreated = 0;
    let variantsUpdated = 0;
    let variantsSkipped = 0;
    let variantsRemoved = 0;

    // Get existing variants
    const existingVariants = new Map<string, ComponentNode>();
    for (const child of componentSet.children) {
      if (child.type === 'COMPONENT') {
        existingVariants.set(child.name, child);
      }
    }

    // Create a set of requested variant names for easy lookup
    const requestedVariantNames = new Set(variants.map((v) => getVariantName(v)));

    // Step 1: Remove unrequested variants (if configured)
    // Collect components to remove first, then remove them
    const componentsToRemove: ComponentNode[] = [];
    if (this.config.removeUnrequestedVariants) {
      for (const [name, component] of existingVariants) {
        if (!requestedVariantNames.has(name)) {
          logger.info(`Removing unrequested variant: ${name}`);
          componentsToRemove.push(component);
          existingVariants.delete(name);
          variantsRemoved++;
        }
      }

      // Remove components after iteration to avoid modifying collection during iteration
      for (const component of componentsToRemove) {
        try {
          component.remove();
        } catch (error) {
          logger.warn(`Failed to remove component: ${error}`);
        }
      }
    }

    // Step 2: Update existing variants that have changed
    // Step 3: Add new variants that don't exist
    for (const variantData of variants) {
      const variantName = getVariantName(variantData);
      const existing = existingVariants.get(variantName);

      if (existing) {
        // Check if we should update the existing variant
        const shouldUpdate = await this.shouldUpdateVariant(existing, variantData);

        if (shouldUpdate) {
          // Update existing variant
          await updateVariantComponent(existing, variantData);
          variantsUpdated++;
          logger.info(`Updated variant: ${variantName}`);
        } else {
          // Skip existing variant (no changes needed)
          variantsSkipped++;
        }
        existingVariants.delete(variantName);
      } else {
        // Create new variant
        const component = await createVariantComponent(variantData);
        if (component) {
          try {
            // Ensure componentSet still exists and is valid before appending
            if (componentSet && componentSet.parent) {
              componentSet.appendChild(component);
              variantsCreated++;
              logger.info(`Added new variant: ${variantName}`);
            } else {
              logger.warn(`ComponentSet no longer valid, skipping variant: ${variantName}`);
              component.remove();
            }
          } catch (error) {
            logger.error(`Failed to add variant ${variantName}: ${error}`);
            try {
              component.remove();
            } catch {
              // Ignore removal errors
            }
          }
        }
      }
    }

    // Log summary
    logger.info(`Component update summary for ${componentSet.name}:`);
    logger.info(`  - Added: ${variantsCreated} variants`);
    logger.info(`  - Updated: ${variantsUpdated} variants`);
    logger.info(`  - Removed: ${variantsRemoved} variants`);
    logger.info(`  - Unchanged: ${variantsSkipped} variants`);

    // Ensure default variant is first
    ensureDefaultVariantFirst(componentSet);

    // Always store commit SHA for version tracking, even if no variants changed
    if (this.config.commitSha) {
      try {
        componentSet.setPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA, this.config.commitSha);
        logger.info(
          `Stored commit SHA on ${componentSet.name}: ${this.config.commitSha.substring(0, 7)}`
        );
      } catch (error) {
        logger.warn(`Failed to store commit SHA on ${componentSet.name}:`, error);
      }
    }

    // Reapply full configuration if variants changed
    if (variantsCreated > 0 || variantsUpdated > 0 || variantsRemoved > 0) {
      await this.configureComponentSet(componentSet);
    }

    return {
      componentSet,
      variantsCreated,
      variantsUpdated,
      variantsSkipped,
    };
  }

  /**
   * Check if a variant should be updated based on content changes
   */
  private async shouldUpdateVariant(
    existing: ComponentNode,
    variantData: VariantData
  ): Promise<boolean> {
    // If not checking content changes, follow the update mode
    if (!this.config.checkContentChanges) {
      return this.config.updateMode === 'replace';
    }

    // Get the hash of the new SVG content
    const newHash = hashSvg(variantData.svgContent);

    // Try to get the stored hash from the component
    const storedHash = getStoredHash(existing);

    // If no stored hash, we should update (and store the hash)
    if (!storedHash) {
      logger.info(`No hash stored for ${existing.name}, will update`);
      return true;
    }

    // If hashes match, content hasn't changed
    if (storedHash === newHash) {
      return false;
    }

    // Hashes differ, content changed
    logger.info(`Content changed for ${existing.name}, will update`);
    return true;
  }

  /**
   * Configure component set with standard settings
   */
  private async configureComponentSet(componentSet: ComponentSetNode): Promise<void> {
    // Apply standard sizing
    componentSet.primaryAxisSizingMode = 'FIXED';
    componentSet.counterAxisSizingMode = 'FIXED';
    componentSet.resize(56, 56);

    // Configure auto-layout
    componentSet.layoutMode = 'VERTICAL';
    componentSet.primaryAxisAlignItems = 'MIN';
    componentSet.counterAxisAlignItems = 'MIN';
    componentSet.paddingLeft = 16;
    componentSet.paddingRight = 16;
    componentSet.paddingTop = 16;
    componentSet.paddingBottom = 16;
    componentSet.itemSpacing = 24;
    componentSet.clipsContent = true;

    // Basic styling
    componentSet.fills = [
      {
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 },
        opacity: 1,
      },
    ];

    componentSet.strokes = [
      {
        type: 'SOLID',
        color: { r: 0.8, g: 0.8, b: 0.8 },
      },
    ];
    componentSet.strokeWeight = 1;
    componentSet.strokeAlign = 'INSIDE';

    // Apply MUI variables if configured
    if (this.config.applyVariables) {
      await applyMUIVariables(componentSet);
    }

    // Store commit SHA for version tracking
    if (this.config.commitSha) {
      try {
        componentSet.setPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA, this.config.commitSha);
        logger.info(
          `Stored commit SHA on ${componentSet.name}: ${this.config.commitSha.substring(0, 7)}`
        );
      } catch (error) {
        logger.warn(`Failed to store commit SHA on ${componentSet.name}:`, error);
      }
    }
  }
}

/**
 * Default icon generator instance
 */
export const iconGenerator = new IconGenerator();
