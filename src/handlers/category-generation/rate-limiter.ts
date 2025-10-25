/**
 * @module @figma/handlers/category-generation/rate-limiter
 *
 * Rate limiting and retry logic for GitHub API requests.
 *
 * This module handles GitHub rate limiting (429 responses) with exponential backoff
 * and automatic retries. It provides:
 *
 * - **Failure Detection**: Identifies rate limiting from batch fetch results
 * - **Exponential Backoff**: 1min → 2min → 4min → 8min → 10min (max)
 * - **Progress Updates**: UI updates every 10 seconds during cooldown
 * - **Retry Logic**: Up to 4 retry attempts with aggregated results
 * - **Cancellation Support**: Can be interrupted by user
 *
 * **Algorithm**:
 * 1. Detect failures in initial batch fetch (any failed = rate limiting)
 * 2. Extract failed URLs by comparing with successful results
 * 3. Wait with exponential backoff (1, 2, 4, 8, 10 minutes max)
 * 4. Retry failed items only
 * 5. Aggregate results and repeat if still have failures
 * 6. Stop after 4 attempts or when all succeed
 *
 * **Why Exponential Backoff**:
 * GitHub rate limits are time-based. Aggressive retries make it worse.
 * Conservative backoff ensures we don't hit limits again immediately.
 *
 * @example Basic usage
 * ```typescript
 * const limiter = new RateLimiter({
 *   maxRetries: 4,
 *   onProgress: (msg) => figma.ui.postMessage({ type: 'PROGRESS', message: msg })
 * });
 *
 * const results = await limiter.executeWithRetry(
 *   fetchItems,
 *   async (items) => await batchFetchSVGs(items),
 *   { iconName: 'home', completedIcons: 5 }
 * );
 * ```
 */

import { logger } from '@lib/utils';
import type { FetchItem, FetchResult, BatchFetchStats } from '@lib/icons';

/**
 * Configuration for rate limiter
 *
 * @interface RateLimiterConfig
 * @property {number} [maxRetries=4] - Maximum retry attempts
 * @property {number} [maxBackoffMinutes=10] - Maximum backoff time (cap)
 * @property {number} [progressUpdateIntervalMs=10000] - How often to update UI during cooldown
 * @property {Function} [onProgress] - Callback for progress updates
 * @property {Function} [isCancelled] - Function to check if user cancelled
 */
export interface RateLimiterConfig {
  maxRetries?: number;
  maxBackoffMinutes?: number;
  progressUpdateIntervalMs?: number;
  onProgress?: (message: string, context: ProgressContext) => void;
  isCancelled?: () => boolean;
}

/**
 * Context for progress updates
 *
 * @interface ProgressContext
 * @property {string} iconName - Current icon being processed
 * @property {number} completedIcons - Number of icons completed so far
 * @property {number} currentIconProgress - Progress percentage (0-100) for current icon
 */
export interface ProgressContext {
  iconName: string;
  completedIcons: number;
  currentIconProgress: number;
}

/**
 * Result of batch fetch with retry logic applied
 *
 * @interface BatchFetchWithRetryResult
 * @property {FetchResult[]} results - All successfully fetched results (including retries)
 * @property {BatchFetchStats} stats - Aggregated statistics
 * @property {number} retriesUsed - Number of retry attempts that were needed
 * @property {FetchItem[]} failedItems - Items that still failed after all retries
 */
export interface BatchFetchWithRetryResult {
  results: FetchResult[];
  stats: BatchFetchStats;
  retriesUsed: number;
  failedItems: FetchItem[];
}

/**
 * Rate limiter with exponential backoff for GitHub API requests
 *
 * Handles the complete retry workflow including failure detection, backoff calculation,
 * progress updates, and result aggregation.
 *
 * @class RateLimiter
 */
export class RateLimiter {
  private readonly maxRetries: number;
  private readonly maxBackoffMinutes: number;
  private readonly progressUpdateIntervalMs: number;
  private readonly onProgress?: (message: string, context: ProgressContext) => void;
  private readonly isCancelled: () => boolean;

  /**
   * Create a new rate limiter instance
   *
   * @param {RateLimiterConfig} [config={}] - Configuration options
   */
  constructor(config: RateLimiterConfig = {}) {
    this.maxRetries = config.maxRetries ?? 4;
    this.maxBackoffMinutes = config.maxBackoffMinutes ?? 10;
    this.progressUpdateIntervalMs = config.progressUpdateIntervalMs ?? 10000;
    this.onProgress = config.onProgress;
    this.isCancelled = config.isCancelled ?? (() => false);
  }

  /**
   * Execute a batch fetch operation with automatic retry on rate limiting
   *
   * @param {FetchItem[]} items - Items to fetch
   * @param {Function} fetchFunction - Function to perform the fetch (e.g., batchFetchSVGs)
   * @param {ProgressContext} context - Context for progress updates
   * @param {Function} urlExtractor - Function to extract URL from result for comparison
   * @returns {Promise<BatchFetchWithRetryResult>} Fetch results with retry statistics
   *
   * @example
   * ```typescript
   * const results = await limiter.executeWithRetry(
   *   fetchItems,
   *   (items) => batchFetchSVGs(items, { batchSize: 20 }),
   *   { iconName: 'home', completedIcons: 5, currentIconProgress: 50 },
   *   (result) => generateGitHubUrl(result.iconName, result.style, result.variant)
   * );
   * ```
   */
  async executeWithRetry<T extends FetchResult>(
    items: FetchItem[],
    fetchFunction: (items: FetchItem[]) => Promise<{ results: T[]; stats: BatchFetchStats }>,
    context: ProgressContext,
    urlExtractor: (result: T) => string
  ): Promise<BatchFetchWithRetryResult> {
    // Initial fetch attempt
    const initialResult = await fetchFunction(items);

    logger.info(
      `Initial fetch: ${initialResult.stats.successful} of ${initialResult.stats.total} succeeded`
    );

    // Check if we have any failures (likely rate limiting)
    const hasAnyFailures = initialResult.stats.failed > 0;

    if (!hasAnyFailures) {
      // No failures - return immediately
      return {
        results: initialResult.results,
        stats: initialResult.stats,
        retriesUsed: 0,
        failedItems: [],
      };
    }

    // Rate limiting detected
    const failureRate = initialResult.stats.failed / initialResult.stats.total;
    logger.warn(
      `Detected ${initialResult.stats.failed} failed downloads (${Math.round(failureRate * 100)}% failure rate) - retrying with backoff`
    );

    // Find which items failed by comparing URLs
    const successfulUrls = new Set(initialResult.results.map(urlExtractor));
    let remainingFailedItems = items.filter((item) => !successfulUrls.has(item.url));

    logger.info(`Will retry ${remainingFailedItems.length} failed items`);

    // Start retry loop
    let retryAttempt = 0;
    let allResults = [...initialResult.results];

    while (remainingFailedItems.length > 0 && retryAttempt < this.maxRetries) {
      // Check for cancellation
      if (this.isCancelled()) {
        logger.info('Retry cancelled by user');
        break;
      }

      retryAttempt++;

      // Calculate backoff time: 1min → 2min → 4min → 8min → 10min (cap)
      const waitMinutes = Math.min(Math.pow(2, retryAttempt - 1), this.maxBackoffMinutes);
      const waitMs = waitMinutes * 60 * 1000;

      logger.info(
        `Retry attempt ${retryAttempt}/${this.maxRetries}: Waiting ${waitMinutes} minutes before retrying ${remainingFailedItems.length} items`
      );

      // Notify about cooldown start
      this.onProgress?.(
        `⏸️ Rate limited - waiting ${waitMinutes} min before retrying ${remainingFailedItems.length} variants for ${context.iconName}...`,
        { ...context, currentIconProgress: 60 }
      );

      // Wait with periodic UI updates
      await this.waitWithProgress(waitMs, context, remainingFailedItems.length);

      // Check for cancellation after wait
      if (this.isCancelled()) {
        logger.info('Retry cancelled by user during cooldown');
        break;
      }

      // Notify about retry start
      this.onProgress?.(
        `🔄 Retrying ${remainingFailedItems.length} failed variants for ${context.iconName}...`,
        { ...context, currentIconProgress: 65 }
      );

      // Retry failed items
      const retryResult = await fetchFunction(remainingFailedItems);

      logger.info(
        `Retry ${retryAttempt}: Fetched ${retryResult.stats.successful} of ${retryResult.stats.total} items`
      );

      // Add successful retries to results
      allResults.push(...retryResult.results);

      // Update remaining failed items for next retry
      const newSuccessfulUrls = new Set(retryResult.results.map(urlExtractor));
      remainingFailedItems = remainingFailedItems.filter(
        (item) => !newSuccessfulUrls.has(item.url)
      );

      if (remainingFailedItems.length === 0) {
        logger.info(`✓ All items successfully fetched after ${retryAttempt} retry attempts`);
        this.onProgress?.(
          `✓ All variants fetched for ${context.iconName} after ${retryAttempt} retries`,
          { ...context, currentIconProgress: 75 }
        );
        break;
      }
    }

    // Check if we still have failures
    if (remainingFailedItems.length > 0) {
      logger.warn(
        `Still have ${remainingFailedItems.length} failed items after ${this.maxRetries} retry attempts`
      );
    }

    // Calculate final statistics
    const finalStats: BatchFetchStats = {
      total: items.length,
      successful: allResults.length,
      failed: items.length - allResults.length,
      duration: initialResult.stats.duration, // Keep initial duration (retries add extra time)
      successRate: Math.round((allResults.length / items.length) * 100),
    };

    return {
      results: allResults,
      stats: finalStats,
      retriesUsed: retryAttempt,
      failedItems: remainingFailedItems,
    };
  }

  /**
   * Wait for specified duration with periodic progress updates
   *
   * @private
   * @param {number} waitMs - Total wait time in milliseconds
   * @param {ProgressContext} context - Context for progress updates
   * @param {number} _remainingCount - Number of remaining items to retry (unused, kept for future use)
   */
  private async waitWithProgress(
    waitMs: number,
    context: ProgressContext,
    _remainingCount: number
  ): Promise<void> {
    const totalUpdates = Math.floor(waitMs / this.progressUpdateIntervalMs);

    for (let i = 0; i < totalUpdates; i++) {
      // Check for cancellation during wait
      if (this.isCancelled()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, this.progressUpdateIntervalMs));

      const remainingMinutes = Math.ceil(
        (waitMs - (i + 1) * this.progressUpdateIntervalMs) / 60000
      );

      this.onProgress?.(
        `⏸️ Cooling down (${remainingMinutes} min remaining) before retrying ${context.iconName}...`,
        { ...context, currentIconProgress: 60 }
      );
    }

    // Wait for any remaining time
    const remainingTime = waitMs - totalUpdates * this.progressUpdateIntervalMs;
    if (remainingTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }
  }
}
