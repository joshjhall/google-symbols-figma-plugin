/**
 * @module @figma/icons/__tests__/incremental-updater
 *
 * Unit tests for incremental update and cleanup functions.
 * Tests variant property cleanup on ComponentSets and page scanning.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanupVariantFillsInComponentSet,
  scanAndCleanupVariantFills,
} from '../incremental-updater';

// Mock logger to suppress output during tests
vi.mock('@lib/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the cleanupVariantFills function from variant-utils
vi.mock('../variant-utils', () => ({
  cleanupVariantFills: vi.fn((component: ComponentNode) => {
    // Mock implementation: return true if component has fills
    if (
      'fills' in component &&
      component.fills &&
      (component.fills as readonly Paint[]).length > 0
    ) {
      // Simulate cleanup by clearing the fills
      component.fills = [];
      return true;
    }
    return false;
  }),
}));

describe('cleanupVariantFillsInComponentSet', () => {
  function createMockComponent(name: string, hasFills = false): ComponentNode {
    const fills: readonly Paint[] = hasFills
      ? [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false }]
      : [];

    return {
      type: 'COMPONENT',
      name,
      fills,
    } as ComponentNode;
  }

  function createMockComponentSet(name: string, components: ComponentNode[]): ComponentSetNode {
    return {
      type: 'COMPONENT_SET',
      name,
      children: components,
    } as unknown as ComponentSetNode;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 when no components have fills', () => {
    const components = [
      createMockComponent('Variant 1', false),
      createMockComponent('Variant 2', false),
      createMockComponent('Variant 3', false),
    ];
    const componentSet = createMockComponentSet('home', components);

    const result = cleanupVariantFillsInComponentSet(componentSet);

    expect(result).toBe(0);
  });

  it('should return count of components cleaned', () => {
    const components = [
      createMockComponent('Variant 1', true),
      createMockComponent('Variant 2', false),
      createMockComponent('Variant 3', true),
    ];
    const componentSet = createMockComponentSet('home', components);

    const result = cleanupVariantFillsInComponentSet(componentSet);

    expect(result).toBe(2);
  });

  it('should clean all components with fills', () => {
    const components = [
      createMockComponent('Variant 1', true),
      createMockComponent('Variant 2', true),
      createMockComponent('Variant 3', true),
    ];
    const componentSet = createMockComponentSet('home', components);

    const result = cleanupVariantFillsInComponentSet(componentSet);

    expect(result).toBe(3);

    // Verify all fills were cleared
    components.forEach((comp) => {
      expect((comp.fills as readonly Paint[]).length).toBe(0);
    });
  });

  it('should handle empty component set', () => {
    const componentSet = createMockComponentSet('home', []);

    const result = cleanupVariantFillsInComponentSet(componentSet);

    expect(result).toBe(0);
  });

  it('should skip non-component children', () => {
    const components = [
      createMockComponent('Variant 1', true),
      { type: 'FRAME', name: 'Not a component' } as unknown as ComponentNode,
      createMockComponent('Variant 2', true),
    ];
    const componentSet = createMockComponentSet('home', components as ComponentNode[]);

    const result = cleanupVariantFillsInComponentSet(componentSet);

    expect(result).toBe(2);
  });
});

describe('scanAndCleanupVariantFills', () => {
  function createMockComponent(hasFills = false): ComponentNode {
    const fills: readonly Paint[] = hasFills
      ? [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false }]
      : [];

    return {
      type: 'COMPONENT',
      name: 'Variant',
      fills,
    } as ComponentNode;
  }

  function createMockComponentSet(
    name: string,
    componentCount: number,
    withFills: number
  ): ComponentSetNode {
    const components: ComponentNode[] = [];
    for (let i = 0; i < componentCount; i++) {
      components.push(createMockComponent(i < withFills));
    }

    return {
      type: 'COMPONENT_SET',
      name,
      children: components,
    } as unknown as ComponentSetNode;
  }

  function createMockPage(componentSets: ComponentSetNode[]): PageNode {
    return {
      type: 'PAGE',
      name: 'Test Page',
      children: componentSets as SceneNode[],
    } as unknown as PageNode;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return zero stats when cleanup is disabled', async () => {
    const componentSets = [createMockComponentSet('home', 3, 2)];
    const page = createMockPage(componentSets);

    const result = await scanAndCleanupVariantFills(page, false);

    expect(result).toEqual({
      componentSetsScanned: 0,
      variantsCleanedTotal: 0,
      componentSetsWithIssues: 0,
    });
  });

  it('should scan and clean all component sets when enabled', async () => {
    const componentSets = [
      createMockComponentSet('home', 3, 2), // 2 with issues
      createMockComponentSet('search', 3, 1), // 1 with issues
      createMockComponentSet('settings', 3, 0), // 0 with issues
    ];
    const page = createMockPage(componentSets);

    const result = await scanAndCleanupVariantFills(page, true);

    expect(result.componentSetsScanned).toBe(3);
    expect(result.variantsCleanedTotal).toBe(3);
    expect(result.componentSetsWithIssues).toBe(2);
  });

  it('should handle page with no component sets', async () => {
    const page = createMockPage([]);

    const result = await scanAndCleanupVariantFills(page, true);

    expect(result).toEqual({
      componentSetsScanned: 0,
      variantsCleanedTotal: 0,
      componentSetsWithIssues: 0,
    });
  });

  it('should handle page with only clean component sets', async () => {
    const componentSets = [
      createMockComponentSet('home', 3, 0),
      createMockComponentSet('search', 3, 0),
    ];
    const page = createMockPage(componentSets);

    const result = await scanAndCleanupVariantFills(page, true);

    expect(result.componentSetsScanned).toBe(2);
    expect(result.variantsCleanedTotal).toBe(0);
    expect(result.componentSetsWithIssues).toBe(0);
  });

  it('should handle nested component sets', async () => {
    const componentSets = [createMockComponentSet('home', 3, 2)];

    // Create a frame containing a component set (nested structure)
    const frame = {
      type: 'FRAME',
      name: 'Icons Group',
      children: [componentSets[0] as SceneNode],
    };

    const page = {
      type: 'PAGE',
      name: 'Test Page',
      children: [frame as unknown as SceneNode],
    } as unknown as PageNode;

    const result = await scanAndCleanupVariantFills(page, true);

    // Should find nested component sets
    expect(result.componentSetsScanned).toBe(1);
    expect(result.variantsCleanedTotal).toBe(2);
  });

  it('should accumulate counts across multiple component sets', async () => {
    const componentSets = [
      createMockComponentSet('icon1', 5, 3), // 3 cleaned
      createMockComponentSet('icon2', 5, 2), // 2 cleaned
      createMockComponentSet('icon3', 5, 4), // 4 cleaned
      createMockComponentSet('icon4', 5, 0), // 0 cleaned
    ];
    const page = createMockPage(componentSets);

    const result = await scanAndCleanupVariantFills(page, true);

    expect(result.componentSetsScanned).toBe(4);
    expect(result.variantsCleanedTotal).toBe(9);
    expect(result.componentSetsWithIssues).toBe(3);
  });
});

describe('Integration: cleanup workflow', () => {
  function createMockComponent(hasFills = false): ComponentNode {
    const fills: readonly Paint[] = hasFills
      ? [
          { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false },
          { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, visible: false },
        ]
      : [];

    return {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
      fills,
    } as ComponentNode;
  }

  function createMockComponentSet(withIssues: boolean): ComponentSetNode {
    const components = [
      createMockComponent(withIssues),
      createMockComponent(withIssues),
      createMockComponent(false),
    ];

    return {
      type: 'COMPONENT_SET',
      name: 'test-icon',
      children: components,
    } as unknown as ComponentSetNode;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clean up component set and report accurate counts', () => {
    const componentSet = createMockComponentSet(true);

    const cleanedCount = cleanupVariantFillsInComponentSet(componentSet);

    expect(cleanedCount).toBe(2);

    // Verify cleanup was performed
    const componentsWithFills = (componentSet.children as ComponentNode[]).filter(
      (c) => (c.fills as readonly Paint[]).length > 0
    );
    expect(componentsWithFills.length).toBe(0);
  });

  it('should handle multiple component sets in sequence', () => {
    const set1 = createMockComponentSet(true);
    const set2 = createMockComponentSet(true);
    const set3 = createMockComponentSet(false);

    const count1 = cleanupVariantFillsInComponentSet(set1);
    const count2 = cleanupVariantFillsInComponentSet(set2);
    const count3 = cleanupVariantFillsInComponentSet(set3);

    expect(count1).toBe(2);
    expect(count2).toBe(2);
    expect(count3).toBe(0);

    const totalCleaned = count1 + count2 + count3;
    expect(totalCleaned).toBe(4);
  });
});
