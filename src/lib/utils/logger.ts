/**
 * @module @figma/utils/logger
 *
 * Structured logging utilities for Figma plugin development.
 *
 * This module provides a lightweight logging system optimized for browser
 * console output with Figma UI integration. Features include log levels,
 * structured data, timing utilities, and context-aware logging.
 *
 * @example Basic logging
 * ```typescript
 * import { logger } from '@figma/utils/logger';
 *
 * logger.info('Processing icons', { count: 100 });
 * logger.error('Failed to generate', { iconName: 'home' });
 * logger.debug('Variable resolved', { id: 'var_123' });
 * ```
 *
 * @example Timing operations
 * ```typescript
 * const endTimer = logger.time('Icon generation');
 * await generateIcons();
 * endTimer(); // Logs: [TIMER] Icon generation completed in 1234ms
 * ```
 *
 * @example Context logging
 * ```typescript
 * const contextLogger = logger.withContext({
 *   userId: '123',
 *   plugin: 'material-icons'
 * });
 *
 * contextLogger.info('Started'); // Includes context in log data
 * ```
 */

/** Valid log levels in order of severity */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structure of a log entry */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Main logger class for Figma plugin.
 *
 * Provides structured logging with:
 * - Configurable log levels
 * - Formatted console output
 * - Figma UI notifications
 * - Timing utilities
 * - Contextual logging
 *
 * @category Core
 */
class PluginLogger {
  private enabled = true;
  private logLevel: LogLevel = 'info';

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Sets the minimum log level.
   * Messages below this level will be ignored.
   *
   * @param level - Minimum level to log
   *
   * @example
   * ```typescript
   * logger.setLevel('warn'); // Only warn and error messages
   * logger.setLevel('debug'); // All messages
   * ```
   */
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Enables or disables all logging output.
   *
   * @param enabled - Whether logging should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabled && this.levels[level] >= this.levels[this.logLevel];
  }

  private format(entry: LogEntry): string {
    const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp.split('T')[1].slice(0, 8)}`;
    return `${prefix} ${entry.message}`;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    const formatted = this.format(entry);

    switch (level) {
      case 'error':
        console.error(formatted, data || '');
        break;
      case 'warn':
        console.warn(formatted, data || '');
        break;
      default:
        console.log(formatted, data || '');
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /**
   * Shows a notification in the Figma UI.
   *
   * @param message - Message to display
   * @param error - Whether to show as error (red) or info (default)
   *
   * @example
   * ```typescript
   * logger.notify('Icons generated successfully');
   * logger.notify('Failed to bind variables', true);
   * ```
   */
  notify(message: string, error = false): void {
    if (typeof figma !== 'undefined') {
      figma.notify(message, { error, timeout: error ? 5000 : 3000 });
    }
    this.log(error ? 'error' : 'info', `[NOTIFY] ${message}`);
  }

  /**
   * Starts a timer and returns a function to stop it.
   *
   * @param label - Label for the timer
   * @returns Function to call when operation completes
   *
   * @example
   * ```typescript
   * const stop = logger.time('Generate icons');
   * await generateAllIcons();
   * stop(); // Logs execution time
   * ```
   */
  time(label: string): () => void {
    const start = Date.now();
    this.debug(`[TIMER] ${label} started`);

    return () => {
      const duration = Date.now() - start;
      this.info(`[TIMER] ${label} completed in ${duration}ms`);
    };
  }

  /**
   * Creates a logger instance with additional context.
   * Context is included with every log message.
   *
   * @param context - Context object to include with logs
   * @returns Logger interface with context
   *
   * @example
   * ```typescript
   * const iconLogger = logger.withContext({
   *   component: 'IconGenerator',
   *   version: '1.0.0'
   * });
   *
   * iconLogger.info('Processing'); // Includes context
   * ```
   */
  withContext(context: Record<string, unknown>) {
    return {
      debug: (msg: string, data?: unknown) =>
        this.debug(msg, {
          ...context,
          ...(typeof data === 'object' && data !== null ? data : { data }),
        }),
      info: (msg: string, data?: unknown) =>
        this.info(msg, {
          ...context,
          ...(typeof data === 'object' && data !== null ? data : { data }),
        }),
      warn: (msg: string, data?: unknown) =>
        this.warn(msg, {
          ...context,
          ...(typeof data === 'object' && data !== null ? data : { data }),
        }),
      error: (msg: string, data?: unknown) =>
        this.error(msg, {
          ...context,
          ...(typeof data === 'object' && data !== null ? data : { data }),
        }),
    };
  }
}

// Export singleton instance
export const logger = new PluginLogger();

// Export convenience functions
export const { debug, info, warn, error, notify, time, withContext } = logger;

// Set log level based on environment
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  logger.setLevel('warn');
}
