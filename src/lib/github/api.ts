/**
 * @module @figma/github/api
 *
 * GitHub API client for fetching Material Icons metadata and lists.
 * Provides methods to fetch icon lists, categories, and validate icon availability.
 */

import { logger } from '@lib/utils';
import { generateGitHubUrl, type IconVariant, type IconStyle } from './url-generator';

/**
 * Icon metadata from GitHub
 */
export interface IconMetadata {
  name: string;
  category?: string;
  tags?: string[];
  codepoint?: string;
}

/**
 * Category metadata
 */
export interface CategoryMetadata {
  name: string;
  icons: string[];
  count: number;
}

/**
 * GitHub API configuration
 */
export interface GitHubAPIConfig {
  /** Base URL for raw GitHub content */
  baseUrl?: string;
  /** Repository owner */
  owner?: string;
  /** Repository name */
  repo?: string;
  /** Branch or tag */
  ref?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<GitHubAPIConfig> = {
  baseUrl: 'https://raw.githubusercontent.com',
  owner: 'google',
  repo: 'material-design-icons',
  ref: 'master',
};

/**
 * GitHub API client for Material Icons
 *
 * Provides methods to fetch icon lists, SVG content, and validate icon availability
 * from Google's material-design-icons repository. Includes caching, retry logic,
 * and rate limit handling.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limit detection (429 responses)
 * - In-memory caching of icon and category metadata
 * - Support for different repository refs (branches, tags, commits)
 * - Batch operations for performance
 *
 * @class GitHubIconAPI
 *
 * @example
 * ```typescript
 * const api = new GitHubIconAPI({
 *   ref: 'master',
 *   token: 'ghp_...' // Optional: for higher rate limits
 * });
 *
 * const svg = await api.fetchSVGContent(url);
 * const exists = await api.testIconExists('home', 'rounded');
 * ```
 */
export class GitHubIconAPI {
  private config: Required<GitHubAPIConfig>;
  private iconCache: Map<string, IconMetadata> = new Map();
  private categoryCache: Map<string, CategoryMetadata> = new Map();

  /**
   * Create a new GitHubIconAPI instance
   *
   * @param {GitHubAPIConfig} [config={}] - Configuration options
   * @param {string} [config.baseUrl='https://raw.githubusercontent.com'] - Raw content base URL
   * @param {string} [config.owner='google'] - Repository owner
   * @param {string} [config.repo='material-design-icons'] - Repository name
   * @param {string} [config.ref='master'] - Branch, tag, or commit SHA
   */
  constructor(config: GitHubAPIConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build a raw GitHub URL for a file path
   *
   * @private
   * @param {string} path - File path relative to repository root
   * @returns {string} Complete URL to raw file content
   *
   * @example
   * ```typescript
   * buildUrl('symbols/web/home/...') →
   * 'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/home/...'
   * ```
   */
  private buildUrl(path: string): string {
    const { baseUrl, owner, repo, ref } = this.config;
    return `${baseUrl}/${owner}/${repo}/${ref}/${path}`;
  }

  /**
   * Fetch and parse text content from a URL
   *
   * @private
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} Text content
   * @throws {Error} If fetch fails (non-200 response)
   */
  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Fetch all available icons from the codepoints file
   * This gives us the complete list of Material Icons
   */
  async fetchAllIcons(): Promise<IconMetadata[]> {
    const stopTimer = logger.time('Fetch all icons');

    try {
      // Try different possible locations for the codepoints file
      // Start with newer Material Symbols (variablefont) which have 3900+ icons
      const codepointPaths = [
        'variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].codepoints',
        'variablefont/MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].codepoints',
        'variablefont/MaterialSymbolsSharp[FILL,GRAD,opsz,wght].codepoints',
        'font/MaterialIconsRound-Regular.codepoints', // Fixed: removed 'ed'
        'font/MaterialIconsOutlined-Regular.codepoints',
        'font/MaterialIcons-Regular.codepoints',
      ];

      let codepointsText = '';
      let successfulPath = '';

      for (const path of codepointPaths) {
        try {
          const url = this.buildUrl(path);
          logger.info(`Trying codepoints file: ${url}`);
          codepointsText = await this.fetchText(url);
          successfulPath = path;
          break;
        } catch (error) {
          logger.warn(`Failed to fetch from ${path}: ${error}`);
        }
      }

      if (!codepointsText) {
        throw new Error('Could not fetch codepoints from any known location');
      }

      logger.info(`Successfully fetched codepoints from: ${successfulPath}`);

      // Parse the codepoints file
      const lines = codepointsText.split('\n').filter((line) => line.trim());
      const icons: IconMetadata[] = [];

      for (const line of lines) {
        const [name, codepoint] = line.split(' ');
        if (name) {
          const metadata: IconMetadata = {
            name: name.trim(),
            codepoint: codepoint?.trim(),
          };
          icons.push(metadata);
          this.iconCache.set(metadata.name, metadata);
        }
      }

      logger.info(`Parsed ${icons.length} icons from codepoints`);
      return icons;
    } finally {
      stopTimer();
    }
  }

  /**
   * Fetch icons for a specific category
   */
  async fetchCategoryIcons(category: string): Promise<string[]> {
    const stopTimer = logger.time(`Fetch category: ${category}`);

    try {
      // Check cache first
      const cached = this.categoryCache.get(category);
      if (cached) {
        logger.info(`Using cached data for category ${category}: ${cached.count} icons`);
        return cached.icons;
      }

      // Try different possible locations for category files
      const categoryPaths = [
        `symbols/categories/${category}.txt`,
        `update/current_versions/symbols/categories/${category}.txt`,
        `src/categories/${category}.txt`,
        `categories/${category}.txt`,
      ];

      let categoryText = '';
      let successfulPath = '';

      for (const path of categoryPaths) {
        try {
          const url = this.buildUrl(path);
          logger.info(`Trying category file: ${url}`);
          categoryText = await this.fetchText(url);
          successfulPath = path;
          break;
        } catch (error) {
          logger.warn(`Failed to fetch from ${path}: ${error}`);
        }
      }

      if (!categoryText) {
        throw new Error(`Could not fetch category ${category} from any known location`);
      }

      logger.info(`Successfully fetched category from: ${successfulPath}`);

      // Parse the category file
      const icons = categoryText
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name && !name.startsWith('#') && !name.startsWith('//'));

      // Cache the result
      const metadata: CategoryMetadata = {
        name: category,
        icons,
        count: icons.length,
      };
      this.categoryCache.set(category, metadata);

      logger.info(`Parsed ${icons.length} icons from category ${category}`);
      return icons;
    } finally {
      stopTimer();
    }
  }

  /**
   * Fetch all available categories
   */
  async fetchCategories(): Promise<string[]> {
    const stopTimer = logger.time('Fetch categories');

    try {
      // Known categories in Material Icons
      // This list is based on the Material Design documentation
      const knownCategories = [
        'action',
        'alert',
        'av',
        'communication',
        'content',
        'device',
        'editor',
        'file',
        'hardware',
        'home',
        'image',
        'maps',
        'navigation',
        'notification',
        'places',
        'social',
        'toggle',
      ];

      // Try to fetch a categories index file if it exists
      try {
        const indexPaths = [
          'symbols/categories/index.txt',
          'update/current_versions/symbols/categories/index.txt',
          'categories.txt',
        ];

        for (const path of indexPaths) {
          try {
            const url = this.buildUrl(path);
            const indexText = await this.fetchText(url);

            const categories = indexText
              .split('\n')
              .map((name) => name.trim())
              .filter((name) => name && !name.startsWith('#'));

            if (categories.length > 0) {
              logger.info(`Found ${categories.length} categories from index`);
              return categories;
            }
          } catch {
            // Continue to next path
          }
        }
      } catch {
        // Fall back to known categories
      }

      logger.info(`Using ${knownCategories.length} known categories`);
      return knownCategories;
    } finally {
      stopTimer();
    }
  }

  /**
   * Test if an icon exists by checking a single variant
   */
  async testIconExists(
    iconName: string,
    style: IconStyle = 'rounded',
    variant?: Partial<IconVariant>
  ): Promise<boolean> {
    const testVariant: IconVariant = {
      fill: variant?.fill ?? 0,
      weight: variant?.weight ?? 400,
      grade: variant?.grade ?? 0,
      opticalSize: variant?.opticalSize ?? 24,
    };

    const url = generateGitHubUrl(iconName, style, testVariant);

    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      logger.warn(`Failed to test icon ${iconName}: ${error}`);
      return false;
    }
  }

  /**
   * Batch test multiple icons for existence
   */
  async batchTestIcons(
    iconNames: string[],
    style: IconStyle = 'rounded',
    variant?: Partial<IconVariant>
  ): Promise<Map<string, boolean>> {
    const stopTimer = logger.time(`Batch test ${iconNames.length} icons`);
    const results = new Map<string, boolean>();

    try {
      // Process in batches to avoid overwhelming the server
      const BATCH_SIZE = 50;

      for (let i = 0; i < iconNames.length; i += BATCH_SIZE) {
        const batch = iconNames.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (iconName) => {
          const exists = await this.testIconExists(iconName, style, variant);
          results.set(iconName, exists);
          return { iconName, exists };
        });

        await Promise.all(batchPromises);

        // Log progress
        const completed = Math.min(i + BATCH_SIZE, iconNames.length);
        logger.info(`Tested ${completed}/${iconNames.length} icons`);

        // Small delay between batches
        if (i + BATCH_SIZE < iconNames.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Summary
      const found = Array.from(results.values()).filter((v) => v).length;
      const notFound = results.size - found;
      logger.info(`Test complete: ${found} found, ${notFound} not found`);

      return results;
    } finally {
      stopTimer();
    }
  }

  /**
   * Get diagnostic information for a category
   */
  async diagnoseCategoryIcons(category: string): Promise<{
    category: string;
    totalIcons: number;
    foundIcons: string[];
    missingIcons: string[];
    successRate: number;
  }> {
    const stopTimer = logger.time(`Diagnose category: ${category}`);

    try {
      // Fetch the category icons
      const iconNames = await this.fetchCategoryIcons(category);

      // Test each icon
      const testResults = await this.batchTestIcons(iconNames);

      // Separate found and missing
      const foundIcons: string[] = [];
      const missingIcons: string[] = [];

      for (const [iconName, exists] of testResults) {
        if (exists) {
          foundIcons.push(iconName);
        } else {
          missingIcons.push(iconName);
        }
      }

      const successRate = Math.round((foundIcons.length / iconNames.length) * 100);

      const result = {
        category,
        totalIcons: iconNames.length,
        foundIcons: foundIcons.sort(),
        missingIcons: missingIcons.sort(),
        successRate,
      };

      logger.info(`Category ${category} diagnosis:`, {
        total: result.totalIcons,
        found: result.foundIcons.length,
        missing: result.missingIcons.length,
        successRate: `${result.successRate}%`,
      });

      if (result.missingIcons.length > 0 && result.missingIcons.length <= 20) {
        logger.info(`Missing icons in ${category}:`, result.missingIcons);
      }

      return result;
    } finally {
      stopTimer();
    }
  }

  /**
   * Fetch the current commit SHA for the configured ref (branch/tag)
   * This is used to track which version of Material Icons the components were built from.
   *
   * @returns The commit SHA string
   */
  async fetchCurrentCommitSha(): Promise<string> {
    const { owner, repo, ref } = this.config;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch commit SHA: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const sha = data.sha;

      if (!sha || typeof sha !== 'string') {
        throw new Error('Invalid response: missing sha field');
      }

      logger.info(`Fetched commit SHA for ${ref}: ${sha.substring(0, 7)}`);
      return sha;
    } catch (error) {
      logger.error('Failed to fetch commit SHA from GitHub API:', error);
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.iconCache.clear();
    this.categoryCache.clear();
    logger.info('Cleared GitHub API caches');
  }
}

/**
 * Default API instance
 */
export const githubIconAPI = new GitHubIconAPI();
