/**
 * @module @figma/icons/batch-generator
 *
 * Batch generation utilities for processing multiple icons efficiently.
 *
 * This module provides high-level batch processing for generating multiple icons
 * in a single operation. It handles page setup, layout positioning, progress
 * tracking, and error recovery.
 *
 * **Features**:
 * - **Automatic Positioning**: Grid layout with configurable spacing
 * - **Progress Tracking**: Real-time UI updates
 * - **Error Recovery**: Individual icon failures don't stop batch
 * - **Performance Stats**: Duration, variants/second, average time
 * - **Smart Updates**: Uses IconGenerator's incremental update logic
 *
 * **Use Cases**:
 * - Generate multiple icons at once
 * - Test icon generation workflow
 * - Batch import from external source
 * - Refresh multiple icons after update
 *
 * @example Basic batch generation
 * ```typescript
 * const result = await generateBatchIcons({
 *   iconGroups: {
 *     home: {
 *       iconName: 'home',
 *       variants: homeVariants
 *     },
 *     search: {
 *       iconName: 'search',
 *       variants: searchVariants
 *     }
 *   },
 *   pageName: 'Test Icons',
 *   applyVariables: true
 * });
 *
 * console.log(`Created ${result.componentsCreated} components`);
 * console.log(`${result.totalVariants} variants`);
 * ```
 *
 * @example With custom layout
 * ```typescript
 * await generateBatchIcons({
 *   iconGroups: {...},
 *   layout: {
 *     startX: 200,
 *     startY: 200,
 *     spacing: 200,
 *     maxWidth: 3000
 *   }
 * });
 * ```
 */

import { IconGenerator, type VariantData, type GenerationResult } from './generator';
import { pageManager } from '@lib/pages/manager';
import { logger } from '@lib/utils';

/**
 * Configuration for batch icon generation
 *
 * @interface BatchConfig
 * @property {Record} iconGroups - Map of icon key to icon data
 *   Key is arbitrary identifier, value contains iconName and variants
 * @property {string} [pageName='Material Icons'] - Target page name
 * @property {boolean} [cleanPage=false] - Remove existing content on page
 * @property {boolean} [applyVariables=true] - Apply M3 variable bindings
 * @property {boolean} [preserveBindings=false] - Keep existing variable bindings
 * @property {object} [layout] - Layout configuration for positioning
 *
 * @example
 * ```typescript
 * const config: BatchConfig = {
 *   iconGroups: {
 *     'home-icon': {
 *       iconName: 'home',
 *       variants: [...]
 *     },
 *     'search-icon': {
 *       iconName: 'search',
 *       variants: [...]
 *     }
 *   },
 *   pageName: 'Material Icons',
 *   applyVariables: true
 * };
 * ```
 */
export interface BatchConfig {
  /** Icon groups to generate */
  iconGroups: Record<
    string,
    {
      iconName: string;
      variants: VariantData[];
    }
  >;
  /** Page name for generation */
  pageName?: string;
  /** Clean existing page content */
  cleanPage?: boolean;
  /** Apply MUI variables */
  applyVariables?: boolean;
  /** Preserve existing bindings */
  preserveBindings?: boolean;
  /** Layout configuration */
  layout?: {
    startX?: number;
    startY?: number;
    spacing?: number;
    maxWidth?: number;
  };
}

/**
 * Result of batch generation with statistics
 *
 * @interface BatchResult
 * @property {boolean} success - True if all icons generated without errors
 * @property {number} componentsCreated - Number of ComponentSets created
 * @property {number} totalVariants - Total variants created/updated across all icons
 * @property {Map<string, GenerationResult>} results - Per-icon generation results
 * @property {Map<string, Error>} errors - Per-icon errors (if any)
 * @property {number} duration - Total duration in milliseconds
 *
 * @example
 * ```typescript
 * const result = await generateBatchIcons(config);
 *
 * if (result.success) {
 *   console.log(`✓ ${result.componentsCreated} icons generated`);
 *   console.log(`${result.totalVariants} total variants`);
 *   console.log(`Completed in ${result.duration}ms`);
 * } else {
 *   console.log(`${result.errors.size} icons failed`);
 *   for (const [icon, error] of result.errors) {
 *     console.error(`${icon}: ${error.message}`);
 *   }
 * }
 * ```
 */
export interface BatchResult {
  success: boolean;
  componentsCreated: number;
  totalVariants: number;
  results: Map<string, GenerationResult>;
  errors: Map<string, Error>;
  duration: number;
}

/**
 * Generate multiple icons in batch with automatic positioning
 *
 * Processes multiple icons efficiently using the IconGenerator with automatic
 * grid layout positioning. Continues on individual icon failures and reports
 * comprehensive statistics.
 *
 * **Algorithm**:
 * 1. Create/get target page
 * 2. Initialize IconGenerator with grid layout
 * 3. For each icon:
 *    - Generate using IconGenerator (smart updates)
 *    - Position in grid with configurable spacing
 *    - Track success/failure
 *    - Yield periodically to prevent UI blocking
 * 4. Report statistics and zoom to view
 *
 * **Performance**:
 * - Processes icons sequentially (one at a time)
 * - Yields every 10 icons to keep UI responsive
 * - Typical: ~1-5 seconds per icon (depends on variants)
 * - Reports variants/second throughput
 *
 * **Error Handling**:
 * - Individual icon failures don't stop batch
 * - All errors collected in result.errors map
 * - success=false if any icon failed
 * - Partial results still returned
 *
 * @param {BatchConfig} config - Batch generation configuration
 * @returns {Promise<BatchResult>} Generation results and statistics
 *
 * @example Generate test icons
 * ```typescript
 * const result = await generateBatchIcons({
 *   iconGroups: {
 *     test1: { iconName: 'home', variants: homeVariants },
 *     test2: { iconName: 'search', variants: searchVariants },
 *     test3: { iconName: 'menu', variants: menuVariants }
 *   },
 *   pageName: 'Test Page',
 *   applyVariables: true
 * });
 *
 * console.log(`Success: ${result.success}`);
 * console.log(`Components: ${result.componentsCreated}`);
 * console.log(`Variants: ${result.totalVariants}`);
 * console.log(`Duration: ${result.duration}ms`);
 * ```
 *
 * @example With error handling
 * ```typescript
 * const result = await generateBatchIcons(config);
 *
 * if (!result.success) {
 *   console.error(`${result.errors.size} icons failed:`);
 *   for (const [iconName, error] of result.errors) {
 *     console.error(`  ${iconName}: ${error.message}`);
 *   }
 * }
 *
 * // Successful icons are still in results
 * console.log(`Successfully generated: ${result.results.size} icons`);
 * ```
 */
export async function generateBatchIcons(config: BatchConfig): Promise<BatchResult> {
  const startTime = Date.now();
  const results = new Map<string, GenerationResult>();
  const errors = new Map<string, Error>();

  let componentsCreated = 0;
  let totalVariants = 0;

  // Setup layout configuration
  const layout = {
    startX: 100,
    startY: 100,
    spacing: 150,
    maxWidth: 2000,
    ...config.layout,
  };

  let xPosition = layout.startX;
  let yPosition = layout.startY;

  try {
    // Get or create page
    const page = await pageManager.getOrCreatePage(config.pageName || 'Material Icons', {
      autoSwitch: true,
      cleanExisting: config.cleanPage,
    });

    // Create generator with page config and grid layout
    // The generator will automatically detect existing components and update them
    const generator = new IconGenerator({
      page,
      applyVariables: config.applyVariables ?? true,
      preserveBindings: config.preserveBindings ?? false,
      checkContentChanges: true, // Always check for content changes
      removeUnrequestedVariants: true, // Always sync to requested variant set
      layout: {
        startX: 100,
        startY: 100,
        itemsPerRow: 24,
        gapX: 24,
        gapY: 24,
        ...config.layout, // Allow override from config
      },
    });

    // Process each icon group
    const totalIcons = Object.keys(config.iconGroups).length;
    let processedCount = 0;

    for (const key in config.iconGroups) {
      if (!Object.prototype.hasOwnProperty.call(config.iconGroups, key)) continue;

      const group = config.iconGroups[key];
      const { iconName, variants } = group;

      processedCount++;
      logger.info(`Processing ${iconName} (${processedCount}/${totalIcons})`);

      // Update UI status
      figma.ui.postMessage({
        type: 'PROGRESS',
        message: `Generating ${iconName}`,
        progress: Math.round((processedCount / totalIcons) * 100),
      });

      try {
        // Generate the icon
        const result = await generator.generateIcon(iconName, variants);
        results.set(iconName, result);

        // Position the component
        if (result.componentSet) {
          result.componentSet.x = xPosition;
          result.componentSet.y = yPosition;

          // Update position for next component
          xPosition += result.componentSet.width + layout.spacing;
          if (xPosition > layout.maxWidth) {
            xPosition = layout.startX;
            yPosition += result.componentSet.height + layout.spacing;
          }
        }

        componentsCreated++;
        totalVariants += result.variantsCreated + result.variantsUpdated;

        logger.info(
          `✓ ${iconName}: ${result.variantsCreated} created, ` +
            `${result.variantsUpdated} updated, ${result.variantsSkipped} skipped`
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.set(iconName, err);
        logger.error(`✗ Failed to generate ${iconName}:`, err);
      }

      // Yield to prevent blocking
      if (processedCount % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Final statistics
    const duration = Date.now() - startTime;
    const success = errors.size === 0;
    const averageTimePerIcon = Math.round(duration / totalIcons);
    const variantsPerSecond = Math.round((totalVariants / duration) * 1000);

    logger.info('===== BATCH GENERATION COMPLETE =====');
    logger.info(`Components created: ${componentsCreated}`);
    logger.info(`Total variants: ${totalVariants}`);
    logger.info(`Errors: ${errors.size}`);
    logger.info(`Duration: ${duration}ms`);
    logger.info(`Average per icon: ${averageTimePerIcon}ms`);
    logger.info(`Variants/second: ${variantsPerSecond}`);
    logger.info('=====================================');

    // Zoom to show generated icons
    if (page.children.length > 0) {
      figma.viewport.scrollAndZoomIntoView(page.children);
    }

    return {
      success,
      componentsCreated,
      totalVariants,
      results,
      errors,
      duration,
    };
  } catch (error) {
    logger.error('Batch generation failed:', error);
    throw error;
  }
}
