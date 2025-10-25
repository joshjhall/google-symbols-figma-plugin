/**
 * Page organization handler
 *
 * Organizes icon component sets into styled frames with Material Design styling.
 * Features:
 * - Auto layout with wrapping
 * - Design token integration (M3 variables)
 * - Alphabetical sorting
 * - Idempotent frame management
 */

import { logger } from '@lib/utils';

/**
 * Organize page components into a styled frame with Material Design styling
 *
 * This function creates or reuses a frame on the page and moves all ComponentSet nodes
 * into it with proper styling, auto-layout, and alphabetical sorting. The operation is
 * idempotent - can be run multiple times safely.
 *
 * Features:
 * - Auto-layout with horizontal wrapping
 * - Material Design 3 color tokens (surface background, outline border)
 * - Alphabetical component sorting
 * - Reuses existing frame if present
 * - Proper spacing and padding
 *
 * @param {PageNode} page - The Figma page containing components to organize
 * @param {string} frameName - Name for the container frame (e.g., "Set 1: Icons")
 * @returns {Promise<void>} Resolves when organization is complete
 * @throws {Error} If frame creation or styling fails
 *
 * @example
 * ```typescript
 * await organizePageIntoFrame(page, 'Category Frame');
 * // All ComponentSet nodes now organized in a styled frame
 * ```
 */
export async function organizePageIntoFrame(page: PageNode, frameName: string): Promise<void> {
  try {
    logger.info(`Organizing page "${page.name}" into frame...`);

    // Check if frame already exists
    const existingFrame = page.findChild(
      (node) => node.type === 'FRAME' && node.name === frameName
    ) as FrameNode | null;

    // Collect ALL component sets that should be in this frame:
    // 1. Any already in the existing frame
    // 2. Any on the page (newly created this run)
    const componentSetsInFrame = existingFrame
      ? (existingFrame.findAll((node) => node.type === 'COMPONENT_SET') as ComponentSetNode[])
      : [];

    const componentSetsOnPage = page.findAll(
      (node) => node.type === 'COMPONENT_SET' && node.parent === page
    ) as ComponentSetNode[];

    const allComponentSets = [...componentSetsInFrame, ...componentSetsOnPage];

    if (allComponentSets.length === 0) {
      logger.info('No component sets found to organize');
      return;
    }

    logger.info(
      `Found ${allComponentSets.length} component sets to organize (${componentSetsInFrame.length} in frame, ${componentSetsOnPage.length} on page)`
    );

    // Reuse existing frame or create new one
    const frame = existingFrame || figma.createFrame();
    if (!existingFrame) {
      frame.name = frameName;
      frame.x = 0;
      frame.y = 0;
      frame.resize(2024, 100); // Width 2024, height will be set to HUG by layoutMode
    }

    // Configure auto layout
    frame.layoutMode = 'HORIZONTAL';
    frame.layoutWrap = 'WRAP';
    frame.primaryAxisSizingMode = 'FIXED'; // Width: fixed at 2024
    frame.counterAxisSizingMode = 'AUTO'; // Height: hug contents
    frame.primaryAxisAlignItems = 'MIN'; // Top align
    frame.counterAxisAlignItems = 'MIN'; // Left align

    // Apply spacing (hardcoded for portability)
    frame.itemSpacing = 24; // Horizontal gap between items
    frame.counterAxisSpacing = 24; // Vertical gap between rows
    frame.paddingLeft = 24;
    frame.paddingRight = 24;
    frame.paddingTop = 24;
    frame.paddingBottom = 24;
    logger.info('Applied spacing values: 24px');

    // Apply corner radius (hardcoded)
    frame.cornerRadius = 12;
    logger.info('Applied corner radius: 12px');

    // Apply fill color #F2F2F2 (hardcoded)
    frame.fills = [
      {
        type: 'SOLID',
        color: { r: 0.949, g: 0.949, b: 0.949 }, // #F2F2F2
      },
    ];
    logger.info('Applied fill color: #F2F2F2');

    // Sort component sets alphabetically by name
    const sortedComponentSets = [...allComponentSets].sort((a, b) => a.name.localeCompare(b.name));

    logger.info('Sorted component sets alphabetically');

    // Move all component sets into the frame (idempotent - works whether they're already in frame or on page)
    for (const componentSet of sortedComponentSets) {
      frame.appendChild(componentSet);
    }

    logger.info(`Moved ${sortedComponentSets.length} component sets into frame`);

    // Add frame to page if it's new
    if (!existingFrame) {
      page.appendChild(frame);
      // Move frame to top of layer order
      page.insertChild(0, frame);
      logger.info('Added new frame to page');
    } else {
      logger.info('Updated existing frame');
    }

    logger.info(`✅ Successfully organized page into frame "${frameName}"`);
  } catch (error) {
    logger.error('Error organizing page into frame:', error);
    throw error;
  }
}
