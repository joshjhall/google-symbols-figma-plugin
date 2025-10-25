/**
 * @module @figma/handlers/category-generation/progress-tracker
 *
 * Progress tracking and UI updates for icon generation workflow.
 *
 * This module provides a centralized progress tracking system that manages
 * UI updates throughout the icon generation process. It tracks both overall
 * progress (completed icons) and per-icon progress (0-100%).
 *
 * **Features**:
 * - **Hierarchical Progress**: Overall progress (icons) + per-icon progress (%)
 * - **Message Types**: Init, progress, warning, error, completion
 * - **Consistent Formatting**: Centralized message format
 * - **Testability**: Can be mocked for testing
 * - **Type Safety**: Typed message payloads
 *
 * **Progress Model**:
 * ```
 * Overall: [=====>      ] 5/10 icons (50%)
 *   Current Icon: [======>    ] 60%
 * ```
 *
 * **Message Flow**:
 * 1. `init()` - Start generation
 * 2. `update()` - Per-icon progress (0-100%)
 * 3. `iconComplete()` - Icon finished
 * 4. `complete()` - All icons finished
 * 5. `error()` or `warning()` - Issues
 *
 * @example Basic usage
 * ```typescript
 * const tracker = new ProgressTracker({
 *   totalIcons: 10,
 *   category: 'Navigation Icons'
 * });
 *
 * tracker.init();
 *
 * for (const icon of icons) {
 *   tracker.update({
 *     message: `Generating ${icon.name}...`,
 *     currentIcon: icon.name,
 *     progress: 0
 *   });
 *
 *   await generateIcon(icon);
 *
 *   tracker.iconComplete(icon.name);
 * }
 *
 * tracker.complete();
 * ```
 *
 * @example With progress milestones
 * ```typescript
 * tracker.update({
 *   message: `Fetching SVGs for ${iconName}...`,
 *   currentIcon: iconName,
 *   progress: 50
 * });
 *
 * await fetchSVGs(iconName);
 *
 * tracker.update({
 *   message: `Creating component for ${iconName}...`,
 *   currentIcon: iconName,
 *   progress: 75
 * });
 *
 * await createComponent(iconName);
 *
 * tracker.iconComplete(iconName); // 100%
 * ```
 */

import { PLUGIN_MESSAGES } from '@/types';

/**
 * Configuration for progress tracker
 *
 * @interface ProgressTrackerConfig
 * @property {number} totalIcons - Total number of icons to generate
 * @property {string} category - Category name for display
 * @property {Function} [postMessage] - Custom message posting function (for testing)
 */
export interface ProgressTrackerConfig {
  totalIcons: number;
  category: string;
  postMessage?: (message: ProgressMessage) => void;
}

/**
 * Progress update parameters
 *
 * @interface ProgressUpdateParams
 * @property {string} message - Status message to display
 * @property {string} currentIcon - Current icon being processed
 * @property {number} [progress] - Current icon progress (0-100)
 */
export interface ProgressUpdateParams {
  message: string;
  currentIcon: string;
  progress?: number;
}

/**
 * Progress message payload sent to UI
 *
 * @interface ProgressMessage
 * @property {string} type - Message type (INIT, PROGRESS_UPDATE, ERROR, etc.)
 * @property {string} [message] - Status message
 * @property {string} [currentIcon] - Current icon name
 * @property {number} [completedIcons] - Number of completed icons
 * @property {number} [totalIcons] - Total number of icons
 * @property {number} [currentIconProgress] - Current icon progress (0-100)
 */
export interface ProgressMessage {
  type: string;
  message?: string;
  currentIcon?: string;
  completedIcons?: number;
  totalIcons?: number;
  currentIconProgress?: number;
}

/**
 * Progress tracker for icon generation workflow
 *
 * Manages hierarchical progress tracking with overall progress (completed icons)
 * and per-icon progress (0-100%). Provides consistent UI message formatting
 * and centralized progress state.
 *
 * **State Management**:
 * - Tracks `completedIcons` (incremented via `iconComplete()`)
 * - Tracks `totalIcons` (set at initialization)
 * - Tracks `currentIcon` (updated via `update()`)
 * - Tracks `currentIconProgress` (0-100, updated via `update()`)
 *
 * **Thread Safety**: Not thread-safe (Figma plugins are single-threaded)
 *
 * @class ProgressTracker
 */
export class ProgressTracker {
  private readonly totalIcons: number;
  private readonly category: string;
  private readonly postMessage: (message: ProgressMessage) => void;

  private completedIcons: number = 0;
  private currentIcon: string = '';
  private currentIconProgress: number = 0;

  /**
   * Create a new progress tracker
   *
   * @param {ProgressTrackerConfig} config - Configuration options
   *
   * @example
   * ```typescript
   * const tracker = new ProgressTracker({
   *   totalIcons: 50,
   *   category: 'Navigation Icons'
   * });
   * ```
   */
  constructor(config: ProgressTrackerConfig) {
    this.totalIcons = config.totalIcons;
    this.category = config.category;
    this.postMessage = config.postMessage || ((msg) => figma.ui.postMessage(msg));
  }

  /**
   * Send initialization message to UI
   *
   * Called at the start of generation to notify UI that work is beginning.
   *
   * @param {string} [message] - Optional custom message (defaults to category-based message)
   *
   * @example
   * ```typescript
   * tracker.init(); // "Initializing generation for Navigation Icons"
   * tracker.init('Starting icon generation...'); // Custom message
   * ```
   */
  init(message?: string): void {
    this.postMessage({
      type: PLUGIN_MESSAGES.INIT,
      message: message || `Initializing generation for ${this.category}`,
    });
  }

  /**
   * Update progress for current icon
   *
   * Reports progress update to UI with current icon status. Progress is
   * optional and represents completion percentage (0-100) for the current icon.
   *
   * **Typical Progress Milestones**:
   * - 0% - Starting icon
   * - 50% - Fetching SVGs
   * - 75% - Creating/updating component
   * - 100% - Icon complete (use `iconComplete()` instead)
   *
   * @param {ProgressUpdateParams} params - Progress update parameters
   *
   * @example Tracking fetch progress
   * ```typescript
   * tracker.update({
   *   message: 'Fetching SVGs for home...',
   *   currentIcon: 'home',
   *   progress: 50
   * });
   * ```
   *
   * @example Simple status update
   * ```typescript
   * tracker.update({
   *   message: 'Analyzing home for updates...',
   *   currentIcon: 'home'
   * });
   * ```
   */
  update(params: ProgressUpdateParams): void {
    this.currentIcon = params.currentIcon;
    if (params.progress !== undefined) {
      this.currentIconProgress = params.progress;
    }

    this.postMessage({
      type: PLUGIN_MESSAGES.PROGRESS_UPDATE,
      message: params.message,
      currentIcon: this.currentIcon,
      completedIcons: this.completedIcons,
      totalIcons: this.totalIcons,
      currentIconProgress: this.currentIconProgress,
    });
  }

  /**
   * Mark current icon as complete and increment counter
   *
   * Increments `completedIcons` counter and sends progress update with
   * 100% completion for the current icon.
   *
   * @param {string} iconName - Name of completed icon
   * @param {string} [message] - Optional completion message (defaults to "✓ iconName")
   *
   * @example
   * ```typescript
   * tracker.iconComplete('home'); // "✓ home"
   * tracker.iconComplete('home', '✓ Updated home (5 variants changed)');
   * ```
   */
  iconComplete(iconName: string, message?: string): void {
    this.completedIcons++;
    this.currentIcon = iconName;
    this.currentIconProgress = 100;

    this.postMessage({
      type: PLUGIN_MESSAGES.PROGRESS_UPDATE,
      message: message || `✓ ${iconName}`,
      currentIcon: iconName,
      completedIcons: this.completedIcons,
      totalIcons: this.totalIcons,
      currentIconProgress: 100,
    });
  }

  /**
   * Send warning message to UI
   *
   * Used for non-fatal issues that don't stop generation (e.g., skipped icons,
   * incomplete downloads, rate limiting).
   *
   * @param {string} message - Warning message to display
   *
   * @example
   * ```typescript
   * tracker.warning('⚠️ Skipping home: All 504 variants failed (rate limiting)');
   * ```
   */
  warning(message: string): void {
    this.postMessage({
      type: 'WARNING',
      message,
    });
  }

  /**
   * Send error message to UI
   *
   * Used for errors that may stop or affect generation. Does not automatically
   * stop generation - caller must handle error recovery.
   *
   * @param {string} message - Error message to display
   *
   * @example
   * ```typescript
   * tracker.error('Failed to load icon list: Network error');
   * tracker.error(`Failed to generate home: ${error.message}`);
   * ```
   */
  error(message: string): void {
    this.postMessage({
      type: PLUGIN_MESSAGES.ERROR,
      message,
    });
  }

  /**
   * Send generation complete message to UI
   *
   * Called when all icons are processed (successfully or with errors).
   * Reports final completion statistics.
   *
   * @param {string} [message] - Optional custom message (defaults to completion summary)
   *
   * @example
   * ```typescript
   * tracker.complete(); // "Successfully generated 10 of 10 icons"
   * tracker.complete('Generation cancelled after 5 icons');
   * ```
   */
  complete(message?: string): void {
    this.postMessage({
      type: PLUGIN_MESSAGES.GENERATION_COMPLETE,
      message:
        message || `Successfully generated ${this.completedIcons} of ${this.totalIcons} icons`,
      completedIcons: this.completedIcons,
    });
  }

  /**
   * Get current progress state
   *
   * Returns snapshot of current progress state for logging or debugging.
   *
   * @returns {Object} Progress state
   * @returns {number} return.completedIcons - Number of completed icons
   * @returns {number} return.totalIcons - Total number of icons
   * @returns {string} return.currentIcon - Current icon being processed
   * @returns {number} return.currentIconProgress - Current icon progress (0-100)
   * @returns {number} return.overallProgress - Overall completion percentage (0-100)
   *
   * @example
   * ```typescript
   * const state = tracker.getState();
   * console.log(`Overall: ${state.overallProgress}%`);
   * console.log(`Current: ${state.currentIcon} at ${state.currentIconProgress}%`);
   * ```
   */
  getState() {
    return {
      completedIcons: this.completedIcons,
      totalIcons: this.totalIcons,
      currentIcon: this.currentIcon,
      currentIconProgress: this.currentIconProgress,
      overallProgress: Math.round((this.completedIcons / this.totalIcons) * 100),
    };
  }

  /**
   * Get number of completed icons
   *
   * @returns {number} Number of icons completed so far
   *
   * @example
   * ```typescript
   * const completed = tracker.getCompletedCount();
   * console.log(`Completed ${completed} of ${tracker.totalIcons} icons`);
   * ```
   */
  getCompletedCount(): number {
    return this.completedIcons;
  }

  /**
   * Get total number of icons
   *
   * @returns {number} Total number of icons to generate
   */
  getTotalCount(): number {
    return this.totalIcons;
  }
}
