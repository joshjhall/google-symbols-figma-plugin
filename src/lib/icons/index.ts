/**
 * @module @figma/icons
 *
 * Icon generation and management utilities for Material Icons.
 *
 * This module provides a comprehensive suite of tools for generating and managing
 * Material Icons in Figma with all 504 variants per icon.
 *
 * **Core Features**:
 * - **Icon Generation**: Create ComponentSets with 504 variants
 * - **Batch Processing**: Generate multiple icons efficiently
 * - **SVG Fetching**: Batch download from GitHub with rate limiting
 * - **Smart Updates**: Incremental updates, skip unchanged icons
 * - **Variant Management**: Intelligent default variant selection
 * - **Metadata Tracking**: Version tracking with commit SHAs
 *
 * **Exported Modules**:
 * - `generator` - IconGenerator class for individual icons
 * - `batch-generator` - Batch processing for multiple icons
 * - `batch-fetcher` - SVG downloading with connection pooling
 * - `variant-utils` - Variant selection and naming utilities
 * - `metadata-helpers` - Metadata reading and skip/update logic
 *
 * @example Generate a single icon
 * ```typescript
 * import { IconGenerator } from '@figma/icons';
 *
 * const generator = new IconGenerator({ applyVariables: true });
 * const result = await generator.generateIcon('home', variantData);
 * ```
 *
 * @example Batch generate icons
 * ```typescript
 * import { generateBatchIcons } from '@figma/icons';
 *
 * await generateBatchIcons({
 *   iconGroups: {
 *     home: { iconName: 'home', variants: [...] },
 *     search: { iconName: 'search', variants: [...] }
 *   }
 * });
 * ```
 *
 * @example Find best default variant
 * ```typescript
 * import { findBestDefaultVariant } from '@figma/icons';
 *
 * const defaultVariant = findBestDefaultVariant(componentSet.children);
 * componentSet.defaultVariant = defaultVariant;
 * ```
 */

export {
  IconGenerator,
  iconGenerator,
  type GeneratorConfig,
  type GenerationResult,
  type VariantData,
} from './generator';

export { generateBatchIcons, type BatchConfig, type BatchResult } from './batch-generator';

export {
  batchFetchSVGs,
  createFetchItems,
  type FetchItem,
  type FetchResult,
  type BatchFetchConfig,
  type BatchFetchStats,
} from './batch-fetcher';

export {
  findBestDefaultVariant,
  parseVariantName,
  buildVariantName,
  getIdealDefaultVariantName,
  VARIANT_PREFERENCES,
} from './variant-utils';

export {
  getCommitSha,
  getSvgHash,
  isComponentSetComplete,
  getVariantCount,
  shouldSkipComponentSet,
  getVariantHashes,
  findComponentSet,
  checkIconNeedsUpdate,
  logUpdateCheckResult,
  type UpdateCheckResult,
} from './metadata-helpers';
