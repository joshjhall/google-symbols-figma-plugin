/**
 * @module handlers
 *
 * Message handlers for Figma plugin operations.
 * Extracted from code.ts for better modularity and testability.
 */

export { handleCategoryGeneration, type CategoryGenerationConfig } from './category-generation';

export { organizePageIntoFrame } from './page-organization';

export {
  getFinalSetName,
  hasIconChangedCumulatively,
  logCumulativeChangeStatus,
  type CumulativeChangeData,
} from './cumulative-changes';
