/**
 * @module @figma/icons/variant-utils
 *
 * Utilities for managing icon variants with intelligent default selection.
 *
 * Material Icons have 504 variants per icon (7 styles × 6 weights × 4 fills × 3 grades × 4 sizes).
 * This module provides:
 *
 * - **Smart Default Selection**: Chooses best variant using preference order
 * - **Variant Parsing**: Extracts properties from component names
 * - **Variant Building**: Constructs proper component names
 * - **Fallback Logic**: Gracefully handles missing preferred variants
 *
 * **Variant Properties**:
 * - **Style**: Rounded (preferred), Sharp, Outlined
 * - **Weight**: 400 (preferred), then 300, 500, 200, 600, 100, 700
 * - **Fill**: Off (preferred), On
 * - **Grade**: Normal (preferred), Dark theme, Emphasis
 * - **Optical Size**: 24dp (preferred), then 40dp, 20dp, 48dp
 *
 * **Naming Convention**:
 * ```
 * "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 *
 * @example Find best default variant
 * ```typescript
 * const components = componentSet.children;
 * const defaultVariant = findBestDefaultVariant(components);
 *
 * if (defaultVariant) {
 *   componentSet.defaultVariant = defaultVariant as ComponentNode;
 * }
 * ```
 *
 * @example Parse variant name
 * ```typescript
 * const props = parseVariantName(component.name);
 * if (props) {
 *   console.log(`Weight: ${props.weight}, Fill: ${props.fill}`);
 * }
 * ```
 */

import { logger } from '@lib/utils';

/**
 * Preference order for variant properties
 *
 * Defines which variant values should be selected as defaults when multiple
 * options are available. Order matters: first item is most preferred.
 *
 * @constant
 * @property {string[]} style - Style preferences: Rounded > Sharp > Outlined
 * @property {number[]} weight - Weight preferences: 400 > 300 > 500 > 200 > 600 > 100 > 700
 * @property {string[]} fill - Fill preferences: Off > On
 * @property {string[]} grade - Grade preferences: Normal > Dark theme > Emphasis
 * @property {string[]} opticalSize - Size preferences: 24dp > 40dp > 20dp > 48dp
 *
 * @example
 * ```typescript
 * const bestWeight = VARIANT_PREFERENCES.weight[0]; // 400
 * const fallbackWeight = VARIANT_PREFERENCES.weight[1]; // 300
 * ```
 */
export const VARIANT_PREFERENCES = {
  style: ['Rounded', 'Sharp', 'Outlined'],
  weight: [400, 300, 500, 200, 600, 100, 700],
  fill: ['Off', 'On'],
  grade: ['Normal', 'Dark theme', 'Emphasis'],
  opticalSize: ['24dp', '40dp', '20dp', '48dp'],
};

/**
 * Variant property names as they appear in component names
 *
 * @interface VariantProperties
 * @property {string} style - Style name (e.g., "Rounded", "Sharp", "Outlined")
 * @property {number} weight - Weight value (100, 200, 300, 400, 500, 600, 700)
 * @property {string} fill - Fill state ("Off" or "On")
 * @property {string} grade - Grade name ("Normal", "Dark theme", "Emphasis")
 * @property {string} opticalSize - Optical size ("20dp", "24dp", "40dp", "48dp")
 */
interface VariantProperties {
  style: string;
  weight: number;
  fill: string;
  grade: string;
  opticalSize: string;
}

/**
 * Parse variant properties from a component name
 *
 * Extracts structured properties from Figma component variant names using the
 * standard naming convention: "Key=Value, Key=Value, ..."
 *
 * @param {string} name - Component name to parse
 * @returns {VariantProperties | null} Parsed properties or null if invalid format
 *
 * @example
 * ```typescript
 * const props = parseVariantName(
 *   "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * );
 *
 * if (props) {
 *   console.log(props.style);      // "Rounded"
 *   console.log(props.weight);     // 400
 *   console.log(props.fill);       // "Off"
 *   console.log(props.grade);      // "Normal"
 *   console.log(props.opticalSize); // "24dp"
 * }
 * ```
 */
export function parseVariantName(name: string): VariantProperties | null {
  try {
    const parts = name.split(', ');
    const props: Partial<VariantProperties> = {};

    for (const part of parts) {
      const [key, value] = part.split('=');

      switch (key) {
        case 'Style':
          props.style = value;
          break;
        case 'Weight':
          props.weight = parseInt(value, 10);
          break;
        case 'Fill':
          props.fill = value;
          break;
        case 'Grade':
          props.grade = value;
          break;
        case 'Optical size':
          props.opticalSize = value;
          break;
      }
    }

    // Validate all properties are present
    if (props.style && props.weight && props.fill && props.grade && props.opticalSize) {
      return props as VariantProperties;
    }

    return null;
  } catch {
    logger.warn(`Failed to parse variant name: ${name}`);
    return null;
  }
}

/**
 * Type guard to check if parsed variant has valid props
 */
function hasValidProps(v: {
  component: { name: string };
  props: VariantProperties | null;
}): v is { component: { name: string }; props: VariantProperties } {
  return v.props !== null;
}

/**
 * Find the best default variant from available components using preference order
 *
 * Intelligently selects the most appropriate default variant from a ComponentSet's
 * children based on preference order. Uses cascading fallback logic to handle
 * cases where preferred options aren't available.
 *
 * **Selection Algorithm**:
 * 1. Parse all component variant names
 * 2. Collect available values for each property (style, weight, fill, grade, size)
 * 3. Select best available value for each property using preferences
 * 4. Find exact match for best combination
 * 5. If no exact match, use relaxed criteria fallback (priority: style > weight > fill > grade > size)
 * 6. If still no match, use first available variant
 *
 * **Fallback Strategy**:
 * - Try: exact match (all 5 properties)
 * - Try: relaxed optical size (any size)
 * - Try: relaxed grade + size
 * - Try: relaxed fill + grade + size
 * - Try: relaxed weight + fill + grade + size
 * - Try: relaxed style (any style)
 * - Last resort: first variant
 *
 * @param {ReadonlyArray<{name: string}>} components - Component variants to choose from
 * @param {typeof VARIANT_PREFERENCES} [preferences] - Custom preference order (defaults to VARIANT_PREFERENCES)
 * @returns {{name: string} | null} Best default variant or null if none found
 *
 * @example Basic usage
 * ```typescript
 * const componentSet = page.findOne(n => n.type === 'COMPONENT_SET' && n.name === 'home');
 * if (componentSet) {
 *   const defaultVariant = findBestDefaultVariant(componentSet.children);
 *   if (defaultVariant) {
 *     componentSet.defaultVariant = defaultVariant as ComponentNode;
 *   }
 * }
 * ```
 *
 * @example Custom preferences
 * ```typescript
 * const customPrefs = {
 *   ...VARIANT_PREFERENCES,
 *   style: ['Sharp', 'Rounded', 'Outlined'], // Prefer Sharp over Rounded
 *   weight: [700, 600, 500, 400, 300, 200, 100] // Prefer bold weights
 * };
 *
 * const defaultVariant = findBestDefaultVariant(components, customPrefs);
 * ```
 */
export function findBestDefaultVariant(
  components: ReadonlyArray<{ name: string }>,
  preferences: typeof VARIANT_PREFERENCES = VARIANT_PREFERENCES
): { name: string } | null {
  // Parse all component variants
  const parsedVariants = components
    .map((comp) => ({
      component: comp,
      props: parseVariantName(comp.name),
    }))
    .filter(hasValidProps);

  if (parsedVariants.length === 0) {
    logger.warn('No valid variants found to select default');
    return null;
  }

  // Find available values for each property
  const availableValues = {
    styles: new Set(parsedVariants.map((v) => v.props.style)),
    weights: new Set(parsedVariants.map((v) => v.props.weight)),
    fills: new Set(parsedVariants.map((v) => v.props.fill)),
    grades: new Set(parsedVariants.map((v) => v.props.grade)),
    opticalSizes: new Set(parsedVariants.map((v) => v.props.opticalSize)),
  };

  // Select best available value for each property based on preferences
  const bestStyle =
    preferences.style.find((s) => availableValues.styles.has(s)) || [...availableValues.styles][0];
  const bestWeight =
    preferences.weight.find((w) => availableValues.weights.has(w)) ||
    [...availableValues.weights][0];
  const bestFill =
    preferences.fill.find((f) => availableValues.fills.has(f)) || [...availableValues.fills][0];
  const bestGrade =
    preferences.grade.find((g) => availableValues.grades.has(g)) || [...availableValues.grades][0];
  const bestOpticalSize =
    preferences.opticalSize.find((o) => availableValues.opticalSizes.has(o)) ||
    [...availableValues.opticalSizes][0];

  logger.info(
    `Best default variant criteria: Style=${bestStyle}, Weight=${bestWeight}, Fill=${bestFill}, Grade=${bestGrade}, Optical size=${bestOpticalSize}`
  );

  // Find the variant that matches our best criteria
  const bestVariant = parsedVariants.find(
    (v) =>
      v.props.style === bestStyle &&
      v.props.weight === bestWeight &&
      v.props.fill === bestFill &&
      v.props.grade === bestGrade &&
      v.props.opticalSize === bestOpticalSize
  );

  if (bestVariant) {
    logger.info(`Found best default variant: ${bestVariant.component.name}`);
    return bestVariant.component;
  }

  // If exact match not found, find closest match by relaxing criteria
  // Priority order: style > weight > fill > grade > optical size
  const fallbackVariant =
    findWithRelaxedCriteria(
      parsedVariants,
      bestStyle,
      bestWeight,
      bestFill,
      bestGrade,
      bestOpticalSize
    ) ||
    findWithRelaxedCriteria(parsedVariants, bestStyle, bestWeight, bestFill, bestGrade, null) ||
    findWithRelaxedCriteria(parsedVariants, bestStyle, bestWeight, bestFill, null, null) ||
    findWithRelaxedCriteria(parsedVariants, bestStyle, bestWeight, null, null, null) ||
    findWithRelaxedCriteria(parsedVariants, bestStyle, null, null, null, null) ||
    parsedVariants[0]; // Last resort: first variant

  if (fallbackVariant) {
    logger.info(`Using fallback default variant: ${fallbackVariant.component.name}`);
    return fallbackVariant.component;
  }

  return null;
}

/**
 * Find variant with relaxed criteria (null means any value is acceptable)
 */
function findWithRelaxedCriteria(
  parsedVariants: Array<{ component: { name: string }; props: VariantProperties }>,
  style: string | null,
  weight: number | null,
  fill: string | null,
  grade: string | null,
  opticalSize: string | null
): { component: { name: string }; props: VariantProperties } | undefined {
  return parsedVariants.find(
    (v) =>
      (style === null || v.props.style === style) &&
      (weight === null || v.props.weight === weight) &&
      (fill === null || v.props.fill === fill) &&
      (grade === null || v.props.grade === grade) &&
      (opticalSize === null || v.props.opticalSize === opticalSize)
  );
}

/**
 * Build a variant name from properties
 *
 * Constructs a properly formatted component variant name from property values
 * following the Figma naming convention.
 *
 * @param {VariantProperties} props - Variant properties
 * @returns {string} Formatted variant name
 *
 * @example
 * ```typescript
 * const name = buildVariantName({
 *   style: 'Rounded',
 *   weight: 400,
 *   fill: 'Off',
 *   grade: 'Normal',
 *   opticalSize: '24dp'
 * });
 * // "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 */
export function buildVariantName(props: VariantProperties): string {
  return [
    `Style=${props.style}`,
    `Weight=${props.weight}`,
    `Fill=${props.fill}`,
    `Grade=${props.grade}`,
    `Optical size=${props.opticalSize}`,
  ].join(', ');
}

/**
 * Get the ideal default variant name based on available styles
 *
 * Returns the name of the ideal default variant using the most preferred style
 * from the available options and default values for other properties.
 *
 * @param {string[]} availableStyles - List of available style names
 * @returns {string} Complete variant name for ideal default
 *
 * @example
 * ```typescript
 * const styles = ['Rounded', 'Sharp'];
 * const defaultName = getIdealDefaultVariantName(styles);
 * // "Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 *
 * @example With only Sharp available
 * ```typescript
 * const styles = ['Sharp'];
 * const defaultName = getIdealDefaultVariantName(styles);
 * // "Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp"
 * ```
 */
export function getIdealDefaultVariantName(availableStyles: string[]): string {
  // Find the best style from available options
  const bestStyle =
    VARIANT_PREFERENCES.style.find(
      (s) => availableStyles.includes(s) || availableStyles.includes(s.toLowerCase())
    ) ||
    availableStyles[0] ||
    'Rounded';

  return buildVariantName({
    style: bestStyle,
    weight: VARIANT_PREFERENCES.weight[0],
    fill: VARIANT_PREFERENCES.fill[0],
    grade: VARIANT_PREFERENCES.grade[0],
    opticalSize: VARIANT_PREFERENCES.opticalSize[0],
  });
}

/**
 * Clean up unnecessary fills from variant component frames
 *
 * When variants are created from SVG, the component frame sometimes retains
 * a white fill (#FFFFFF) that should be removed. This adds unnecessary weight
 * to the Figma file, especially problematic with 100k+ variants.
 *
 * This function removes any fills from variant component frames, ensuring they
 * have no background (icons should only have vector content, no frame fills).
 *
 * @param {ComponentNode} component - The variant component to clean up
 * @returns {boolean} True if fills were removed, false if component already had no fills
 *
 * @example
 * ```typescript
 * const component = figma.createComponent();
 * // ... create variant from SVG ...
 *
 * // Clean up any unnecessary fills
 * const cleaned = cleanupVariantFills(component);
 * if (cleaned) {
 *   logger.info('Removed unnecessary fills from variant frame');
 * }
 * ```
 */
export function cleanupVariantFills(component: ComponentNode): boolean {
  try {
    // Check if component has any fills
    if (component.fills && (component.fills as readonly Paint[]).length > 0) {
      const fillCount = (component.fills as readonly Paint[]).length;
      logger.debug(`Removing ${fillCount} fill(s) from variant frame: ${component.name}`);

      // Remove all fills from the component frame
      component.fills = [];

      return true;
    }

    return false;
  } catch (error) {
    logger.warn(`Error during fill cleanup for ${component.name}: ${error}`);
    return false;
  }
}
