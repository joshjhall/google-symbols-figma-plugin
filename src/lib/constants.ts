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
