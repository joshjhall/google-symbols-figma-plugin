/**
 * @module @figma/handlers/category-generation/icon-processor
 *
 * Icon processing workflow orchestration for category generation.
 *
 * This module encapsulates the complete icon processing workflow including
 * skip/update logic, variant URL generation, SVG fetching with retry,
 * validation, and component creation/update.
 *
 * **Processing Workflow**:
 * 1. **Skip Check**: Determine if icon needs update using metadata
 * 2. **Cumulative Tracking**: Check if icon changed across commit history
 * 3. **URL Generation**: Build URLs for all 504 variants
 * 4. **Fetch SVGs**: Download with rate limiting and retry
 * 5. **Validate Results**: Ensure all variants fetched successfully
 * 6. **Update/Create**: Either incremental update or new component creation
 *
 * **Smart Skip Logic**:
 * - Icon has 504 variants + matching commit SHA → skip entirely
 * - Icon changed in any commit along path → update
 * - Icon missing variants → fill gaps
 * - Icon commit SHA mismatch → compare hashes and update
 *
 * **Result Types**:
 * - `skipped-unchanged`: Icon unchanged, only SHA updated
 * - `skipped-up-to-date`: Icon already up-to-date
 * - `updated`: Existing icon updated (variants added/refreshed)
 * - `created`: New icon component created
 * - `failed`: Icon processing failed (warnings issued)
 *
 * @example Basic usage
 * ```typescript
 * const processor = new IconProcessor({
 *   generator,
 *   rateLimiter,
 *   tracker,
 *   page,
 *   commitSha: 'bb04090f',
 *   iconChangesData,
 *   iconChangesCumulative,
 *   variantConfig: {
 *     styles: ['rounded', 'outlined', 'sharp'],
 *     weights: [100, 200, 300, 400, 500, 600, 700],
 *     fills: [0, 1],
 *     grades: [-25, 0, 200],
 *     opticalSizes: [20, 24, 40, 48]
 *   }
 * });
 *
 * const result = await processor.processIcon('home', completedIcons);
 *
 * if (result.action === 'created') {
 *   console.log(`Created ${result.iconName} with ${result.variantsProcessed} variants`);
 * }
 * ```
 */

import { logger } from '@lib/utils';
import type { IconGenerator, VariantData } from '@lib/icons';
import { generateGitHubUrl, type IconVariant, type IconStyle } from '@lib/github';
import { batchFetchSVGs } from '@lib/icons';
import { PLUGIN_DATA_KEYS } from '@lib/constants';
import { checkIconNeedsUpdate, logUpdateCheckResult } from '@lib/icons/metadata-helpers';
import {
  analyzeComponentForUpdate,
  updateVariantComponent,
  addVariantToComponentSet,
  reorderComponentSetVariants,
  getUpdateSummary,
  cleanupExtraFramesInComponentSet,
  type VariantKey,
} from '@lib/icons/incremental-updater';
import { hasIconChangedCumulatively } from '../cumulative-changes';
import type { RateLimiter } from './rate-limiter';
import type { ProgressTracker } from './progress-tracker';

/**
 * Variant configuration for icon generation
 *
 * @interface VariantConfig
 * @property {IconStyle[]} styles - Icon styles (rounded, outlined, sharp)
 * @property {number[]} weights - Font weights (100-700)
 * @property {(0|1)[]} fills - Fill states (0=unfilled, 1=filled)
 * @property {number[]} grades - Optical grades (-25, 0, 200)
 * @property {number[]} opticalSizes - Optical sizes (20, 24, 40, 48)
 */
export interface VariantConfig {
  styles: IconStyle[];
  weights: IconVariant['weight'][];
  fills: (0 | 1)[];
  grades: IconVariant['grade'][];
  opticalSizes: IconVariant['opticalSize'][];
}

/**
 * Icon processor configuration
 *
 * @interface IconProcessorConfig
 * @property {IconGenerator} generator - Icon generator instance
 * @property {RateLimiter} rateLimiter - Rate limiter for GitHub API
 * @property {ProgressTracker} tracker - Progress tracker for UI updates
 * @property {PageNode} page - Figma page containing icons
 * @property {string} commitSha - Git commit SHA for version tracking
 * @property {object | null} iconChangesData - Direct commit-to-commit changes
 * @property {object | null} iconChangesCumulative - Multi-commit change tracking
 * @property {VariantConfig} variantConfig - Variant generation configuration
 */
export interface IconProcessorConfig {
  generator: IconGenerator;
  rateLimiter: RateLimiter;
  tracker: ProgressTracker;
  page: PageNode;
  commitSha: string;
  iconChangesData: {
    changedIcons?: string[];
    newIcons?: string[];
    oldCommit?: string;
    newCommit?: string;
  } | null;
  iconChangesCumulative: {
    direct?: Record<string, { changedIcons: string[]; newIcons?: string[] }>;
  } | null;
  variantConfig: VariantConfig;
}

/**
 * Result of icon processing
 *
 * @interface IconProcessResult
 * @property {string} action - Action taken (skipped-unchanged, skipped-up-to-date, updated, created, failed)
 * @property {string} iconName - Name of processed icon
 * @property {number} variantsProcessed - Number of variants processed
 * @property {string} [message] - Human-readable message describing result
 * @property {object} [details] - Additional details about processing
 */
export interface IconProcessResult {
  action: 'skipped-unchanged' | 'skipped-up-to-date' | 'updated' | 'created' | 'failed';
  iconName: string;
  variantsProcessed: number;
  message?: string;
  details?: {
    variantsAdded?: number;
    variantsUpdated?: number;
    variantsSkipped?: number;
    reason?: string;
  };
}

/**
 * Icon processor for orchestrating icon generation workflow
 *
 * Handles the complete workflow for processing a single icon including
 * skip checks, fetching, validation, and creation/update. This class
 * encapsulates the complex logic that was previously inline in the
 * main generation loop.
 *
 * **Key Responsibilities**:
 * - Smart skip logic with cumulative tracking
 * - Variant URL generation
 * - SVG fetching with rate limiting
 * - Result validation
 * - Component creation or incremental update
 * - Progress reporting
 *
 * @class IconProcessor
 */
export class IconProcessor {
  private readonly generator: IconGenerator;
  private readonly rateLimiter: RateLimiter;
  private readonly tracker: ProgressTracker;
  private readonly page: PageNode;
  private readonly commitSha: string;
  private readonly iconChangesData: IconProcessorConfig['iconChangesData'];
  private readonly iconChangesCumulative: IconProcessorConfig['iconChangesCumulative'];
  private readonly variantConfig: VariantConfig;
  private readonly totalVariantsPerIcon: number;

  /**
   * Create a new icon processor
   *
   * @param {IconProcessorConfig} config - Processor configuration
   *
   * @example
   * ```typescript
   * const processor = new IconProcessor({
   *   generator: iconGenerator,
   *   rateLimiter: rateLimiter,
   *   tracker: progressTracker,
   *   page: figmaPage,
   *   commitSha: 'bb04090f',
   *   iconChangesData: changes,
   *   iconChangesCumulative: null,
   *   variantConfig: {
   *     styles: ['rounded', 'outlined', 'sharp'],
   *     weights: [100, 200, 300, 400, 500, 600, 700],
   *     fills: [0, 1],
   *     grades: [-25, 0, 200],
   *     opticalSizes: [20, 24, 40, 48]
   *   }
   * });
   * ```
   */
  constructor(config: IconProcessorConfig) {
    this.generator = config.generator;
    this.rateLimiter = config.rateLimiter;
    this.tracker = config.tracker;
    this.page = config.page;
    this.commitSha = config.commitSha;
    this.iconChangesData = config.iconChangesData;
    this.iconChangesCumulative = config.iconChangesCumulative;
    this.variantConfig = config.variantConfig;

    // Calculate total variants per icon
    this.totalVariantsPerIcon =
      config.variantConfig.styles.length *
      config.variantConfig.weights.length *
      config.variantConfig.fills.length *
      config.variantConfig.grades.length *
      config.variantConfig.opticalSizes.length;
  }

  /**
   * Process a single icon through the complete generation workflow
   *
   * This is the main entry point for icon processing. It orchestrates
   * all steps from skip check through creation/update.
   *
   * **Workflow**:
   * 1. Check if icon needs update (smart skip logic)
   * 2. Check cumulative changes across commits
   * 3. Build variant URLs
   * 4. Fetch SVGs with rate limiting
   * 5. Validate results
   * 6. Create or update component
   *
   * **Returns**:
   * - `skipped-unchanged`: Icon unchanged, only commit SHA updated
   * - `skipped-up-to-date`: Icon already up-to-date, no action needed
   * - `updated`: Icon updated incrementally
   * - `created`: New icon component created
   * - `failed`: Processing failed (skipped with warning)
   *
   * @param {string} iconName - Name of icon to process
   * @param {number} completedIcons - Number of icons completed so far (for progress tracking)
   * @returns {Promise<IconProcessResult>} Processing result
   *
   * @example
   * ```typescript
   * const result = await processor.processIcon('home', 5);
   *
   * switch (result.action) {
   *   case 'created':
   *     console.log(`Created ${result.iconName}`);
   *     break;
   *   case 'updated':
   *     console.log(`Updated ${result.iconName}: +${result.details.variantsAdded}`);
   *     break;
   *   case 'skipped-unchanged':
   *     console.log(`${result.iconName} unchanged`);
   *     break;
   *   case 'failed':
   *     console.error(`Failed: ${result.message}`);
   *     break;
   * }
   * ```
   */
  async processIcon(iconName: string, completedIcons: number): Promise<IconProcessResult> {
    logger.info(`Processing icon: ${iconName}`);

    this.tracker.update({
      message: `Generating ${iconName}...`,
      currentIcon: iconName,
      progress: 0,
    });

    // Smart skip/update check using metadata
    const updateCheck = checkIconNeedsUpdate(this.page, iconName, this.commitSha);
    logUpdateCheckResult(iconName, updateCheck);

    // Extract existing component set for later use
    const existingComponentSet = updateCheck.existingComponentSet;

    // Clean up any extra frame wrappers BEFORE skip check
    if (existingComponentSet) {
      const fixedFrames = cleanupExtraFramesInComponentSet(existingComponentSet);
      if (fixedFrames > 0) {
        logger.info(`Cleaned up ${fixedFrames} variants with extra frames in ${iconName}`);
      }
    }

    // OPTIMIZATION: Check if icon changed between commits (supports cumulative tracking)
    if (existingComponentSet && updateCheck.existingVariantCount === 504) {
      // Get the icon's current commit SHA
      const iconCurrentCommit = existingComponentSet.getPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA);

      // Check if icon has changed using cumulative tracking
      if (iconCurrentCommit && iconCurrentCommit !== this.commitSha) {
        const iconChanged = hasIconChangedCumulatively(
          iconName,
          iconCurrentCommit,
          this.commitSha,
          this.iconChangesData,
          this.iconChangesCumulative
        );

        if (!iconChanged) {
          // Icon exists, has all variants, and hasn't changed across any commits
          // Just update the commit SHA metadata without re-downloading
          existingComponentSet.setPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA, this.commitSha);

          const oldShort = iconCurrentCommit.substring(0, 7);
          const newShort = this.commitSha.substring(0, 7);

          const message = `✓ ${iconName} unchanged (${oldShort}→${newShort}) - updated commit SHA only (${updateCheck.existingVariantCount} variants)`;

          this.tracker.iconComplete(iconName, message);

          logger.info(`Fast-forward ${iconName}: ${oldShort}→${newShort} without re-downloading`);

          await new Promise((resolve) => setTimeout(resolve, 5));

          return {
            action: 'skipped-unchanged',
            iconName,
            variantsProcessed: updateCheck.existingVariantCount,
            message,
          };
        } else {
          logger.info(
            `Icon ${iconName} changed between ${iconCurrentCommit.substring(0, 7)}→${this.commitSha.substring(0, 7)} - will update`
          );
        }
      }
    }

    // Skip if already up-to-date
    if (!updateCheck.needsUpdate) {
      const message = `✓ Skipped ${iconName} (up-to-date, ${updateCheck.existingVariantCount} variants)`;

      this.tracker.iconComplete(iconName, message);

      // Small delay to allow UI to update when skipping many icons
      await new Promise((resolve) => setTimeout(resolve, 5));

      return {
        action: 'skipped-up-to-date',
        iconName,
        variantsProcessed: updateCheck.existingVariantCount,
        message,
      };
    }

    // Icon needs update - show appropriate message
    if (updateCheck.fullRegeneration) {
      this.tracker.update({
        message: `Generating ${iconName} (${updateCheck.reason})...`,
        currentIcon: iconName,
        progress: 0,
      });
    } else if (updateCheck.fillGapsOnly) {
      this.tracker.update({
        message: `Filling gaps in ${iconName} (${updateCheck.existingVariantCount}/${this.totalVariantsPerIcon} variants)...`,
        currentIcon: iconName,
        progress: 0,
      });
    } else {
      // Commit SHA mismatch - will compare SVG hashes
      this.tracker.update({
        message: `Updating ${iconName} (checking for changes)...`,
        currentIcon: iconName,
        progress: 0,
      });
    }

    // Build variant URLs and fetch SVGs
    const variantData = await this.buildAndFetchVariants(iconName, completedIcons);

    // Validate fetch results
    if (!variantData) {
      // Validation failed, warnings already issued by buildAndFetchVariants
      return {
        action: 'failed',
        iconName,
        variantsProcessed: 0,
        message: 'Failed to fetch variants',
      };
    }

    // Process icon: incremental update or new creation
    if (existingComponentSet) {
      return await this.updateExistingIcon(
        iconName,
        variantData,
        existingComponentSet,
        completedIcons
      );
    } else {
      return await this.createNewIcon(iconName, variantData);
    }
  }

  /**
   * Build variant URLs and fetch SVG content
   *
   * @private
   * @param {string} iconName - Icon name
   * @param {number} completedIcons - Completed icon count for progress tracking
   * @returns {Promise<VariantData[] | null>} Variant data or null if fetch failed
   */
  private async buildAndFetchVariants(
    iconName: string,
    completedIcons: number
  ): Promise<VariantData[] | null> {
    // Build all variant URLs for this icon
    const variants: Array<IconVariant & { style: IconStyle; url: string }> = [];
    let variantIndex = 0;
    const totalVariants = this.totalVariantsPerIcon;

    for (const style of this.variantConfig.styles) {
      for (const weight of this.variantConfig.weights) {
        for (const fill of this.variantConfig.fills) {
          for (const grade of this.variantConfig.grades) {
            for (const opticalSize of this.variantConfig.opticalSizes) {
              const variant: IconVariant = { weight, fill, grade, opticalSize };
              const url = generateGitHubUrl(iconName, style, variant);

              variants.push({
                ...variant,
                style,
                url,
              });

              variantIndex++;

              // Update progress every 50 variants
              if (variantIndex % 50 === 0) {
                const progress = Math.round((variantIndex / totalVariants) * 100);
                this.tracker.update({
                  message: `Building variant URLs for ${iconName}...`,
                  currentIcon: iconName,
                  progress,
                });
              }
            }
          }
        }
      }
    }

    logger.info(`Built ${variants.length} variant URLs for ${iconName}`);

    // Fetch all SVGs for this icon
    this.tracker.update({
      message: `Fetching SVGs for ${iconName}...`,
      currentIcon: iconName,
      progress: 50,
    });

    // Transform to FetchItem format
    const fetchItems = variants.map((v) => ({
      url: v.url,
      iconName,
      style: v.style,
      variant: {
        weight: v.weight,
        fill: v.fill,
        grade: v.grade,
        opticalSize: v.opticalSize,
      },
    }));

    // Execute fetch with automatic retry on rate limiting
    const svgResults = await this.rateLimiter.executeWithRetry(
      fetchItems,
      async (items) =>
        await batchFetchSVGs(items, {
          batchSize: 20,
          batchDelay: 100,
          onProgress: (current, total) => {
            // Map download progress from 50% to 75%
            const downloadProgress = 50 + Math.round((current / total) * 25);
            this.tracker.update({
              message: `Downloading ${iconName} (${current}/${total} variants)...`,
              currentIcon: iconName,
              progress: downloadProgress,
            });
          },
        }),
      { iconName, completedIcons, currentIconProgress: 50 },
      (result) => generateGitHubUrl(result.iconName, result.style, result.variant)
    );

    logger.info(
      `Fetched ${svgResults.stats.successful} of ${svgResults.stats.total} SVGs for ${iconName}` +
        (svgResults.retriesUsed > 0 ? ` (after ${svgResults.retriesUsed} retries)` : '')
    );

    // Transform to VariantData format
    const variantData: VariantData[] = svgResults.results
      .filter((r) => r.svgContent)
      .map((r) => ({
        iconName: r.iconName,
        style: r.style,
        variant: r.variant,
        svgContent: r.svgContent,
      }));

    // Validate results
    const expectedVariantCount = 504;

    if (variantData.length === 0) {
      // Log sample failed URLs for debugging
      const sampleFailedUrls = fetchItems.slice(0, 3).map((item) => item.url);
      logger.error(`No valid SVGs fetched for ${iconName}`);
      logger.error(`Sample URLs attempted: ${sampleFailedUrls.join(', ')}`);
      logger.error(
        `Total fetch attempts: ${svgResults.stats.total}, Failed: ${svgResults.stats.failed}`
      );

      this.tracker.warning(
        `⚠️ Skipping ${iconName}: All ${svgResults.stats.total} variants failed (GitHub rate limiting or network issue)`
      );

      return null;
    }

    // Check if we have ALL expected variants
    if (variantData.length < expectedVariantCount) {
      logger.error(
        `Incomplete icon ${iconName}: only ${variantData.length}/${expectedVariantCount} variants after retries`
      );

      this.tracker.warning(
        `⚠️ Skipping ${iconName}: Incomplete (${variantData.length}/${expectedVariantCount} variants) - GitHub rate limiting too aggressive. Try again later or reduce batch size.`
      );

      return null;
    }

    return variantData;
  }

  /**
   * Update existing icon component incrementally
   *
   * @private
   * @param {string} iconName - Icon name
   * @param {VariantData[]} variantData - Variant SVG data
   * @param {ComponentSetNode} existingComponentSet - Existing component set
   * @param {number} _completedIcons - Completed icon count (unused, reserved for future use)
   * @returns {Promise<IconProcessResult>} Processing result
   */
  private async updateExistingIcon(
    iconName: string,
    variantData: VariantData[],
    existingComponentSet: ComponentSetNode,
    _completedIcons: number
  ): Promise<IconProcessResult> {
    logger.info(`Component "${iconName}" exists - analyzing for incremental update`);

    this.tracker.update({
      message: `Analyzing ${iconName} for updates...`,
      currentIcon: iconName,
      progress: 75,
    });

    // Build variant keys and URL map for analysis
    const expectedVariants: VariantKey[] = [];
    const variantUrls = new Map<string, string>();

    for (const vd of variantData) {
      const key: VariantKey = {
        style: vd.style,
        variant: vd.variant,
      };
      expectedVariants.push(key);
      variantUrls.set(
        `${vd.style}-${vd.variant.weight}-${vd.variant.fill}-${vd.variant.grade}-${vd.variant.opticalSize}`,
        generateGitHubUrl(iconName, vd.style, vd.variant)
      );
    }

    // Analyze what needs updating
    const updateResult = await analyzeComponentForUpdate(
      existingComponentSet,
      expectedVariants,
      variantUrls
    );

    const updateSummary = getUpdateSummary(updateResult);
    logger.info(`Update plan for ${iconName}: ${updateSummary}`);

    this.tracker.update({
      message: `Updating ${iconName}: ${updateSummary}`,
      currentIcon: iconName,
      progress: 80,
    });

    let variantsUpdated = 0;
    let variantsAdded = 0;

    // Update stale variants
    for (const staleVariant of updateResult.staleVariants) {
      if (staleVariant.component) {
        // Find the SVG content for this variant
        const svgData = variantData.find(
          (vd) =>
            vd.style === staleVariant.key.style &&
            vd.variant.weight === staleVariant.key.variant.weight &&
            vd.variant.fill === staleVariant.key.variant.fill &&
            vd.variant.grade === staleVariant.key.variant.grade &&
            vd.variant.opticalSize === staleVariant.key.variant.opticalSize
        );

        if (svgData) {
          await updateVariantComponent(
            staleVariant.component,
            svgData.svgContent,
            staleVariant.key
          );
          variantsUpdated++;
        }
      }
    }

    // Add missing variants
    for (const missingVariant of updateResult.missingVariants) {
      // Find the SVG content for this variant
      const svgData = variantData.find(
        (vd) =>
          vd.style === missingVariant.style &&
          vd.variant.weight === missingVariant.variant.weight &&
          vd.variant.fill === missingVariant.variant.fill &&
          vd.variant.grade === missingVariant.variant.grade &&
          vd.variant.opticalSize === missingVariant.variant.opticalSize
      );

      if (svgData) {
        await addVariantToComponentSet(existingComponentSet, svgData.svgContent, missingVariant);
        variantsAdded++;
      }
    }

    // Reorder variants after all updates: default first, then alphabetically
    reorderComponentSetVariants(existingComponentSet);

    // Store commit SHA for version tracking
    try {
      existingComponentSet.setPluginData(PLUGIN_DATA_KEYS.GIT_COMMIT_SHA, this.commitSha);
      logger.info(
        `Stored commit SHA on ${existingComponentSet.name}: ${this.commitSha.substring(0, 7)}`
      );
    } catch (error) {
      logger.warn(`Failed to store commit SHA on ${existingComponentSet.name}:`, error);
    }

    logger.info(
      `✓ ${iconName} (incremental): ${variantsAdded} added, ` +
        `${variantsUpdated} updated, ${updateResult.upToDateVariants} up-to-date`
    );

    const message = `Updated ${iconName}: +${variantsAdded} new, ${variantsUpdated} refreshed`;
    this.tracker.iconComplete(iconName, message);

    return {
      action: 'updated',
      iconName,
      variantsProcessed: variantsAdded + variantsUpdated,
      message,
      details: {
        variantsAdded,
        variantsUpdated,
        variantsSkipped: updateResult.upToDateVariants,
      },
    };
  }

  /**
   * Create new icon component
   *
   * @private
   * @param {string} iconName - Icon name
   * @param {VariantData[]} variantData - Variant SVG data
   * @returns {Promise<IconProcessResult>} Processing result
   */
  private async createNewIcon(
    iconName: string,
    variantData: VariantData[]
  ): Promise<IconProcessResult> {
    this.tracker.update({
      message: `Creating component for ${iconName}...`,
      currentIcon: iconName,
      progress: 75,
    });

    const result = await this.generator.generateIcon(iconName, variantData);

    logger.info(
      `✓ ${iconName} (new): ${result.variantsCreated} created, ` +
        `${result.variantsUpdated} updated, ${result.variantsSkipped} skipped`
    );

    const message = `Created ${iconName}`;
    this.tracker.iconComplete(iconName, message);

    return {
      action: 'created',
      iconName,
      variantsProcessed: result.variantsCreated,
      message,
      details: {
        variantsAdded: result.variantsCreated,
        variantsUpdated: result.variantsUpdated,
        variantsSkipped: result.variantsSkipped,
      },
    };
  }
}
