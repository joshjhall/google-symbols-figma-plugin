/**
 * @module @figma/handlers/category-generation
 *
 * Category-based icon generation handler with intelligent update logic.
 *
 * This handler orchestrates the complete icon generation workflow:
 *
 * **Generation Process**:
 * 1. Load icon list for category (alphabetical ranges)
 * 2. Scan for deprecated icons and handle removal
 * 3. For each icon:
 *    - Check if update needed (metadata comparison)
 *    - Download all 504 variants (7 styles × 6 weights × 4 fills × 3 grades × 4 sizes)
 *    - Create/update component set
 *    - Apply Material Design 3 variable bindings
 * 4. Organize components into styled frame
 *
 * **Smart Update Logic**:
 * - Skip unchanged icons (commit SHA + variant count check)
 * - Incremental updates (only changed variants)
 * - Cumulative change tracking (supports version skipping)
 * - Content hash comparison (detect actual SVG changes)
 *
 * **Rate Limiting**:
 * - Detects GitHub rate limits (429 responses)
 * - Exponential backoff retry (1min → 2min → 4min → 8min → 10min)
 * - Batch processing with delays
 *
 * **Features**:
 * - Full 504-variant generation per icon
 * - Smart skip/update logic using metadata
 * - Cumulative change tracking across commits
 * - Rate limiting with retry logic
 * - Incremental updates (only changed variants)
 * - Deprecation handling (automatic cleanup)
 * - Set name transitions (Cat → Set, boundary shifts)
 * - Progress reporting to UI
 * - Cancellation support
 *
 * @example Basic usage
 * ```typescript
 * await handleCategoryGeneration(
 *   {
 *     category: 'Set 1: 10k_alt_1-add_chart',
 *     categoryData: { firstIcon: '10k_alt_1', lastIconExclusive: 'add_chart' },
 *     testIconCount: 5 // Optional: limit to 5 icons for testing
 *   },
 *   {
 *     commitSha: 'bb04090f',
 *     iconChangesData: { changedIcons: ['home', 'search'], newIcons: [] },
 *     iconChangesCumulative: null,
 *     isCancelled: () => false
 *   }
 * );
 * ```
 *
 * @example With cumulative changes (version skipping)
 * ```typescript
 * // Updating from commit A to C (skipping B)
 * await handleCategoryGeneration(msg, {
 *   commitSha: 'commitC',
 *   iconChangesData: null,
 *   iconChangesCumulative: {
 *     direct: {
 *       'commitA->commitB': { changedIcons: ['home'], newIcons: [] },
 *       'commitB->commitC': { changedIcons: ['search'], newIcons: ['new_icon'] }
 *     }
 *   },
 *   isCancelled: () => false
 * });
 * // Will detect that 'home' and 'search' changed, 'new_icon' is new
 * ```
 */

import { logger } from '@lib/utils';
import { pageManager } from '@lib/pages/manager';
import { IconGenerator } from '@lib/icons/generator';
import { type IconVariant, type IconStyle } from '@lib/github';
import { PLUGIN_MESSAGES } from '@/types';
import { PLUGIN_DATA_KEYS } from '@lib/constants';
import { getIconRange } from '@lib/icons/all-icons';
import { handleDeprecatedIcons, getDeprecationSummary } from '@lib/icons/deprecation-handler';
import { organizePageIntoFrame } from './page-organization';
import { getFinalSetName } from './cumulative-changes';
import { RateLimiter } from './category-generation/rate-limiter';
import { ProgressTracker } from './category-generation/progress-tracker';
import { IconProcessor } from './category-generation/icon-processor';

/**
 * Configuration for category generation
 *
 * @interface CategoryGenerationConfig
 * @property {string} commitSha - Git commit SHA for the Material Icons version to generate
 *   Used for version tracking and determining which icons changed between updates
 * @property {object | null} iconChangesData - Direct commit-to-commit change data
 *   Contains lists of changed/new icons for single-commit transitions
 * @property {object | null} iconChangesCumulative - Multi-commit change tracking data
 *   Supports version skipping (e.g., A→C when B was skipped)
 * @property {Function} isCancelled - Function to check if user cancelled generation
 *
 * @example Simple configuration
 * ```typescript
 * const config: CategoryGenerationConfig = {
 *   commitSha: 'bb04090f19c0e9dcfdb4812c987f4f05ef89669b',
 *   iconChangesData: {
 *     changedIcons: ['home', 'search'],
 *     newIcons: ['new_icon'],
 *     oldCommit: 'abc123',
 *     newCommit: 'bb04090f',
 *     totalIcons: 3933
 *   },
 *   iconChangesCumulative: null,
 *   isCancelled: () => false
 * };
 * ```
 *
 * @example With cumulative tracking
 * ```typescript
 * const config: CategoryGenerationConfig = {
 *   commitSha: 'commitC',
 *   iconChangesData: null, // Not available for this transition
 *   iconChangesCumulative: {
 *     direct: {
 *       'commitA->commitB': { changedIcons: ['home'], newIcons: [] },
 *       'commitB->commitC': { changedIcons: ['search'], newIcons: ['new_icon'] }
 *     },
 *     setRenames: {
 *       'commitA->commitB': [{
 *         setNumber: 26,
 *         oldName: 'Set 26: xxx-yyy',
 *         newName: 'Set 26: xxx-zzz'
 *       }]
 *     }
 *   },
 *   isCancelled: () => userClickedCancel
 * };
 * ```
 */
export interface CategoryGenerationConfig {
  /** The commit SHA to use for SVG fetching */
  commitSha: string;
  /** Icon changes data for optimization */
  iconChangesData: {
    changedIcons?: string[];
    newIcons?: string[];
    oldCommit?: string;
    newCommit?: string;
    totalIcons?: number;
  } | null;
  /** Cumulative change tracking data */
  iconChangesCumulative: {
    direct?: Record<string, { changedIcons: string[]; newIcons?: string[] }>;
    setRenames?: Record<string, Array<{ setNumber: number; oldName: string; newName: string }>>;
  } | null;
  /** Cancellation check function */
  isCancelled: () => boolean;
}

/**
 * Handle category-based icon generation with intelligent update logic
 *
 * Orchestrates the complete icon generation workflow for a single category (alphabetical
 * range of icons). This is the main entry point for icon generation.
 *
 * **Workflow**:
 * 1. **Initialize**: Load icon list, send progress to UI
 * 2. **Handle Renames**: Check for set name transitions (Cat→Set, boundary shifts)
 * 3. **Deprecation Scan**: Find and remove icons no longer in the category
 * 4. **Process Icons**: For each icon:
 *    - Check if update needed (smart skip logic)
 *    - Download all 504 variants with retry logic
 *    - Create or update component set
 *    - Apply M3 variable bindings
 * 5. **Organize**: Move components into styled frame with auto-layout
 *
 * **Smart Skip Logic**:
 * - If icon has 504 variants and matching commit SHA → skip entirely
 * - If icon changed between commits → update
 * - If using cumulative tracking → check entire path of commits
 * - If only missing variants → fill gaps incrementally
 *
 * **Rate Limiting**:
 * - Detects failures (>0% failure rate)
 * - Exponential backoff: 1min → 2min → 4min → 8min → 10min (max)
 * - Progress updates every 10 seconds during cooldown
 * - Up to 4 retry attempts per icon
 *
 * **Error Handling**:
 * - Individual icon failures don't stop batch
 * - Warnings for incomplete icons (skip, never create partial sets)
 * - Continues to next icon on error
 *
 * @param {object} msg - Message from UI with category info
 * @param {string} msg.category - Category name (e.g., "Set 1: aaa-bbb")
 * @param {object} msg.categoryData - Icon range for this category
 * @param {string} msg.categoryData.firstIcon - First icon in range (inclusive)
 * @param {string} msg.categoryData.lastIconExclusive - Last icon in range (exclusive)
 * @param {number} [msg.testIconCount] - Optional: limit to N icons for testing
 * @param {CategoryGenerationConfig} config - Generation configuration
 * @returns {Promise<void>} Resolves when generation completes or user cancels
 * @throws {Error} If category range is invalid or initial setup fails
 *
 * @example Generate full category
 * ```typescript
 * await handleCategoryGeneration(
 *   {
 *     category: 'Set 1: 10k_alt_1-add_chart',
 *     categoryData: {
 *       firstIcon: '10k_alt_1',
 *       lastIconExclusive: 'add_chart'
 *     }
 *   },
 *   {
 *     commitSha: 'bb04090f',
 *     iconChangesData: iconChanges,
 *     iconChangesCumulative: null,
 *     isCancelled: () => false
 *   }
 * );
 * ```
 *
 * @example Test mode (5 icons only)
 * ```typescript
 * await handleCategoryGeneration(
 *   {
 *     category: 'Set 1: 10k_alt_1-add_chart',
 *     categoryData: {
 *       firstIcon: '10k_alt_1',
 *       lastIconExclusive: 'add_chart'
 *     },
 *     testIconCount: 5 // Only generate first 5 icons
 *   },
 *   config
 * );
 * ```
 */
export async function handleCategoryGeneration(
  msg: {
    category: string;
    categoryData: { firstIcon: string; lastIconExclusive: string };
    testIconCount?: number;
  },
  config: CategoryGenerationConfig
): Promise<void> {
  try {
    const { category, categoryData, testIconCount } = msg;
    const { commitSha, iconChangesData, iconChangesCumulative, isCancelled } = config;

    logger.info(`Starting category generation: ${category}`);
    logger.info(`Test mode: ${testIconCount ? `${testIconCount} icon(s)` : 'Full category'}`);
    logger.info(`Using smart metadata-driven skip/update logic`);

    // Get list of icons for this category using category range from UI
    let iconsInCategory: string[] = [];

    try {
      // Use embedded validated icon list (3933 icons)
      const { firstIcon, lastIconExclusive } = categoryData;
      iconsInCategory = getIconRange(firstIcon, lastIconExclusive);
      logger.info(`Loaded ${iconsInCategory.length} icons in category range from embedded list`);
    } catch (error) {
      logger.error('Failed to load icon list:', error);
      // Can't use tracker here since it needs iconsInCategory.length
      figma.ui.postMessage({
        type: PLUGIN_MESSAGES.ERROR,
        message: `Failed to load icon list: ${error}`,
      });
      return;
    }

    // Limit icons if in test mode
    if (testIconCount && iconsInCategory.length > 0) {
      iconsInCategory = iconsInCategory.slice(0, testIconCount);
      logger.info(`Test mode: generating ${testIconCount} icon(s): ${iconsInCategory.join(', ')}`);
    }

    // Create progress tracker for UI updates
    const tracker = new ProgressTracker({
      totalIcons: iconsInCategory.length,
      category,
    });

    tracker.init();

    // Define all 504 variants (3 styles × 7 weights × 2 fills × 3 grades × 4 optical sizes)
    const styles: IconStyle[] = ['rounded', 'outlined', 'sharp'];
    const weights: IconVariant['weight'][] = [100, 200, 300, 400, 500, 600, 700];
    const fills: (0 | 1)[] = [0, 1];
    const grades: IconVariant['grade'][] = [-25, 0, 200];
    const opticalSizes: IconVariant['opticalSize'][] = [20, 24, 40, 48];

    const totalVariantsPerIcon =
      styles.length * weights.length * fills.length * grades.length * opticalSizes.length;
    logger.info(`Will generate ${totalVariantsPerIcon} variants per icon`);

    // Create or get the page for this category
    let pageName = category;

    // Handle set renames across commits AND Cat→Set transition
    const setNumberMatch = category.match(/^Set (\d+):/);
    if (setNumberMatch) {
      const setNumber = parseInt(setNumberMatch[1]);

      // Check if any existing pages match this set number with a different name
      // This includes both "Set 26: xxx-yyy" → "Set 26: xxx-zzz" AND "Cat 26: xxx-yyy" → "Set 26: xxx-yyy"
      for (const existingPage of figma.root.children) {
        // Match both "Set NN:" and "Cat NN:" patterns
        const existingMatch = existingPage.name.match(/^(?:Set|Cat) (\d+):/);
        if (
          existingMatch &&
          parseInt(existingMatch[1]) === setNumber &&
          existingPage.name !== category
        ) {
          // Found old page with same number but different name (could be Cat→Set or boundary shift)

          let shouldRename = false;
          let renameReason = '';

          // Check if this is a Cat→Set transition
          if (existingPage.name.startsWith('Cat ') && category.startsWith('Set ')) {
            shouldRename = true;
            renameReason = 'Cat→Set naming transition';
            logger.info(`Found Cat→Set transition: "${existingPage.name}" → "${category}"`);
          } else if (iconChangesCumulative && iconChangesCumulative.setRenames) {
            // Check if it's a boundary shift rename
            const oldPageCommit = existingPage.getPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA);
            if (oldPageCommit && oldPageCommit !== commitSha) {
              const finalName = getFinalSetName(
                setNumber,
                existingPage.name,
                oldPageCommit,
                commitSha,
                iconChangesCumulative
              );
              if (finalName === category) {
                shouldRename = true;
                renameReason = 'icon boundaries shifted';
                logger.info(`Found boundary shift: "${existingPage.name}" → "${category}"`);
              }
            }
          }

          if (shouldRename) {
            // Rename the page
            logger.info(`Renaming page: "${existingPage.name}" → "${category}" (${renameReason})`);
            existingPage.name = category;

            // Find and rename the frame inside the page
            for (const child of existingPage.children) {
              if (child.type === 'FRAME') {
                // Frame name might be old page name or old category name - rename it
                if (child.name.match(/^(?:Set|Cat) \d+:/)) {
                  child.name = category;
                  logger.info(`Renamed frame to: "${category}"`);
                }
              }
            }

            // Update page's commit SHA
            existingPage.setPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA, commitSha);

            tracker.update({
              message: `✓ Renamed "${existingPage.name}" to "${category}" (${renameReason})`,
              currentIcon: '',
            });

            break;
          }
        }
      }
    }

    const page = await pageManager.getOrCreatePage(pageName, {
      autoSwitch: true,
      cleanExisting: false, // Don't clean, allow incremental updates
    });

    // Store commit SHA on page
    page.setPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA, commitSha);

    logger.info(`Using page: ${pageName}`);

    // Handle deprecated icons before generating new ones
    tracker.update({
      message: 'Scanning for deprecated icons...',
      currentIcon: '',
    });

    const deprecationResult = await handleDeprecatedIcons(page, iconsInCategory);
    const deprecationSummary = getDeprecationSummary(deprecationResult);

    logger.info(`Deprecation scan complete: ${deprecationSummary}`);
    tracker.update({
      message: deprecationSummary,
      currentIcon: '',
    });

    // Create icon generator
    const generator = new IconGenerator({
      page,
      applyVariables: true,
      checkContentChanges: true,
      removeUnrequestedVariants: true,
      commitSha: commitSha,
      layout: {
        startX: 100,
        startY: 100,
        itemsPerRow: 24,
        gapX: 24,
        gapY: 24,
      },
    });

    // Create rate limiter with progress callbacks
    const rateLimiter = new RateLimiter({
      maxRetries: 4,
      onProgress: (message, context) => {
        tracker.update({
          message,
          currentIcon: context.iconName,
          progress: context.currentIconProgress,
        });
      },
      isCancelled,
    });

    // Create icon processor
    const processor = new IconProcessor({
      generator,
      rateLimiter,
      tracker,
      page,
      commitSha,
      iconChangesData,
      iconChangesCumulative,
      variantConfig: {
        styles,
        weights,
        fills,
        grades,
        opticalSizes,
      },
    });

    // Process each icon
    let completedIcons = 0;
    const totalIcons = iconsInCategory.length;

    for (const iconName of iconsInCategory) {
      // Check for cancellation
      if (isCancelled()) {
        logger.info('Generation cancelled by user');
        tracker.complete(
          `Cancelled after ${tracker.getCompletedCount()}/${tracker.getTotalCount()} icons`
        );
        return;
      }

      try {
        logger.info(`Processing icon ${completedIcons + 1}/${totalIcons}: ${iconName}`);

        // Process icon through complete workflow
        const result = await processor.processIcon(iconName, completedIcons);

        // Increment counter for successful actions (skip increment for failed actions)
        if (result.action !== 'failed') {
          completedIcons++;
        }

        // Small delay to prevent UI blocking
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        logger.error(`Failed to generate ${iconName}:`, error);
        tracker.error(`Failed to generate ${iconName}: ${error}`);
        // Continue with next icon
      }
    }

    // Organize components into a styled frame
    try {
      tracker.update({
        message: 'Organizing components into frame...',
        currentIcon: '',
      });

      await organizePageIntoFrame(page, category);

      logger.info('Page organization complete');
    } catch (error) {
      logger.warn('Failed to organize page into frame:', error);
      // Don't fail the whole generation if organization fails
    }

    // Generation complete
    tracker.complete();

    figma.notify(`✅ Generated ${completedIcons} icons in ${category}`);
  } catch (error) {
    logger.error('Category generation failed:', error);
    // Can't use tracker here if it wasn't created yet
    figma.ui.postMessage({
      type: PLUGIN_MESSAGES.ERROR,
      message: `Generation failed: ${error}`,
    });
  }
}
