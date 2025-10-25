/**
 * @module @figma/handlers/__tests__/category-generation
 *
 * Tests for category-based icon generation handler.
 * Tests workflow orchestration, rename handling, and progress tracking.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { handleCategoryGeneration, type CategoryGenerationConfig } from '../category-generation';
import { logger } from '@lib/utils';
import { pageManager } from '@lib/pages/manager';
import { IconGenerator } from '@lib/icons/generator';
import { getIconRange } from '@lib/icons/all-icons';
import { handleDeprecatedIcons, getDeprecationSummary } from '@lib/icons/deprecation-handler';
import { organizePageIntoFrame } from '../page-organization';
import { getFinalSetName } from '../cumulative-changes';
import { RateLimiter } from '../category-generation/rate-limiter';
import { ProgressTracker } from '../category-generation/progress-tracker';
import { IconProcessor } from '../category-generation/icon-processor';
import { PLUGIN_MESSAGES } from '@/types';
import { PLUGIN_DATA_KEYS } from '@lib/constants';

// Mock all dependencies
vi.mock('@lib/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@lib/pages/manager', () => ({
  pageManager: {
    getOrCreatePage: vi.fn(),
  },
}));

vi.mock('@lib/icons/generator', () => ({
  IconGenerator: vi.fn(),
}));

vi.mock('@lib/icons/all-icons', () => ({
  getIconRange: vi.fn(),
}));

vi.mock('@lib/icons/deprecation-handler', () => ({
  handleDeprecatedIcons: vi.fn(),
  getDeprecationSummary: vi.fn(),
}));

vi.mock('../page-organization', () => ({
  organizePageIntoFrame: vi.fn(),
}));

vi.mock('../cumulative-changes', () => ({
  getFinalSetName: vi.fn(),
}));

vi.mock('../category-generation/rate-limiter', () => ({
  RateLimiter: vi.fn(),
}));

vi.mock('../category-generation/progress-tracker', () => ({
  ProgressTracker: vi.fn(),
}));

vi.mock('../category-generation/icon-processor', () => ({
  IconProcessor: vi.fn(),
}));

describe('category-generation', () => {
  let mockPage: any;
  let mockTracker: any;
  let mockGenerator: any;
  let mockRateLimiter: any;
  let mockProcessor: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Figma globals
    (global as any).figma = {
      root: {
        children: [],
      },
      ui: {
        postMessage: vi.fn(),
      },
      notify: vi.fn(),
    };

    // Mock page
    mockPage = {
      name: 'Set 01: test',
      setPluginData: vi.fn(),
      getPluginData: vi.fn(),
      children: [],
    };

    // Mock progress tracker
    mockTracker = {
      init: vi.fn(),
      update: vi.fn(),
      complete: vi.fn(),
      error: vi.fn(),
      getCompletedCount: vi.fn(() => 5),
      getTotalCount: vi.fn(() => 10),
    };

    // Mock generator
    mockGenerator = {
      generateIconSet: vi.fn(),
    };

    // Mock rate limiter
    mockRateLimiter = {
      execute: vi.fn(),
    };

    // Mock processor
    mockProcessor = {
      processIcon: vi.fn(),
    };

    // Setup mocks
    (pageManager.getOrCreatePage as Mock).mockResolvedValue(mockPage);
    (ProgressTracker as Mock).mockReturnValue(mockTracker);
    (IconGenerator as Mock).mockReturnValue(mockGenerator);
    (RateLimiter as Mock).mockReturnValue(mockRateLimiter);
    (IconProcessor as Mock).mockReturnValue(mockProcessor);
    (getIconRange as Mock).mockReturnValue(['home', 'search', 'star']);
    (handleDeprecatedIcons as Mock).mockResolvedValue({
      removed: [],
      kept: [],
    });
    (getDeprecationSummary as Mock).mockReturnValue('No deprecated icons');
    (organizePageIntoFrame as Mock).mockResolvedValue(undefined);
    (getFinalSetName as Mock).mockImplementation((_num, name) => name);
  });

  describe('handleCategoryGeneration', () => {
    it('should initialize and load icon range', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(getIconRange).toHaveBeenCalledWith('home', 'star');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loaded 3 icons in category range')
      );
    });

    it('should create progress tracker with correct total', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(ProgressTracker).toHaveBeenCalledWith({
        totalIcons: 3,
        category: 'Set 01: test',
      });
      expect(mockTracker.init).toHaveBeenCalled();
    });

    it('should limit icons in test mode', async () => {
      (getIconRange as Mock).mockReturnValue(['home', 'search', 'star', 'settings', 'share']);

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'share',
        },
        testIconCount: 2,
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      await handleCategoryGeneration(msg, config);

      // Should only process 2 icons
      expect(mockProcessor.processIcon).toHaveBeenCalledTimes(2);
      expect(mockProcessor.processIcon).toHaveBeenCalledWith('home', 0);
      expect(mockProcessor.processIcon).toHaveBeenCalledWith('search', 1);
    });

    it('should create or get page with category name', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(pageManager.getOrCreatePage).toHaveBeenCalledWith('Set 01: test', {
        autoSwitch: true,
        cleanExisting: false,
      });
    });

    it('should store commit SHA on page', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(mockPage.setPluginData).toHaveBeenCalledWith(
        PLUGIN_DATA_KEYS.GIT_COMMIT_SHA,
        'abc123'
      );
    });

    it('should handle Cat→Set naming transition', async () => {
      const oldPage = {
        name: 'Cat 01: test-old',
        setPluginData: vi.fn(),
        getPluginData: vi.fn(() => 'old-commit'),
        children: [
          {
            type: 'FRAME',
            name: 'Cat 01: test-old',
          },
        ],
      };

      (global as any).figma.root.children = [oldPage];

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'new-commit',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(oldPage.name).toBe('Set 01: test');
      expect(oldPage.children[0].name).toBe('Set 01: test');
      expect(oldPage.setPluginData).toHaveBeenCalledWith(
        PLUGIN_DATA_KEYS.GIT_COMMIT_SHA,
        'new-commit'
      );
    });

    it('should handle boundary shift renames', async () => {
      const oldPage = {
        name: 'Set 01: old-boundaries',
        setPluginData: vi.fn(),
        getPluginData: vi.fn(() => 'old-commit'),
        children: [
          {
            type: 'FRAME',
            name: 'Set 01: old-boundaries',
          },
        ],
      };

      (global as any).figma.root.children = [oldPage];
      (getFinalSetName as Mock).mockReturnValue('Set 01: new-boundaries');

      const msg = {
        category: 'Set 01: new-boundaries',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'new-commit',
        iconChangesData: null,
        iconChangesCumulative: {
          setRenames: {
            'old-commit->new-commit': [
              {
                setNumber: 1,
                oldName: 'Set 01: old-boundaries',
                newName: 'Set 01: new-boundaries',
              },
            ],
          },
        },
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(getFinalSetName).toHaveBeenCalled();
      expect(oldPage.name).toBe('Set 01: new-boundaries');
    });

    it('should handle deprecated icons', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(handleDeprecatedIcons).toHaveBeenCalledWith(mockPage, ['home', 'search', 'star']);
      expect(getDeprecationSummary).toHaveBeenCalled();
    });

    it('should create IconGenerator with correct config', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(IconGenerator).toHaveBeenCalledWith({
        page: mockPage,
        applyVariables: true,
        checkContentChanges: true,
        removeUnrequestedVariants: true,
        commitSha: 'abc123',
        layout: {
          startX: 100,
          startY: 100,
          itemsPerRow: 24,
          gapX: 24,
          gapY: 24,
        },
      });
    });

    it('should create RateLimiter with progress callbacks', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(RateLimiter).toHaveBeenCalledWith({
        maxRetries: 4,
        onProgress: expect.any(Function),
        isCancelled: expect.any(Function),
      });
    });

    it('should create IconProcessor with all dependencies', async () => {
      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: {
          changedIcons: ['home'],
          newIcons: ['search'],
        },
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(IconProcessor).toHaveBeenCalledWith({
        generator: mockGenerator,
        rateLimiter: mockRateLimiter,
        tracker: mockTracker,
        page: mockPage,
        commitSha: 'abc123',
        iconChangesData: {
          changedIcons: ['home'],
          newIcons: ['search'],
        },
        iconChangesCumulative: null,
        variantConfig: {
          styles: ['rounded', 'outlined', 'sharp'],
          weights: [100, 200, 300, 400, 500, 600, 700],
          fills: [0, 1],
          grades: [-25, 0, 200],
          opticalSizes: [20, 24, 40, 48],
        },
      });
    });

    it('should process each icon in order', async () => {
      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(mockProcessor.processIcon).toHaveBeenCalledTimes(3);
      expect(mockProcessor.processIcon).toHaveBeenNthCalledWith(1, 'home', 0);
      expect(mockProcessor.processIcon).toHaveBeenNthCalledWith(2, 'search', 1);
      expect(mockProcessor.processIcon).toHaveBeenNthCalledWith(3, 'star', 2);
    });

    it('should increment counter only for successful actions', async () => {
      (mockProcessor.processIcon as Mock)
        .mockResolvedValueOnce({ action: 'created' })
        .mockResolvedValueOnce({ action: 'failed' })
        .mockResolvedValueOnce({ action: 'updated' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      // Should notify with 2 completed (failed doesn't count)
      expect(figma.notify).toHaveBeenCalledWith(expect.stringContaining('2 icons'));
    });

    it('should check for cancellation before each icon', async () => {
      let callCount = 0;
      const isCancelled = vi.fn(() => {
        callCount++;
        return callCount > 1; // Cancel after first icon
      });

      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled,
      };

      await handleCategoryGeneration(msg, config);

      // Should only process 1 icon before cancelling
      expect(mockProcessor.processIcon).toHaveBeenCalledTimes(1);
      expect(mockTracker.complete).toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
    });

    it('should continue on individual icon errors', async () => {
      (mockProcessor.processIcon as Mock)
        .mockResolvedValueOnce({ action: 'created' })
        .mockRejectedValueOnce(new Error('Download failed'))
        .mockResolvedValueOnce({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      // Should process all 3 icons despite middle failure
      expect(mockProcessor.processIcon).toHaveBeenCalledTimes(3);
      expect(mockTracker.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate search')
      );
    });

    it('should organize page into frame after processing', async () => {
      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(organizePageIntoFrame).toHaveBeenCalledWith(mockPage, 'Set 01: test');
    });

    it('should continue if organization fails', async () => {
      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });
      (organizePageIntoFrame as Mock).mockRejectedValue(new Error('Organization failed'));

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to organize page into frame:',
        expect.any(Error)
      );
      expect(mockTracker.complete).toHaveBeenCalled();
    });

    it('should complete tracker when done', async () => {
      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(mockTracker.complete).toHaveBeenCalled();
    });

    it('should notify user on completion', async () => {
      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(figma.notify).toHaveBeenCalledWith('✅ Generated 3 icons in Set 01: test');
    });

    it('should handle icon range loading errors', async () => {
      (getIconRange as Mock).mockImplementation(() => {
        throw new Error('Invalid range');
      });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'invalid',
          lastIconExclusive: 'invalid',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(logger.error).toHaveBeenCalledWith('Failed to load icon list:', expect.any(Error));
      expect(figma.ui.postMessage).toHaveBeenCalledWith({
        type: PLUGIN_MESSAGES.ERROR,
        message: expect.stringContaining('Failed to load icon list'),
      });
    });

    it('should handle top-level errors gracefully', async () => {
      (pageManager.getOrCreatePage as Mock).mockRejectedValue(new Error('Page creation failed'));

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      await handleCategoryGeneration(msg, config);

      expect(logger.error).toHaveBeenCalledWith('Category generation failed:', expect.any(Error));
      expect(figma.ui.postMessage).toHaveBeenCalledWith({
        type: PLUGIN_MESSAGES.ERROR,
        message: expect.stringContaining('Generation failed'),
      });
    });

    it('should add small delay between icons to prevent UI blocking', async () => {
      vi.useFakeTimers();

      (mockProcessor.processIcon as Mock).mockResolvedValue({ action: 'created' });

      const msg = {
        category: 'Set 01: test',
        categoryData: {
          firstIcon: 'home',
          lastIconExclusive: 'star',
        },
      };

      const config: CategoryGenerationConfig = {
        commitSha: 'abc123',
        iconChangesData: null,
        iconChangesCumulative: null,
        isCancelled: () => false,
      };

      const promise = handleCategoryGeneration(msg, config);

      // Fast-forward all timers
      await vi.runAllTimersAsync();

      await promise;

      expect(mockProcessor.processIcon).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });
});
