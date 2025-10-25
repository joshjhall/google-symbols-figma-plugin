/**
 * @module @figma/github/url-generator
 *
 * Generates GitHub URLs for Material Icons SVG files based on variant properties.
 *
 * The Material Icons repository has a specific naming convention for SVG files:
 * - Style: materialsymbolsrounded | materialsymbolsoutlined | materialsymbolssharp
 * - Fill: fill0 (default, omitted) | fill1
 * - Weight: 100-700 (default 400, omitted when default)
 * - Grade: gradN25 | grad0 (default, omitted) | grad200
 * - Optical size: 20px | 24px (default) | 40px | 48px
 *
 * File naming pattern:
 * {icon}[_fill{0|1}][_wght{100-700}][_grad{N25|200}][_opsz{20|40|48}]_{size}px.svg
 *
 * Examples:
 * - home_24px.svg (all defaults)
 * - home_fill1_24px.svg (filled)
 * - home_wght300_24px.svg (weight 300)
 * - home_fill1_wght300_grad200_opsz48_48px.svg (all modifiers)
 */

/**
 * Icon style variants
 */
export type IconStyle = 'rounded' | 'outlined' | 'sharp';

/**
 * Icon variant properties
 */
export interface IconVariant {
  fill: 0 | 1;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade: -25 | 0 | 200;
  opticalSize: 20 | 24 | 40 | 48;
}

/**
 * Default variant values
 */
const DEFAULTS: IconVariant = {
  fill: 0,
  weight: 400,
  grade: 0,
  opticalSize: 24,
};

/**
 * Maps style to GitHub directory name
 */
const STYLE_MAP: Record<IconStyle, string> = {
  rounded: 'materialsymbolsrounded',
  outlined: 'materialsymbolsoutlined',
  sharp: 'materialsymbolssharp',
};

/**
 * Generates the filename for a Material Icon variant.
 *
 * Material Icons repository naming pattern:
 * - Weight is included ONLY when not 400 (default): wght100-700
 * - Modifiers are combined without underscores between them
 * - Order: weight, grade, fill (e.g., wght200gradN25fill1)
 * - No opsz modifier, just the size at the end
 *
 * @param iconName - Name of the icon
 * @param variant - Variant properties
 * @returns Generated filename
 *
 * @example
 * ```typescript
 * generateFilename('home', { fill: 1, weight: 200, grade: -25, opticalSize: 48 });
 * // Returns: "home_wght200gradN25fill1_48px.svg"
 * ```
 */
export function generateFilename(iconName: string, variant: IconVariant): string {
  let filename = iconName;

  // Build the modifier string (all modifiers combine without underscores)
  let modifiers = '';

  // Add weight modifier if not default (400)
  if (variant.weight !== DEFAULTS.weight) {
    modifiers += `wght${variant.weight}`;
  }

  // Add grade modifier if not default (0)
  if (variant.grade === -25) {
    modifiers += 'gradN25';
  } else if (variant.grade === 200) {
    modifiers += 'grad200';
  }

  // Add fill modifier if filled (1)
  if (variant.fill === 1) {
    modifiers += 'fill1';
  }

  // Add modifiers to filename if any exist
  if (modifiers) {
    filename += '_' + modifiers;
  }

  // Always end with size in px
  filename += `_${variant.opticalSize}px.svg`;

  return filename;
}

/**
 * GitHub reference (branch or tag) to use for fetching icons.
 * Default: 'master' (can be changed to '4.0.0' or other tags for stability)
 *
 * To change this, update the value before generating URLs:
 * ```typescript
 * import { setGitHubRef } from './url-generator';
 * setGitHubRef('4.0.0');
 * ```
 */
let GITHUB_REF = 'master';

/**
 * Set the GitHub reference (branch or tag) to use for fetching icons.
 *
 * @param ref - Branch name (e.g., 'master', 'main') or tag (e.g., '4.0.0')
 *
 * @example
 * ```typescript
 * setGitHubRef('4.0.0'); // Use tagged release
 * setGitHubRef('master'); // Use master branch
 * ```
 */
export function setGitHubRef(ref: string): void {
  GITHUB_REF = ref;
}

/**
 * Get the current GitHub reference being used.
 *
 * @returns Current GitHub ref (branch or tag)
 */
export function getGitHubRef(): string {
  return GITHUB_REF;
}

/**
 * Generates the full GitHub URL for a Material Icon variant.
 *
 * @param iconName - Name of the icon
 * @param style - Icon style
 * @param variant - Variant properties
 * @returns Full GitHub raw content URL
 *
 * @example
 * ```typescript
 * generateGitHubUrl('home', 'rounded', {
 *   fill: 1,
 *   weight: 300,
 *   grade: 200,
 *   opticalSize: 40
 * });
 * // Returns: "https://raw.githubusercontent.com/.../home_fill1_wght300_grad200_opsz40_40px.svg"
 * ```
 */
export function generateGitHubUrl(
  iconName: string,
  style: IconStyle,
  variant: IconVariant
): string {
  const baseUrl = `https://raw.githubusercontent.com/google/material-design-icons/${GITHUB_REF}/symbols/web`;
  const styleDir = STYLE_MAP[style];
  const filename = generateFilename(iconName, variant);

  return `${baseUrl}/${iconName}/${styleDir}/${filename}`;
}

/**
 * Generates all possible variants for testing.
 *
 * @returns Array of all variant combinations
 */
export function generateAllVariants(): IconVariant[] {
  const variants: IconVariant[] = [];
  const fills: (0 | 1)[] = [0, 1];
  const weights: IconVariant['weight'][] = [100, 200, 300, 400, 500, 600, 700];
  const grades: IconVariant['grade'][] = [-25, 0, 200];
  const opticalSizes: IconVariant['opticalSize'][] = [20, 24, 40, 48];

  for (const fill of fills) {
    for (const weight of weights) {
      for (const grade of grades) {
        for (const opticalSize of opticalSizes) {
          variants.push({ fill, weight, grade, opticalSize });
        }
      }
    }
  }

  return variants;
}

/**
 * Generates a subset of common variants for quick testing.
 *
 * @param weights - Weights to include (default: [300, 400])
 * @returns Array of common variant combinations
 */
export function generateCommonVariants(
  weights: IconVariant['weight'][] = [300, 400]
): IconVariant[] {
  const variants: IconVariant[] = [];

  for (const weight of weights) {
    // Standard variants at 24px
    variants.push(
      { weight, fill: 0, grade: 0, opticalSize: 24 },
      { weight, fill: 1, grade: 0, opticalSize: 24 },
      { weight, fill: 0, grade: -25, opticalSize: 24 }, // Dark theme
      { weight, fill: 0, grade: 200, opticalSize: 24 } // Emphasis
    );

    // Different optical sizes (unfilled only for simplicity)
    variants.push(
      { weight, fill: 0, grade: 0, opticalSize: 20 },
      { weight, fill: 0, grade: 0, opticalSize: 40 }
    );
  }

  return variants;
}
