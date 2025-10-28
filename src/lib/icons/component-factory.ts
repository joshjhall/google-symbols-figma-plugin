/**
 * @module @figma/icons/component-factory
 *
 * Component creation and manipulation for Material Icon variants.
 *
 * This module handles the low-level details of creating and updating Figma
 * components from SVG content. It manages:
 * - SVG parsing using Figma's undocumented createNodeFromSvg API
 * - Component node creation and sizing
 * - Content hash storage for change detection
 * - Vector content manipulation to avoid nested frames
 *
 * **Key Responsibilities**:
 * - **Component Creation**: Convert SVG strings to Figma ComponentNodes
 * - **Component Updates**: Replace existing component content with new SVG
 * - **Hash Management**: Store/retrieve content hashes for change detection
 * - **Node Manipulation**: Move vector children to avoid frame nesting
 *
 * **SVG to Component Process**:
 * 1. Parse SVG using `figma.createNodeFromSvg()` (creates FrameNode)
 * 2. Create empty ComponentNode
 * 3. Move all vector children from Frame to Component
 * 4. Remove the now-empty Frame
 * 5. Store content hash in plugin data
 *
 * **Why Avoid Frame Nesting**:
 * Figma's `createNodeFromSvg()` creates a Frame containing the vectors.
 * We want components to contain vectors directly (not Frame → vectors)
 * for cleaner hierarchy and better performance.
 *
 * @example Create variant component
 * ```typescript
 * import { createVariantComponent } from '@figma/icons/component-factory';
 *
 * const component = await createVariantComponent({
 *   iconName: 'home',
 *   style: 'rounded',
 *   variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   svgContent: '<svg>...</svg>'
 * });
 *
 * if (component) {
 *   console.log(`Created: ${component.name}`);
 * }
 * ```
 *
 * @example Update existing component
 * ```typescript
 * import { updateVariantComponent } from '@figma/icons/component-factory';
 *
 * const component = figma.getNodeById('...') as ComponentNode;
 * await updateVariantComponent(component, {
 *   iconName: 'home',
 *   style: 'rounded',
 *   variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   svgContent: '<svg>...</svg>'
 * });
 * // Component content now replaced
 * ```
 *
 * @example Check if content changed
 * ```typescript
 * import { getStoredHash } from '@figma/icons/component-factory';
 * import { hashSvg } from '@lib/utils';
 *
 * const component = figma.getNodeById('...') as ComponentNode;
 * const storedHash = getStoredHash(component);
 * const currentHash = hashSvg(newSvgContent);
 *
 * if (storedHash !== currentHash) {
 *   // Content changed, update component
 *   await updateVariantComponent(component, variantData);
 * }
 * ```
 */

import { logger, hashSvg } from '@lib/utils';
import { PLUGIN_DATA_KEYS } from '@lib/constants';
import { getVariantName } from './variant-formatter';
import { cleanupVariantFills } from './variant-utils';
import type { VariantData } from './generator';

/**
 * Extended Figma type with undocumented APIs
 *
 * Figma's `createNodeFromSvg` method is not officially documented but
 * is available in the plugin API. It parses SVG strings and creates
 * Figma nodes (typically a FrameNode containing vector children).
 *
 * @interface FigmaExtended
 * @extends {PluginAPI}
 * @property {Function} createNodeFromSvg - Parse SVG string to Figma nodes
 */
interface FigmaExtended extends PluginAPI {
  /**
   * Create Figma nodes from SVG string (undocumented API)
   *
   * @param {string} svg - SVG content to parse
   * @returns {FrameNode} Frame containing the parsed vectors
   */
  createNodeFromSvg(svg: string): FrameNode;
}

/**
 * Get stored content hash from component's plugin data
 *
 * Retrieves the SHA-256 hash of the SVG content that was used to create
 * the component. This hash is used for change detection to determine if
 * a component needs to be updated when the source SVG changes.
 *
 * **Use Case**: Incremental updates
 * - Compare stored hash with new content hash
 * - Only update if hashes differ
 * - Avoids unnecessary component updates
 *
 * @param {ComponentNode} component - Component to get hash from
 * @returns {string | null} Stored hash or null if not found
 *
 * @example
 * ```typescript
 * const component = figma.getNodeById('...') as ComponentNode;
 * const storedHash = getStoredHash(component);
 *
 * if (storedHash) {
 *   console.log(`Component created from hash: ${storedHash.substring(0, 8)}`);
 * } else {
 *   console.log('No hash stored (old component)');
 * }
 * ```
 */
export function getStoredHash(component: ComponentNode): string | null {
  try {
    return component.getPluginData(PLUGIN_DATA_KEYS.SVG_HASH) || null;
  } catch {
    return null;
  }
}

/**
 * Store content hash in component's plugin data
 *
 * Stores the SHA-256 hash of the component's SVG content in plugin data.
 * This enables change detection for future updates by comparing the stored
 * hash with the hash of new content.
 *
 * **Storage Key**: `SVG_HASH` plugin data key
 * **Hash Algorithm**: SHA-256 of SVG content
 *
 * @param {ComponentNode} component - Component to store hash in
 * @param {string} hash - Content hash to store
 *
 * @example
 * ```typescript
 * import { hashSvg } from '@lib/utils';
 *
 * const component = figma.createComponent();
 * const svgContent = '<svg>...</svg>';
 * const hash = hashSvg(svgContent);
 *
 * setStoredHash(component, hash);
 * // Hash now stored in plugin data
 * ```
 */
export function setStoredHash(component: ComponentNode, hash: string): void {
  try {
    component.setPluginData(PLUGIN_DATA_KEYS.SVG_HASH, hash);
  } catch (error: unknown) {
    logger.warn(`Failed to store hash for ${component.name}:`, error);
  }
}

/**
 * Create a single variant component from SVG content
 *
 * Converts SVG content into a Figma ComponentNode with proper sizing,
 * naming, and content structure. The component is created with vectors
 * directly as children (no nested frames).
 *
 * **Creation Process**:
 * 1. Parse SVG using `figma.createNodeFromSvg()` → FrameNode
 * 2. Create empty ComponentNode
 * 3. Set name using variant formatter
 * 4. Resize to optical size (20, 24, 40, or 48px)
 * 5. Move all vector children from Frame to Component
 * 6. Remove the temporary Frame
 * 7. Store content hash for change detection
 *
 * **Error Handling**:
 * - Returns null if SVG parsing fails
 * - Logs warnings for individual child move failures
 * - Logs errors with variant details for debugging
 *
 * @param {VariantData} variantData - Variant properties and SVG content
 * @returns {Promise<ComponentNode | null>} Created component or null if failed
 *
 * @example Create component
 * ```typescript
 * const component = await createVariantComponent({
 *   iconName: 'home',
 *   style: 'rounded',
 *   variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   svgContent: '<svg width="24" height="24">...</svg>'
 * });
 *
 * if (component) {
 *   console.log(`Created: ${component.name}`);
 *   console.log(`Size: ${component.width}x${component.height}`);
 * }
 * ```
 *
 * @example Error handling
 * ```typescript
 * const component = await createVariantComponent(variantData);
 *
 * if (!component) {
 *   console.error('Failed to create component - invalid SVG?');
 *   // Handle failure (skip, retry, etc.)
 * }
 * ```
 */
export async function createVariantComponent(
  variantData: VariantData
): Promise<ComponentNode | null> {
  try {
    // Create SVG node first - this creates a Frame with the vector inside
    if ('createNodeFromSvg' in figma) {
      const svgFrame = (figma as FigmaExtended).createNodeFromSvg(variantData.svgContent);
      if (svgFrame && svgFrame.type === 'FRAME') {
        // Convert the Frame to a Component
        const component = figma.createComponent();
        component.name = getVariantName(variantData);

        // Size to optical size
        const size = variantData.variant.opticalSize;
        component.resize(size, size);
        component.fills = [];

        // Move the vector content from the frame to the component
        // This avoids the extra frame nesting
        // Use a safer approach by collecting children first
        const children = [...svgFrame.children];
        for (const child of children) {
          try {
            component.appendChild(child);
          } catch (error) {
            logger.warn(`Failed to move child node: ${error}`);
          }
        }

        // Remove the now-empty frame
        svgFrame.remove();

        // Store the content hash for future comparison
        const hash = hashSvg(variantData.svgContent);
        setStoredHash(component, hash);

        // Clean up any unnecessary fills from the component frame
        cleanupVariantFills(component);

        return component;
      }
    }

    logger.error(`Failed to create SVG for variant: ${getVariantName(variantData)}`);
    return null;
  } catch (error) {
    logger.error(`Failed to create variant: ${getVariantName(variantData)}`, error);
    return null;
  }
}

/**
 * Update an existing variant component with new SVG content
 *
 * Replaces all content in an existing ComponentNode with new vector content
 * from SVG. This is used for incremental updates when the source SVG changes
 * but the component already exists.
 *
 * **Update Process**:
 * 1. Remove all existing children from component
 * 2. Parse new SVG using `figma.createNodeFromSvg()` → FrameNode
 * 3. Resize component to match optical size
 * 4. Move all vector children from Frame to Component
 * 5. Remove the temporary Frame
 * 6. Store new content hash
 *
 * **Important**: This preserves the component's:
 * - Node ID (references remain valid)
 * - Name and variant properties
 * - Position in component set
 * - Variable bindings (unless explicitly changed)
 *
 * @param {ComponentNode} component - Existing component to update
 * @param {VariantData} variantData - New variant properties and SVG content
 * @returns {Promise<void>}
 *
 * @example Update component content
 * ```typescript
 * const component = figma.getNodeById('...') as ComponentNode;
 * await updateVariantComponent(component, {
 *   iconName: 'home',
 *   style: 'rounded',
 *   variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
 *   svgContent: '<svg>...new content...</svg>'
 * });
 * // Component now shows new content
 * ```
 *
 * @example Conditional update based on hash
 * ```typescript
 * const storedHash = getStoredHash(component);
 * const newHash = hashSvg(newSvgContent);
 *
 * if (storedHash !== newHash) {
 *   await updateVariantComponent(component, variantData);
 *   console.log('Updated component with new content');
 * } else {
 *   console.log('Content unchanged, skipping update');
 * }
 * ```
 */
export async function updateVariantComponent(
  component: ComponentNode,
  variantData: VariantData
): Promise<void> {
  // Remove existing content
  for (const child of [...component.children]) {
    child.remove();
  }

  // Add new SVG content
  const size = variantData.variant.opticalSize;
  component.resize(size, size);

  if ('createNodeFromSvg' in figma) {
    const svgFrame = (figma as FigmaExtended).createNodeFromSvg(variantData.svgContent);
    if (svgFrame && svgFrame.type === 'FRAME') {
      // Move the vector content from the frame to the component
      // This avoids the extra frame nesting
      // Use a safer approach by collecting children first
      const children = [...svgFrame.children];
      for (const child of children) {
        try {
          component.appendChild(child);
        } catch (error) {
          logger.warn(`Failed to move child node during update: ${error}`);
        }
      }

      // Remove the now-empty frame
      svgFrame.remove();

      // Store the new content hash
      const hash = hashSvg(variantData.svgContent);
      setStoredHash(component, hash);

      // Clean up any unnecessary fills from the component frame
      cleanupVariantFills(component);
    }
  }
}
