/**
 * @module @figma/utils/errors
 *
 * Error handling utilities for Figma plugin development.
 *
 * This module provides structured error classes optimized for the Figma plugin
 * environment. Adapted from @terroir/core error system but simplified for
 * browser context and plugin-specific needs.
 *
 * @example Basic error handling
 * ```typescript
 * import { VariableNotFoundError, wrapError } from '@figma/utils/errors';
 *
 * try {
 *   const variable = await resolveVariable(name);
 *   if (!variable) {
 *     throw new VariableNotFoundError(name);
 *   }
 * } catch (error) {
 *   const wrapped = wrapError(error);
 *   logger.error('Failed to resolve variable', wrapped);
 *   figma.notify(wrapped.message, { error: true });
 * }
 * ```
 *
 * @example Type-safe error checking
 * ```typescript
 * import { isFigmaPluginError, IconGenerationError } from '@figma/utils/errors';
 *
 * if (isFigmaPluginError(error)) {
 *   // Access typed properties
 *   console.log(error.code, error.details);
 *
 *   if (error instanceof IconGenerationError) {
 *     // Handle specific error type
 *     retryIconGeneration(error.details.iconName);
 *   }
 * }
 * ```
 */

/**
 * Base error class for all Figma plugin errors.
 *
 * Provides consistent error structure with:
 * - Error code for programmatic handling
 * - Optional details object for debugging
 * - Timestamp for error tracking
 * - Proper stack trace capture
 *
 * @extends Error
 * @category Core
 */
export class FigmaPluginError extends Error {
  /** ISO timestamp when error occurred */
  public readonly timestamp = new Date().toISOString();

  /**
   * Creates a new FigmaPluginError
   * @param message - Human-readable error message
   * @param code - Machine-readable error code for programmatic handling
   * @param details - Additional context and debugging information
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'FigmaPluginError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a design token variable cannot be resolved.
 *
 * @extends FigmaPluginError
 * @category Variables
 *
 * @example
 * ```typescript
 * const variable = await resolveVariable('M3/palette/primary');
 * if (!variable) {
 *   throw new VariableNotFoundError('M3/palette/primary', {
 *     searchedCollections: ['M3/palette', 'M2/palette'],
 *     availableVariables: 150
 *   });
 * }
 * ```
 */
export class VariableNotFoundError extends FigmaPluginError {
  constructor(variableName: string, details?: unknown) {
    super(`Variable "${variableName}" not found in library or page`, 'VARIABLE_NOT_FOUND', {
      variableName,
      ...(typeof details === 'object' && details !== null ? details : {}),
    });
  }
}

/**
 * Error thrown when variable binding to a Figma node fails.
 *
 * @extends FigmaPluginError
 * @category Variables
 *
 * @example
 * ```typescript
 * try {
 *   componentSet.setBoundVariable('cornerRadius', variable);
 * } catch (error) {
 *   throw new VariableBindingError('Failed to bind corner radius', {
 *     nodeId: componentSet.id,
 *     variableId: variable.id,
 *     field: 'cornerRadius'
 *   });
 * }
 * ```
 */
export class VariableBindingError extends FigmaPluginError {
  /**
   * Creates a new VariableBindingError
   * @param message - Description of what binding operation failed
   * @param details - Context about the binding attempt
   */
  constructor(message: string, details?: unknown) {
    super(message, 'VARIABLE_BINDING_ERROR', details);
  }
}

/**
 * Error thrown during Material Icon generation process.
 *
 * @extends FigmaPluginError
 * @category Icons
 *
 * @example
 * ```typescript
 * const svgContent = await fetchSVG(iconUrl);
 * if (!svgContent) {
 *   throw new IconGenerationError(
 *     'home',
 *     'SVG content is empty',
 *     { url: iconUrl, variant: 'rounded' }
 *   );
 * }
 * ```
 */
export class IconGenerationError extends FigmaPluginError {
  /**
   * Creates a new IconGenerationError
   * @param iconName - Name of the icon that failed to generate
   * @param reason - Specific reason for the failure
   * @param details - Additional error context
   */
  constructor(iconName: string, reason: string, details?: unknown) {
    super(`Failed to generate icon "${iconName}": ${reason}`, 'ICON_GENERATION_ERROR', {
      iconName,
      reason,
      ...(typeof details === 'object' && details !== null ? details : {}),
    });
  }
}

/**
 * Error thrown when fetching resources from external URLs fails.
 *
 * @extends FigmaPluginError
 * @category Network
 *
 * @example
 * ```typescript
 * const response = await fetch(iconUrl);
 * if (!response.ok) {
 *   throw new FetchError(
 *     iconUrl,
 *     response.status,
 *     { statusText: response.statusText }
 *   );
 * }
 * ```
 */
export class FetchError extends FigmaPluginError {
  /**
   * Creates a new FetchError
   * @param url - URL that failed to fetch
   * @param statusCode - HTTP status code if available
   * @param details - Additional error context
   */
  constructor(url: string, statusCode?: number, details?: unknown) {
    super(`Failed to fetch from ${url}${statusCode ? ` (${statusCode})` : ''}`, 'FETCH_ERROR', {
      url,
      statusCode,
      ...(typeof details === 'object' && details !== null ? details : {}),
    });
  }
}

/**
 * Type guard to check if an error is a FigmaPluginError.
 *
 * @param error - Error to check
 * @returns True if error is a FigmaPluginError or subclass
 * @category Type Guards
 *
 * @example
 * ```typescript
 * try {
 *   await generateIcon();
 * } catch (error) {
 *   if (isFigmaPluginError(error)) {
 *     logger.error(`Plugin error ${error.code}:`, error.details);
 *   }
 * }
 * ```
 */
export function isFigmaPluginError(error: unknown): error is FigmaPluginError {
  return error instanceof FigmaPluginError;
}

/**
 * Wraps unknown errors in a FigmaPluginError for consistent handling.
 *
 * @param error - Error to wrap (can be any type)
 * @param code - Error code to use if creating new error
 * @returns FigmaPluginError instance
 * @category Utilities
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const wrapped = wrapError(error, 'RISKY_OP_FAILED');
 *   logger.error('Operation failed', wrapped);
 *   throw wrapped;
 * }
 * ```
 */
export function wrapError(error: unknown, code = 'UNKNOWN_ERROR'): FigmaPluginError {
  if (isFigmaPluginError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new FigmaPluginError(error.message, code, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new FigmaPluginError(String(error), code, { originalError: error });
}
