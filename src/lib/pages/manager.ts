/**
 * @module @figma/pages/manager
 *
 * Page management utilities for organizing generated icons in Figma.
 *
 * Handles creation, organization, and management of Figma pages for
 * different icon categories, ensuring clean separation and preventing
 * duplicate pages.
 *
 * @example
 * ```typescript
 * import { PageManager } from '@figma/pages/manager';
 *
 * const manager = new PageManager();
 * const page = await manager.getOrCreatePage('Navigation Icons');
 * await manager.switchToPage(page);
 * ```
 */

import { logger } from '@lib/utils';
import { FigmaPluginError } from '@lib/utils/errors';

/**
 * Configuration for page creation
 */
export interface PageConfig {
  /** Name of the page */
  name: string;
  /** Optional prefix for generated pages */
  prefix?: string;
  /** Whether to switch to the page after creation */
  autoSwitch?: boolean;
  /** Whether to clean existing content */
  cleanExisting?: boolean;
}

/**
 * Manages Figma pages for icon organization.
 *
 * @category Core
 */
export class PageManager {
  private readonly pagePrefix: string;

  /**
   * Creates a new PageManager instance
   * @param prefix - Prefix for generated pages (default: none)
   */
  constructor(prefix = '') {
    this.pagePrefix = prefix;
  }

  /**
   * Gets or creates a page with the specified name.
   *
   * @param name - Name of the page (prefix is applied if set in constructor)
   * @param config - Additional configuration options
   * @returns The page node
   *
   * @example
   * ```typescript
   * const page = await manager.getOrCreatePage('Cat 1: Navigation');
   * // Creates or finds "Cat 1: Navigation" page
   * ```
   */
  async getOrCreatePage(name: string, config: Partial<PageConfig> = {}): Promise<PageNode> {
    const fullName = this.getFullPageName(name);
    logger.info(`Looking for page: ${fullName}`);

    // Check if page already exists
    const existingPage = this.findPage(fullName);
    if (existingPage) {
      logger.info(`Found existing page: ${fullName}`);

      if (config.cleanExisting) {
        await this.cleanPage(existingPage);
      }

      if (config.autoSwitch) {
        await this.switchToPage(existingPage);
      }

      return existingPage;
    }

    // Create new page
    logger.info(`Creating new page: ${fullName}`);
    const newPage = figma.createPage();
    newPage.name = fullName;

    // Set page background color to #CDD2DE
    newPage.backgrounds = [
      {
        type: 'SOLID',
        color: { r: 0.804, g: 0.824, b: 0.871 }, // #CDD2DE
      },
    ];
    logger.info('Applied page background color: #CDD2DE');

    // Always switch to a newly created page to ensure it's active
    await this.switchToPage(newPage);

    // Extra wait after creating a new page to ensure it's fully ready
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify the page is actually current
    if (figma.currentPage !== newPage) {
      logger.warn(`Page switch may have failed, retrying...`);
      figma.currentPage = newPage;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    logger.notify(`Created page: ${fullName}`);
    return newPage;
  }

  /**
   * Finds a page by name.
   *
   * @param name - Full name of the page to find
   * @returns Page node if found, null otherwise
   */
  findPage(name: string): PageNode | null {
    return figma.root.children.find(
      (page) => page.type === 'PAGE' && page.name === name
    ) as PageNode | null;
  }

  /**
   * Gets all pages matching the prefix.
   *
   * @returns Array of matching pages
   */
  getAllIconPages(): PageNode[] {
    return figma.root.children.filter(
      (page) => page.type === 'PAGE' && page.name.startsWith(this.pagePrefix)
    ) as PageNode[];
  }

  /**
   * Switches to the specified page.
   *
   * @param page - Page to switch to
   */
  async switchToPage(page: PageNode): Promise<void> {
    figma.currentPage = page;
    // Wait a frame for the page switch to complete
    await new Promise((resolve) => setTimeout(resolve, 0));
    logger.info(`Switched to page: ${page.name}`);
  }

  /**
   * Cleans all content from a page.
   *
   * @param page - Page to clean
   * @param preserveComponents - Whether to preserve component sets
   */
  async cleanPage(page: PageNode, preserveComponents = false): Promise<void> {
    logger.info(`Cleaning page: ${page.name}`);

    const nodesToRemove: SceneNode[] = [];

    for (const child of page.children) {
      if (preserveComponents && child.type === 'COMPONENT_SET') {
        continue;
      }
      nodesToRemove.push(child);
    }

    for (const node of nodesToRemove) {
      node.remove();
    }

    logger.info(`Removed ${nodesToRemove.length} nodes from ${page.name}`);
  }

  /**
   * Deletes a page if it exists.
   *
   * @param name - Name of the page (without prefix)
   * @returns True if page was deleted
   */
  async deletePage(name: string): Promise<boolean> {
    const fullName = this.getFullPageName(name);
    const page = this.findPage(fullName);

    if (page && page !== figma.currentPage) {
      // Can't delete current page
      if (figma.currentPage === page) {
        throw new FigmaPluginError('Cannot delete current page', 'PAGE_DELETE_ERROR', {
          pageName: fullName,
        });
      }

      page.remove();
      logger.info(`Deleted page: ${fullName}`);
      return true;
    }

    return false;
  }

  /**
   * Gets the full page name with prefix.
   *
   * @param name - Base name
   * @returns Full name with prefix
   */
  private getFullPageName(name: string): string {
    // If already has prefix, return as-is
    if (name.startsWith(this.pagePrefix)) {
      return name;
    }
    return `${this.pagePrefix}${name}`;
  }

  /**
   * Gets page statistics.
   *
   * @param page - Page to analyze
   * @returns Statistics about the page content
   */
  getPageStats(page: PageNode): {
    totalNodes: number;
    componentSets: number;
    components: number;
    frames: number;
  } {
    let componentSets = 0;
    let components = 0;
    let frames = 0;

    function traverse(node: SceneNode) {
      if (node.type === 'COMPONENT_SET') componentSets++;
      else if (node.type === 'COMPONENT') components++;
      else if (node.type === 'FRAME') frames++;

      if ('children' in node) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }

    for (const child of page.children) {
      traverse(child);
    }

    return {
      totalNodes: page.children.length,
      componentSets,
      components,
      frames,
    };
  }
}

/**
 * Default page manager instance
 */
export const pageManager = new PageManager();
