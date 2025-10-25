/**
 * @module @figma/github/__tests__/api
 *
 * Unit tests for GitHub API client with mocked fetch.
 * Tests icon fetching, caching, error handling, and batch operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitHubIconAPI } from '../api';

// Mock logger
vi.mock('@lib/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    time: vi.fn(() => vi.fn()),
  },
}));

describe('GitHubIconAPI', () => {
  let api: GitHubIconAPI;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create fresh API instance
    api = new GitHubIconAPI();

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const instance = new GitHubIconAPI();

      expect(instance).toBeInstanceOf(GitHubIconAPI);
    });

    it('should accept custom config', () => {
      const instance = new GitHubIconAPI({
        owner: 'custom-owner',
        repo: 'custom-repo',
        ref: 'custom-ref',
      });

      expect(instance).toBeInstanceOf(GitHubIconAPI);
    });

    it('should merge custom config with defaults', () => {
      const instance = new GitHubIconAPI({
        ref: '4.0.0',
      });

      expect(instance).toBeInstanceOf(GitHubIconAPI);
    });
  });

  describe('fetchAllIcons', () => {
    it('should fetch icons from codepoints file', async () => {
      const codepointsContent = `
home e88a
search e8b6
star e838
`.trim();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => codepointsContent,
      });

      const icons = await api.fetchAllIcons();

      expect(icons).toHaveLength(3);
      expect(icons[0]).toEqual({
        name: 'home',
        codepoint: 'e88a',
      });
      expect(icons[1]).toEqual({
        name: 'search',
        codepoint: 'e8b6',
      });
    });

    it('should try fallback paths if first fails', async () => {
      // First two calls fail, third succeeds
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'home e88a\n',
        });

      const icons = await api.fetchAllIcons();

      expect(icons).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should throw if all paths fail', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      await expect(api.fetchAllIcons()).rejects.toThrow(
        'Could not fetch codepoints from any known location'
      );
    });

    it('should handle empty lines', async () => {
      const codepointsContent = `
home e88a

search e8b6

star e838
`.trim();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => codepointsContent,
      });

      const icons = await api.fetchAllIcons();

      expect(icons).toHaveLength(3);
    });

    it('should handle lines without codepoints', async () => {
      const codepointsContent = `home e88a\nsearch\nstar e838`;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => codepointsContent,
      });

      const icons = await api.fetchAllIcons();

      expect(icons).toHaveLength(3);
      expect(icons[1]).toEqual({
        name: 'search',
        codepoint: undefined,
      });
    });

    it('should cache individual icons in iconCache', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home e88a\nsearch e8b6\n',
      });

      const icons = await api.fetchAllIcons();

      // The method populates iconCache with individual icons
      // We can't directly test the cache, but we can verify the icons were returned
      expect(icons).toHaveLength(2);
    });
  });

  describe('fetchCategoryIcons', () => {
    it('should fetch icons for a category', async () => {
      const categoryContent = `home\nsearch\nstar\nfavorite`;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => categoryContent,
      });

      const icons = await api.fetchCategoryIcons('action');

      expect(icons).toEqual(['home', 'search', 'star', 'favorite']);
    });

    it('should filter out comments', async () => {
      const categoryContent = `# This is a comment\nhome\n// Another comment\nsearch\nstar`;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => categoryContent,
      });

      const icons = await api.fetchCategoryIcons('action');

      expect(icons).toEqual(['home', 'search', 'star']);
    });

    it('should filter out empty lines', async () => {
      const categoryContent = `home\n\nsearch\n  \nstar`;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => categoryContent,
      });

      const icons = await api.fetchCategoryIcons('action');

      expect(icons).toEqual(['home', 'search', 'star']);
    });

    it('should cache category results', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home\nsearch',
      });

      const icons1 = await api.fetchCategoryIcons('action');
      const icons2 = await api.fetchCategoryIcons('action');

      expect(icons1).toEqual(icons2);
      expect(fetchMock).toHaveBeenCalledTimes(1); // Only fetched once
    });

    it('should try fallback paths', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'home\n',
        });

      const icons = await api.fetchCategoryIcons('action');

      expect(icons).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should throw if all paths fail', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      await expect(api.fetchCategoryIcons('action')).rejects.toThrow(
        'Could not fetch category action from any known location'
      );
    });
  });

  describe('fetchCategories', () => {
    it('should return known categories by default', async () => {
      // No index file found, falls back to known categories
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      const categories = await api.fetchCategories();

      expect(categories).toContain('action');
      expect(categories).toContain('communication');
      expect(categories).toContain('navigation');
      expect(categories.length).toBeGreaterThan(10);
    });

    it('should fetch from index file if available', async () => {
      const indexContent = `action\nnavigation\nplaces\neditor`;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => indexContent,
      });

      const categories = await api.fetchCategories();

      expect(categories).toEqual(['action', 'navigation', 'places', 'editor']);
    });

    it('should try multiple index paths', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
        ok: true,
        text: async () => 'action\nplaces',
      });

      const categories = await api.fetchCategories();

      expect(categories).toEqual(['action', 'places']);
    });

    it('should filter out comments from index', async () => {
      const indexContent = `# Categories\naction\n# Another comment\nnavigation`;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => indexContent,
      });

      const categories = await api.fetchCategories();

      expect(categories).toEqual(['action', 'navigation']);
    });
  });

  describe('testIconExists', () => {
    it('should return true if icon exists', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
      });

      const exists = await api.testIconExists('home', 'rounded');

      expect(exists).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { method: 'HEAD' });
    });

    it('should return false if icon not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const exists = await api.testIconExists('nonexistent', 'rounded');

      expect(exists).toBe(false);
    });

    it('should return false on fetch error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const exists = await api.testIconExists('home', 'rounded');

      expect(exists).toBe(false);
    });

    it('should use default variant if not specified', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      await api.testIconExists('home', 'rounded');

      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('home_24px.svg');
    });

    it('should use provided variant', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      await api.testIconExists('home', 'rounded', {
        fill: 1,
        weight: 700,
        grade: 200,
        opticalSize: 48,
      });

      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('wght700grad200fill1_48px.svg');
    });

    it('should test with different styles', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await api.testIconExists('home', 'outlined');
      const url = fetchMock.mock.calls[0][0];

      expect(url).toContain('materialsymbolsoutlined');
    });
  });

  describe('batchTestIcons', () => {
    it('should test multiple icons', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const results = await api.batchTestIcons(['home', 'search', 'star'], 'rounded');

      expect(results.size).toBe(3);
      expect(results.get('home')).toBe(true);
      expect(results.get('search')).toBe(true);
      expect(results.get('star')).toBe(true);
    });

    it('should handle mix of existing and missing icons', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true }) // home exists
        .mockResolvedValueOnce({ ok: false }) // search missing
        .mockResolvedValueOnce({ ok: true }); // star exists

      const results = await api.batchTestIcons(['home', 'search', 'star'], 'rounded');

      expect(results.get('home')).toBe(true);
      expect(results.get('search')).toBe(false);
      expect(results.get('star')).toBe(true);
    });

    it('should process in batches of 50', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const icons = Array.from({ length: 120 }, (_, i) => `icon${i}`);
      await api.batchTestIcons(icons, 'rounded');

      // Should have called fetch 120 times (all icons tested)
      expect(fetchMock).toHaveBeenCalledTimes(120);
    });

    it('should handle empty array', async () => {
      const results = await api.batchTestIcons([], 'rounded');

      expect(results.size).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should use provided variant', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await api.batchTestIcons(['home'], 'rounded', { fill: 1 });

      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('fill1');
    });
  });

  describe('diagnoseCategoryIcons', () => {
    it('should diagnose category with all icons found', async () => {
      // Mock fetchCategoryIcons
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home\nsearch\nstar',
      });

      // Mock testIconExists for each icon
      fetchMock
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });

      const diagnosis = await api.diagnoseCategoryIcons('action');

      expect(diagnosis.category).toBe('action');
      expect(diagnosis.totalIcons).toBe(3);
      expect(diagnosis.foundIcons).toEqual(['home', 'search', 'star']);
      expect(diagnosis.missingIcons).toEqual([]);
      expect(diagnosis.successRate).toBe(100);
    });

    it('should diagnose category with some icons missing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home\nsearch\nstar',
      });

      fetchMock
        .mockResolvedValueOnce({ ok: true }) // home found
        .mockResolvedValueOnce({ ok: false }) // search missing
        .mockResolvedValueOnce({ ok: true }); // star found

      const diagnosis = await api.diagnoseCategoryIcons('action');

      expect(diagnosis.foundIcons).toEqual(['home', 'star']);
      expect(diagnosis.missingIcons).toEqual(['search']);
      expect(diagnosis.successRate).toBe(67); // 2/3 * 100 = 66.66... rounded to 67
    });

    it('should sort found and missing icons', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'zebra\napple\nmango\nbanana',
      });

      fetchMock
        .mockResolvedValueOnce({ ok: true }) // zebra
        .mockResolvedValueOnce({ ok: false }) // apple
        .mockResolvedValueOnce({ ok: true }) // mango
        .mockResolvedValueOnce({ ok: false }); // banana

      const diagnosis = await api.diagnoseCategoryIcons('test');

      expect(diagnosis.foundIcons).toEqual(['mango', 'zebra']); // Sorted
      expect(diagnosis.missingIcons).toEqual(['apple', 'banana']); // Sorted
    });
  });

  describe('fetchCurrentCommitSha', () => {
    it('should fetch commit SHA from GitHub API', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: 'abc123def456',
        }),
      });

      const sha = await api.fetchCurrentCommitSha();

      expect(sha).toBe('abc123def456');
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.github.com/repos'));
    });

    it('should use configured ref', async () => {
      const customApi = new GitHubIconAPI({ ref: '4.0.0' });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'xyz789' }),
      });

      await customApi.fetchCurrentCommitSha();

      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('/commits/4.0.0');
    });

    it('should throw on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(api.fetchCurrentCommitSha()).rejects.toThrow(
        'Failed to fetch commit SHA: 404 Not Found'
      );
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));

      await expect(api.fetchCurrentCommitSha()).rejects.toThrow('Network failure');
    });

    it('should throw if response missing sha', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          /* no sha field */
        }),
      });

      await expect(api.fetchCurrentCommitSha()).rejects.toThrow(
        'Invalid response: missing sha field'
      );
    });

    it('should throw if sha is not a string', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 123 }),
      });

      await expect(api.fetchCurrentCommitSha()).rejects.toThrow(
        'Invalid response: missing sha field'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear icon cache', async () => {
      // Populate icon cache
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home e88a\n',
      });

      await api.fetchAllIcons();

      // Clear cache
      api.clearCache();

      // Next fetch should hit the network again
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home e88a\n',
      });

      await api.fetchAllIcons();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should clear category cache', async () => {
      // Populate category cache
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home\n',
      });

      await api.fetchCategoryIcons('action');

      // Clear cache
      api.clearCache();

      // Next fetch should hit the network again
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'home\n',
      });

      await api.fetchCategoryIcons('action');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch throwing error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.fetchAllIcons()).rejects.toThrow();
    });

    it('should handle non-200 responses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(api.fetchAllIcons()).rejects.toThrow(
        'Could not fetch codepoints from any known location'
      );
    });

    it('should handle malformed responses', async () => {
      // All paths return malformed responses
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => {
          throw new Error('Failed to parse text');
        },
      });

      // Error from text() is caught, tries all paths, then throws generic error
      await expect(api.fetchAllIcons()).rejects.toThrow(
        'Could not fetch codepoints from any known location'
      );
    });
  });
});
