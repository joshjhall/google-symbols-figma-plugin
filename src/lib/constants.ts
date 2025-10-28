/**
 * Plugin constants and metadata keys
 */

/**
 * Plugin data keys for storing metadata on Figma nodes
 * These keys are used with setPluginData/getPluginData to store invisible metadata
 */
export const PLUGIN_DATA_KEYS = {
  /**
   * Git commit SHA stored on ComponentSetNode
   * Indicates which version of Material Icons this component was built from
   */
  GIT_COMMIT_SHA: 'git_commit_sha',

  /**
   * SVG content hash stored on ComponentNode (variant)
   * DJB2 hash of the normalized SVG content used to create this variant
   */
  SVG_HASH: 'svg_hash',
} as const;

/**
 * Expected variant count for a complete Material Icons component
 * 3 styles × 7 weights × 2 fills × 3 grades × 4 optical sizes = 504
 */
export const EXPECTED_VARIANT_COUNT = 504;

/**
 * Feature Flags
 */
export const FEATURE_FLAGS = {
  /**
   * Enable cleanup of unnecessary variant property definitions
   *
   * When enabled, the plugin will scan all ComponentSets and remove unnecessary
   * component property definitions from individual variants. This fixes "hidden fill"
   * and other unnecessary properties that appear on variants when they're added to
   * ComponentSets after initial creation.
   *
   * Set to true to enable cleanup, false to disable.
   * Can be disabled once existing components have been cleaned up.
   */
  ENABLE_VARIANT_CLEANUP: true,
} as const;
