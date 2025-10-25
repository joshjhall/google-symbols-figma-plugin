/**
 * @module @figma/icons/batch-fetcher
 *
 * Batch SVG fetching utilities with connection pooling and error handling.
 *
 * This module provides efficient batch downloading of SVG files from GitHub with:
 * - **Connection Pooling**: Limits concurrent connections to prevent browser/network overload
 * - **Batch Processing**: Groups requests into batches with configurable delays
 * - **Error Handling**: Gracefully handles failures without stopping the batch
 * - **Progress Tracking**: Real-time progress callbacks for UI updates
 * - **Statistics**: Detailed success/failure metrics and timing
 *
 * **Performance Characteristics**:
 * - Default: 50 concurrent connections per batch
 * - Batch delay: 100ms between batches
 * - Typical throughput: ~400-500 icons/second with good connection
 * - Rate limiting: Detected via HTTP 429 or high failure rates
 *
 * **Usage Pattern**:
 * ```typescript
 * const items = variants.map(v => ({
 *   url: generateGitHubUrl(icon, style, v),
 *   iconName: icon,
 *   style,
 *   variant: v
 * }));
 *
 * const { results, stats } = await batchFetchSVGs(items, {
 *   batchSize: 20,
 *   batchDelay: 100,
 *   onProgress: (current, total) => console.log(`${current}/${total}`),
 *   onError: (url, err) => console.error(`Failed: ${url}`)
 * });
 *
 * console.log(`Success rate: ${stats.successRate}%`);
 * ```
 *
 * @example Basic batch fetch
 * ```typescript
 * const items: FetchItem[] = [
 *   { url: 'https://...', iconName: 'home', style: 'rounded', variant: {...} },
 *   { url: 'https://...', iconName: 'search', style: 'rounded', variant: {...} }
 * ];
 *
 * const { results, stats } = await batchFetchSVGs(items);
 * // Results contain successfully fetched SVGs
 * // Stats contain success/failure metrics
 * ```
 *
 * @example With progress tracking
 * ```typescript
 * await batchFetchSVGs(items, {
 *   batchSize: 20,
 *   onProgress: (current, total) => {
 *     figma.ui.postMessage({
 *       type: 'PROGRESS',
 *       message: `Downloading ${current}/${total}...`
 *     });
 *   }
 * });
 * ```
 */

import { logger } from '@lib/utils';
import type { IconVariant, IconStyle } from '@lib/github';

/**
 * Item to fetch from GitHub
 *
 * @interface FetchItem
 * @property {string} url - Complete GitHub raw URL to SVG file
 * @property {string} iconName - Name of the icon (e.g., "home", "search")
 * @property {IconStyle} style - Visual style (rounded, outlined, sharp)
 * @property {IconVariant} variant - Variant properties (weight, fill, grade, size)
 */
export interface FetchItem {
  url: string;
  iconName: string;
  style: IconStyle;
  variant: IconVariant;
}

/**
 * Successfully fetched result with SVG content
 *
 * @interface FetchResult
 * @property {string} iconName - Name of the icon that was fetched
 * @property {IconStyle} style - Visual style of the fetched icon
 * @property {IconVariant} variant - Variant properties of the fetched icon
 * @property {string} svgContent - Complete SVG file content as string
 */
export interface FetchResult {
  iconName: string;
  style: IconStyle;
  variant: IconVariant;
  svgContent: string;
}

/**
 * Configuration options for batch fetching
 *
 * @interface BatchFetchConfig
 * @property {number} [batchSize=50] - Maximum concurrent connections per batch
 *   Recommended: 20-50 for good balance of speed and stability
 * @property {number} [batchDelay=100] - Milliseconds to wait between batches
 *   Increase if experiencing rate limiting (e.g., 200-500ms)
 * @property {Function} [onProgress] - Callback for progress updates
 *   Called every 50 items or at completion
 * @property {Function} [onError] - Callback for individual fetch errors
 *   Called for each failed request with URL and error
 */
export interface BatchFetchConfig {
  /** Maximum concurrent connections */
  batchSize?: number;
  /** Delay between batches in ms */
  batchDelay?: number;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
  /** Error callback */
  onError?: (url: string, error: Error) => void;
}

/**
 * Statistics from a completed batch fetch operation
 *
 * @interface BatchFetchStats
 * @property {number} total - Total number of items attempted
 * @property {number} successful - Number of successfully fetched items
 * @property {number} failed - Number of failed fetch attempts
 * @property {number} duration - Total duration in milliseconds
 * @property {number} successRate - Success percentage (0-100)
 *
 * @example Interpreting stats
 * ```typescript
 * const { stats } = await batchFetchSVGs(items);
 *
 * if (stats.successRate < 90) {
 *   console.warn('High failure rate - possible rate limiting');
 * }
 *
 * const avgTime = stats.duration / stats.total;
 * console.log(`Average ${avgTime}ms per item`);
 * ```
 */
export interface BatchFetchStats {
  total: number;
  successful: number;
  failed: number;
  duration: number;
  successRate: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<BatchFetchConfig> = {
  batchSize: 50, // Safe number of concurrent connections
  batchDelay: 100, // 100ms between batches
  onProgress: () => {},
  onError: () => {},
};

/**
 * Fetch SVGs in batches with connection pooling and error handling
 *
 * Downloads SVG files from GitHub in controlled batches to prevent browser/network
 * overload. Continues on errors and returns both successful results and detailed
 * statistics.
 *
 * **Algorithm**:
 * 1. Split items into batches of configured size
 * 2. For each batch:
 *    - Fetch all items concurrently (Promise.all)
 *    - Track successes and failures
 *    - Report progress every 50 items
 *    - Wait batch delay before next batch
 * 3. Return all successful results + statistics
 *
 * **Error Handling**:
 * - HTTP errors (4xx, 5xx) → logged and counted as failures
 * - Network errors → caught, logged, and counted as failures
 * - Failures don't stop batch execution
 * - First 5 failures logged in detail for debugging
 *
 * **Performance Notes**:
 * - Default batchSize (50) balances speed and stability
 * - Reduce batchSize (20-30) if seeing rate limiting
 * - Increase batchDelay (200-500ms) for more conservative approach
 * - Typical rate: 400-500 items/second with good connection
 *
 * @param {FetchItem[]} items - Array of items to fetch from GitHub
 * @param {BatchFetchConfig} [config={}] - Optional configuration
 * @returns {Promise<{results: FetchResult[], stats: BatchFetchStats}>}
 *   Successfully fetched results (failures excluded) and statistics
 *
 * @example Basic usage (defaults)
 * ```typescript
 * const items: FetchItem[] = createFetchItems('home', 'rounded', variants);
 * const { results, stats } = await batchFetchSVGs(items);
 *
 * console.log(`Fetched ${stats.successful}/${stats.total} (${stats.successRate}%)`);
 * for (const result of results) {
 *   console.log(`Got ${result.iconName}: ${result.svgContent.length} chars`);
 * }
 * ```
 *
 * @example Conservative settings for rate limiting
 * ```typescript
 * const { results, stats } = await batchFetchSVGs(items, {
 *   batchSize: 20,      // Fewer concurrent connections
 *   batchDelay: 500,    // Longer delay between batches
 *   onProgress: (current, total) => {
 *     console.log(`Progress: ${current}/${total}`);
 *   },
 *   onError: (url, error) => {
 *     console.error(`Failed ${url}: ${error.message}`);
 *   }
 * });
 * ```
 */
export async function batchFetchSVGs(
  items: FetchItem[],
  config: BatchFetchConfig = {}
): Promise<{ results: FetchResult[]; stats: BatchFetchStats }> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  logger.info(`Starting batch fetch of ${items.length} SVGs`);
  logger.info(`Batch size: ${cfg.batchSize}, delay: ${cfg.batchDelay}ms`);

  let successCount = 0;
  let failureCount = 0;
  const allResults: FetchResult[] = [];

  // Process in batches
  for (let i = 0; i < items.length; i += cfg.batchSize) {
    const batch = items.slice(i, i + cfg.batchSize);
    const batchNumber = Math.floor(i / cfg.batchSize) + 1;
    const totalBatches = Math.ceil(items.length / cfg.batchSize);

    logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

    // Fetch all items in this batch concurrently
    const batchPromises = batch.map(async (item) => {
      try {
        const response = await fetch(item.url);

        if (!response.ok) {
          failureCount++;
          const error = new Error(`HTTP ${response.status} for ${item.url}`);
          cfg.onError(item.url, error);

          // Log first few failures for debugging
          if (failureCount <= 5) {
            logger.warn(
              `Failed to fetch ${item.iconName} (${item.style}): HTTP ${response.status}`
            );
          }

          return null;
        }

        const svgContent = await response.text();
        successCount++;

        // Report progress
        const total = successCount + failureCount;
        if (total % 50 === 0 || total === items.length) {
          cfg.onProgress(total, items.length);
          logger.info(
            `Progress: ${total}/${items.length} (${successCount} success, ${failureCount} failed)`
          );
        }

        return {
          iconName: item.iconName,
          style: item.style,
          variant: item.variant,
          svgContent,
        };
      } catch (error) {
        failureCount++;
        const err = error instanceof Error ? error : new Error(String(error));
        cfg.onError(item.url, err);

        // Log first few errors
        if (failureCount <= 5) {
          logger.error(`Failed to fetch ${item.iconName}: ${err.message}`);
        }

        return null;
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Filter out failed fetches and add to results
    const validResults = batchResults.filter((r): r is FetchResult => r !== null);
    allResults.push(...validResults);

    // Delay before next batch (except for last batch)
    if (i + cfg.batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, cfg.batchDelay));
    }
  }

  // Calculate statistics
  const duration = Date.now() - startTime;
  const successRate = Math.round((successCount / items.length) * 100);

  const stats: BatchFetchStats = {
    total: items.length,
    successful: successCount,
    failed: failureCount,
    duration,
    successRate,
  };

  logger.info('===== BATCH FETCH COMPLETE =====');
  logger.info(`Total: ${stats.total}`);
  logger.info(`Success: ${stats.successful} (${stats.successRate}%)`);
  logger.info(`Failed: ${stats.failed}`);
  logger.info(`Duration: ${stats.duration}ms`);
  logger.info(`Average: ${Math.round(stats.duration / stats.total)}ms per item`);
  logger.info('================================');

  return { results: allResults, stats };
}

/**
 * Create fetch items from icon variant data
 *
 * Convenience function to transform variant data with URLs into FetchItem format
 * suitable for batchFetchSVGs.
 *
 * @param {string} iconName - Name of the icon
 * @param {IconStyle} style - Visual style (rounded, outlined, sharp)
 * @param {Array} variants - Array of variants with URLs and properties
 * @returns {FetchItem[]} Array of fetch items ready for batchFetchSVGs
 *
 * @example
 * ```typescript
 * const variants = [
 *   { url: 'https://...', weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   { url: 'https://...', weight: 500, fill: 1, grade: 0, opticalSize: 24 }
 * ];
 *
 * const items = createFetchItems('home', 'rounded', variants);
 * const { results } = await batchFetchSVGs(items);
 * ```
 */
export function createFetchItems(
  iconName: string,
  style: IconStyle,
  variants: Array<{ url: string } & IconVariant>
): FetchItem[] {
  return variants.map((v) => ({
    url: v.url,
    iconName,
    style,
    variant: {
      fill: v.fill,
      weight: v.weight,
      grade: v.grade,
      opticalSize: v.opticalSize,
    },
  }));
}
