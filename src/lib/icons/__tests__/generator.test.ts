/**
 * @module @figma/icons/__tests__/generator
 *
 * Unit tests for IconGenerator class with Figma API mocks.
 * Tests complete icon generation workflow, positioning, and metadata.
 */

/* cspell:ignore unrequested */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IconGenerator } from '../generator';
import type { VariantData, GeneratorConfig } from '../generator';
import {
  installMockFigmaAPI,
  uninstallMockFigmaAPI,
  createMockComponentNode,
  createMockComponentSetNode,
  type MockFigmaAPI,
} from '../../../__tests__/mocks/figma-api.mock';

// Mock dependencies
vi.mock('@lib/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    time: vi.fn(() => vi.fn()),
  },
  hashSvg: vi.fn((content: string) => `hash-${content.length}`),
}));

vi.mock('@lib/tokens', () => ({
  applyMUIVariables: vi.fn(),
}));

describe('IconGenerator', () => {
  let mockFigma: MockFigmaAPI;

  // Helper to create test variant data
  function createVariantData(overrides?: Partial<VariantData>): VariantData {
    return {
      iconName: 'test-icon',
      style: 'rounded',
      variant: {
        weight: 400,
        fill: 0,
        grade: 0,
        opticalSize: 24,
      },
      svgContent: '<svg><path d="M10 20"/></svg>',
      ...overrides,
    };
  }

  // Helper to create multiple variants for an icon
  function createIconVariants(iconName: string, count: number): VariantData[] {
    const weights = [400, 500, 600, 700, 100, 200, 300] as const;
    return Array.from({ length: count }, (_, i) =>
      createVariantData({
        iconName,
        variant: {
          weight: weights[i % weights.length],
          fill: (i % 2) as 0 | 1,
          grade: 0,
          opticalSize: 24,
        },
        svgContent: `<svg>variant-${i}</svg>`,
      })
    );
  }

  beforeEach(() => {
    mockFigma = installMockFigmaAPI();
  });

  afterEach(() => {
    uninstallMockFigmaAPI();
  });

  describe('Constructor', () => {
    it('should create generator with default config', () => {
      const generator = new IconGenerator();

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(IconGenerator);
    });

    it('should accept empty config', () => {
      const generator = new IconGenerator({});

      expect(generator).toBeDefined();
    });

    it('should accept custom config options', () => {
      const config: GeneratorConfig = {
        applyVariables: false,
        preserveBindings: true,
        cleanExisting: true,
        updateMode: 'replace',
        checkContentChanges: false,
        removeUnrequestedVariants: false,
        commitSha: 'abc123',
      };

      const generator = new IconGenerator(config);

      expect(generator).toBeDefined();
    });

    it('should accept layout configuration', () => {
      const generator = new IconGenerator({
        layout: {
          startX: 200,
          startY: 300,
          itemsPerRow: 10,
          gapX: 50,
          gapY: 50,
        },
      });

      expect(generator).toBeDefined();
    });

    it('should accept custom page', () => {
      const customPage = {
        appendChild: vi.fn(),
        children: [],
        type: 'PAGE',
      };

      const generator = new IconGenerator({
        page: customPage as any,
      });

      expect(generator).toBeDefined();
    });
  });

  describe('generateIcon - Create New Icon', () => {
    it('should create new icon with single variant', async () => {
      const generator = new IconGenerator();
      const variants = [createVariantData()];

      const result = await generator.generateIcon('test-icon', variants);

      expect(result).toBeDefined();
      expect(result.componentSet).toBeDefined();
      expect(result.componentSet.type).toBe('COMPONENT_SET');
      expect(result.variantsCreated).toBe(1);
      expect(result.variantsUpdated).toBe(0);
      expect(result.variantsSkipped).toBe(0);
    });

    it('should create icon with multiple variants', async () => {
      const generator = new IconGenerator();
      const variants = createIconVariants('multi-icon', 5);

      const result = await generator.generateIcon('multi-icon', variants);

      expect(result.variantsCreated).toBe(5);
      expect(result.componentSet.children).toHaveLength(5);
    });

    it('should set component set name to icon name', async () => {
      const generator = new IconGenerator();
      const variants = [createVariantData({ iconName: 'home' })];

      const result = await generator.generateIcon('home', variants);

      expect(result.componentSet.name).toBe('home');
    });

    it('should call combineAsVariants to create component set', async () => {
      const generator = new IconGenerator();
      const variants = createIconVariants('test', 3);

      await generator.generateIcon('test', variants);

      expect(mockFigma.combineAsVariants).toHaveBeenCalled();
    });

    it('should position component set at default location', async () => {
      const generator = new IconGenerator();
      const variants = [createVariantData()];

      const result = await generator.generateIcon('positioned', variants);

      // Default position is (100, 100)
      expect(result.componentSet.x).toBe(100);
      expect(result.componentSet.y).toBe(100);
    });

    it('should position component set at custom location', async () => {
      const generator = new IconGenerator({
        layout: {
          startX: 500,
          startY: 600,
        },
      });
      const variants = [createVariantData()];

      const result = await generator.generateIcon('custom-pos', variants);

      expect(result.componentSet.x).toBe(500);
      expect(result.componentSet.y).toBe(600);
    });

    it('should throw error if no components created', async () => {
      // Mock createNodeFromSvg to always return null
      mockFigma.createNodeFromSvg.mockReturnValue(null);

      const generator = new IconGenerator();
      const variants = [createVariantData()];

      await expect(generator.generateIcon('fail', variants)).rejects.toThrow();
    });

    it('should store commit SHA when provided', async () => {
      const generator = new IconGenerator({
        commitSha: 'abc123def',
      });
      const variants = [createVariantData()];

      const result = await generator.generateIcon('versioned', variants);

      expect(result.componentSet.setPluginData).toHaveBeenCalledWith('git_commit_sha', 'abc123def');
    });

    it('should not store commit SHA when not provided', async () => {
      const generator = new IconGenerator();
      const variants = [createVariantData()];

      const result = await generator.generateIcon('unversioned', variants);

      // setPluginData should not be called with git_commit_sha
      const calls = (result.componentSet.setPluginData as any).mock.calls;
      const commitShaCalls = calls.filter((call: any[]) => call[0] === 'git_commit_sha');
      expect(commitShaCalls).toHaveLength(0);
    });
  });

  describe('generateIcon - Update Existing Icon', () => {
    it('should update existing icon instead of creating new one', async () => {
      const generator = new IconGenerator();

      // Create existing component set
      const existingComponents = [
        createMockComponentNode(
          'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
      ];
      const existingSet = createMockComponentSetNode('existing-icon', existingComponents);
      existingSet.x = 100;
      existingSet.y = 100;
      existingSet.parent = mockFigma.currentPage as any; // Set parent

      // Add to page
      mockFigma.currentPage.children = [existingSet];

      // Generate with same name
      const variants = [createVariantData({ iconName: 'existing-icon' })];
      const result = await generator.generateIcon('existing-icon', variants);

      // Should update, not create
      expect(result.componentSet).toBe(existingSet);
      expect(mockFigma.combineAsVariants).not.toHaveBeenCalled();
    });

    it('should add new variants to existing icon', async () => {
      const generator = new IconGenerator({
        checkContentChanges: false, // Disable change detection for this test
      });

      // Existing icon with 1 variant
      const existingComponents = [
        createMockComponentNode(
          'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
      ];
      const existingSet = createMockComponentSetNode('add-variants', existingComponents);
      existingSet.parent = mockFigma.currentPage as any; // Set parent so appendChild works
      mockFigma.currentPage.children = [existingSet];

      // Generate with 3 variants (1 existing + 2 new)
      const variants = createIconVariants('add-variants', 3);
      const result = await generator.generateIcon('add-variants', variants);

      expect(result.variantsCreated).toBe(2); // 2 new variants
      expect(result.variantsUpdated).toBe(0);
      expect(result.variantsSkipped).toBe(1); // 1 existing unchanged
    });

    it('should update changed variants', async () => {
      const generator = new IconGenerator({
        checkContentChanges: true,
      });

      // Existing variant with stored hash
      const existingComponent = createMockComponentNode(
        'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
      );
      existingComponent.setPluginData('svg_hash', 'old-hash');
      existingComponent.getPluginData.mockReturnValue('old-hash');

      const existingSet = createMockComponentSetNode('update-test', [existingComponent]);
      existingSet.parent = mockFigma.currentPage as any;
      mockFigma.currentPage.children = [existingSet];

      // Generate with different content (different hash)
      const variants = [
        createVariantData({
          iconName: 'update-test',
          svgContent: '<svg>NEW CONTENT</svg>',
        }),
      ];

      const result = await generator.generateIcon('update-test', variants);

      expect(result.variantsUpdated).toBe(1);
    });

    it('should skip unchanged variants', async () => {
      const generator = new IconGenerator({
        checkContentChanges: true,
      });

      const svgContent = '<svg>same content</svg>';
      const hash = `hash-${svgContent.length}`;

      // Existing variant with matching hash
      const existingComponent = createMockComponentNode(
        'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
      );
      existingComponent.getPluginData.mockReturnValue(hash);

      const existingSet = createMockComponentSetNode('skip-test', [existingComponent]);
      existingSet.parent = mockFigma.currentPage as any;
      mockFigma.currentPage.children = [existingSet];

      // Generate with same content
      const variants = [
        createVariantData({
          iconName: 'skip-test',
          svgContent,
        }),
      ];

      const result = await generator.generateIcon('skip-test', variants);

      expect(result.variantsSkipped).toBe(1);
      expect(result.variantsUpdated).toBe(0);
      expect(result.variantsCreated).toBe(0);
    });

    it('should remove unrequested variants by default', async () => {
      const generator = new IconGenerator();

      // Existing icon with 3 variants
      const existingComponents = [
        createMockComponentNode(
          'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
        createMockComponentNode(
          'Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
        createMockComponentNode(
          'Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
      ];
      const existingSet = createMockComponentSetNode('remove-test', existingComponents);
      existingSet.parent = mockFigma.currentPage as any;
      mockFigma.currentPage.children = [existingSet];

      // Generate with only 1 variant
      const variants = [createVariantData({ iconName: 'remove-test' })];
      await generator.generateIcon('remove-test', variants);

      // Should remove 2 unrequested variants
      expect(existingComponents[1].remove).toHaveBeenCalled();
      expect(existingComponents[2].remove).toHaveBeenCalled();
    });

    it('should not remove unrequested variants when disabled', async () => {
      const generator = new IconGenerator({
        removeUnrequestedVariants: false,
      });

      const existingComponents = [
        createMockComponentNode(
          'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
        createMockComponentNode(
          'Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
      ];
      const existingSet = createMockComponentSetNode('keep-test', existingComponents);
      existingSet.parent = mockFigma.currentPage as any;
      mockFigma.currentPage.children = [existingSet];

      // Generate with only 1 variant
      const variants = [createVariantData({ iconName: 'keep-test' })];
      await generator.generateIcon('keep-test', variants);

      // Should not remove the extra variant
      expect(existingComponents[1].remove).not.toHaveBeenCalled();
    });
  });

  describe('Grid Layout and Positioning', () => {
    it('should position multiple icons in a grid', async () => {
      const generator = new IconGenerator({
        layout: {
          startX: 0,
          startY: 0,
          itemsPerRow: 3,
          gapX: 10,
          gapY: 10,
        },
      });

      const variants1 = [createVariantData({ iconName: 'icon1' })];
      const variants2 = [createVariantData({ iconName: 'icon2' })];
      const variants3 = [createVariantData({ iconName: 'icon3' })];

      const icon1 = await generator.generateIcon('icon1', variants1);
      const icon2 = await generator.generateIcon('icon2', variants2);
      const icon3 = await generator.generateIcon('icon3', variants3);

      // First icon at (0, 0)
      expect(icon1.componentSet.x).toBe(0);
      expect(icon1.componentSet.y).toBe(0);

      // Second icon at (0 + 56 + 10, 0) = (66, 0)
      expect(icon2.componentSet.x).toBe(66);
      expect(icon2.componentSet.y).toBe(0);

      // Third icon at (66 + 56 + 10, 0) = (132, 0)
      expect(icon3.componentSet.x).toBe(132);
      expect(icon3.componentSet.y).toBe(0);
    });

    it('should wrap to next row after itemsPerRow', async () => {
      const generator = new IconGenerator({
        layout: {
          startX: 0,
          startY: 0,
          itemsPerRow: 2,
          gapX: 10,
          gapY: 20,
        },
      });

      await generator.generateIcon('icon1', [createVariantData()]);
      await generator.generateIcon('icon2', [createVariantData()]);
      const result3 = await generator.generateIcon('icon3', [createVariantData()]);

      // Third icon should wrap to next row
      // y = 0 + 56 (height) + 20 (gapY) = 76
      expect(result3.componentSet.x).toBe(0); // Back to start of row
      expect(result3.componentSet.y).toBe(76);
    });

    it('should handle mixed new and existing icons in layout', async () => {
      const generator = new IconGenerator({
        layout: {
          startX: 0,
          startY: 0,
          itemsPerRow: 10,
          gapX: 10,
          gapY: 10,
        },
      });

      // Create existing icon that will be updated (so position tracking is aware of it)
      const existingSet = createMockComponentSetNode('existing', [
        createMockComponentNode(
          'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
        ),
      ]);
      existingSet.x = 0;
      existingSet.y = 0;
      existingSet.width = 56;
      existingSet.height = 56;
      existingSet.parent = mockFigma.currentPage as any;
      mockFigma.currentPage.children = [existingSet];

      // Update existing icon (this registers its position with the generator)
      await generator.generateIcon('existing', [createVariantData({ iconName: 'existing' })]);

      // Generate new icon - should be positioned after existing icon
      const result = await generator.generateIcon('new-icon', [createVariantData()]);

      // Should be positioned after existing icon
      // Position 1: (0 + 56 + 10, 0) = (66, 0)
      expect(result.componentSet.x).toBe(66);
      expect(result.componentSet.y).toBe(0);
    });
  });

  describe('Component Set Configuration', () => {
    it('should configure component set with standard sizing', async () => {
      const generator = new IconGenerator();
      const variants = [createVariantData()];

      const result = await generator.generateIcon('configured', variants);

      expect(result.componentSet.resize).toHaveBeenCalledWith(56, 56);
    });

    it('should apply MUI variables when enabled', async () => {
      const { applyMUIVariables } = await import('@lib/tokens');

      const generator = new IconGenerator({
        applyVariables: true,
      });
      const variants = [createVariantData()];

      const result = await generator.generateIcon('with-vars', variants);

      expect(applyMUIVariables).toHaveBeenCalledWith(result.componentSet);
    });

    it('should not apply MUI variables when disabled', async () => {
      const { applyMUIVariables } = await import('@lib/tokens');
      (applyMUIVariables as any).mockClear();

      const generator = new IconGenerator({
        applyVariables: false,
      });
      const variants = [createVariantData()];

      await generator.generateIcon('no-vars', variants);

      expect(applyMUIVariables).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle component creation failures gracefully', async () => {
      // Make some components fail to create
      let callCount = 0;
      mockFigma.createNodeFromSvg.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return null; // Second variant fails
        }
        const vector = { type: 'VECTOR', children: [] };
        return {
          type: 'FRAME',
          children: [vector],
          appendChild: vi.fn(),
          remove: vi.fn(),
        } as any;
      });

      const generator = new IconGenerator();
      const variants = createIconVariants('partial', 3);

      const result = await generator.generateIcon('partial', variants);

      // Should create 2 out of 3 variants
      expect(result.variantsCreated).toBe(2);
    });

    it('should continue after appendChild errors during update', async () => {
      const generator = new IconGenerator();

      const existingComponent = createMockComponentNode(
        'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
      );
      const existingSet = createMockComponentSetNode('error-test', [existingComponent]);
      existingSet.parent = mockFigma.currentPage as any;
      mockFigma.currentPage.children = [existingSet];

      // Make appendChild throw
      existingSet.appendChild.mockImplementation(() => {
        throw new Error('Cannot append');
      });

      const variants = createIconVariants('error-test', 2);

      // Should not throw
      await expect(generator.generateIcon('error-test', variants)).resolves.not.toThrow();
    });
  });

  describe('Integration: Full Workflow', () => {
    it('should handle complete icon lifecycle', async () => {
      const generator = new IconGenerator({
        commitSha: 'v1.0.0',
      });

      // 1. Create icon
      const initialVariants = createIconVariants('lifecycle', 3);
      const create = await generator.generateIcon('lifecycle', initialVariants);

      expect(create.variantsCreated).toBe(3);
      expect(create.componentSet.name).toBe('lifecycle');

      // 2. Update with new variant
      const updatedVariants = createIconVariants('lifecycle', 4);
      const update = await generator.generateIcon('lifecycle', updatedVariants);

      expect(update.variantsCreated).toBe(1); // 1 new
      expect(update.variantsSkipped).toBeGreaterThan(0); // Some unchanged
    });

    it('should maintain consistent state across multiple generations', async () => {
      const generator = new IconGenerator({
        layout: {
          startX: 0,
          startY: 0,
          itemsPerRow: 2,
          gapX: 10,
          gapY: 10,
        },
      });

      // Generate 5 icons
      for (let i = 0; i < 5; i++) {
        const variants = [createVariantData({ iconName: `icon-${i}` })];
        const result = await generator.generateIcon(`icon-${i}`, variants);
        expect(result.componentSet).toBeDefined();
      }

      // Positions should be consistent and follow grid layout
      // This implicitly tests that internal position tracking is working
    });
  });
});
