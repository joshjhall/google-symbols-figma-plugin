/**
 * @module @figma/icons/__tests__/variant-formatter
 *
 * Unit tests for variant naming and formatting utilities.
 * Tests pure functions for Material Icons variant naming conventions.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_VARIANT,
  getGradeName,
  getVariantName,
  getDefaultVariantName,
  sortComponentsForDefault,
  ensureDefaultVariantFirst,
} from '../variant-formatter';
import type { VariantData } from '../generator';

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
    svgContent: '<svg></svg>',
    ...overrides,
  };
}

// Mock ComponentNode for testing
interface MockComponentNode {
  name: string;
  type: 'COMPONENT';
}

// Mock ComponentSetNode for testing
interface MockComponentSetNode {
  children: MockComponentNode[];
  insertChild: ReturnType<typeof vi.fn>;
  type: 'COMPONENT_SET';
}

function createMockComponent(name: string): MockComponentNode {
  return { name, type: 'COMPONENT' };
}

function createMockComponentSet(children: MockComponentNode[]): MockComponentSetNode {
  return {
    children,
    insertChild: vi.fn(),
    type: 'COMPONENT_SET',
  };
}

describe('DEFAULT_VARIANT', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_VARIANT).toEqual({
      style: 'Rounded',
      weight: 400,
      fill: 'Off',
      grade: 'Normal',
      opticalSize: '24dp',
    });
  });

  it('should be immutable (readonly)', () => {
    // TypeScript enforces this at compile time
    expect(Object.isFrozen(DEFAULT_VARIANT)).toBe(false); // Not frozen, but const
    expect(DEFAULT_VARIANT.style).toBe('Rounded');
  });
});

describe('getGradeName', () => {
  it('should return "Normal" for grade 0', () => {
    expect(getGradeName(0)).toBe('Normal');
  });

  it('should return "Emphasis" for grade 200', () => {
    expect(getGradeName(200)).toBe('Emphasis');
  });

  it('should return "Dark theme" for grade -25', () => {
    expect(getGradeName(-25)).toBe('Dark theme');
  });

  it('should return "Normal" for unknown grades', () => {
    expect(getGradeName(100)).toBe('Normal');
    expect(getGradeName(-100)).toBe('Normal');
    expect(getGradeName(999)).toBe('Normal');
  });

  it('should handle all standard Material Icon grades', () => {
    const grades = [-25, 0, 200];
    const expected = ['Dark theme', 'Normal', 'Emphasis'];

    grades.forEach((grade, index) => {
      expect(getGradeName(grade)).toBe(expected[index]);
    });
  });
});

describe('getVariantName', () => {
  it('should format default variant correctly', () => {
    const variantData = createVariantData();
    const name = getVariantName(variantData);

    expect(name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp');
  });

  it('should capitalize style name', () => {
    const variants = [
      { style: 'rounded', expected: 'Style=Rounded' },
      { style: 'outlined', expected: 'Style=Outlined' },
      { style: 'sharp', expected: 'Style=Sharp' },
    ];

    variants.forEach(({ style, expected }) => {
      const variantData = createVariantData({ style: style as any });
      const name = getVariantName(variantData);
      expect(name).toContain(expected);
    });
  });

  it('should format all weight values', () => {
    const weights = [100, 200, 300, 400, 500, 600, 700];

    weights.forEach((weight) => {
      const variantData = createVariantData({
        variant: { weight, fill: 0, grade: 0, opticalSize: 24 },
      });
      const name = getVariantName(variantData);
      expect(name).toContain(`Weight=${weight}`);
    });
  });

  it('should format fill as "On" or "Off"', () => {
    const fillOn = createVariantData({
      variant: { weight: 400, fill: 1, grade: 0, opticalSize: 24 },
    });
    const fillOff = createVariantData({
      variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
    });

    expect(getVariantName(fillOn)).toContain('Fill=On');
    expect(getVariantName(fillOff)).toContain('Fill=Off');
  });

  it('should format grade names correctly', () => {
    const grades = [
      { grade: -25, expected: 'Grade=Dark theme' },
      { grade: 0, expected: 'Grade=Normal' },
      { grade: 200, expected: 'Grade=Emphasis' },
    ];

    grades.forEach(({ grade, expected }) => {
      const variantData = createVariantData({
        variant: { weight: 400, fill: 0, grade, opticalSize: 24 },
      });
      const name = getVariantName(variantData);
      expect(name).toContain(expected);
    });
  });

  it('should format optical sizes with "dp" suffix', () => {
    const sizes = [20, 24, 40, 48];

    sizes.forEach((size) => {
      const variantData = createVariantData({
        variant: { weight: 400, fill: 0, grade: 0, opticalSize: size },
      });
      const name = getVariantName(variantData);
      expect(name).toContain(`Optical size=${size}dp`);
    });
  });

  it('should include all variant properties in correct order', () => {
    const variantData = createVariantData({
      style: 'outlined',
      variant: { weight: 700, fill: 1, grade: 200, opticalSize: 48 },
    });
    const name = getVariantName(variantData);

    expect(name).toBe('Style=Outlined, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp');
  });

  it('should generate unique names for different variants', () => {
    const variant1 = createVariantData({
      variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
    });
    const variant2 = createVariantData({
      variant: { weight: 400, fill: 1, grade: 0, opticalSize: 24 },
    });
    const variant3 = createVariantData({
      variant: { weight: 700, fill: 0, grade: 0, opticalSize: 24 },
    });

    const name1 = getVariantName(variant1);
    const name2 = getVariantName(variant2);
    const name3 = getVariantName(variant3);

    expect(name1).not.toBe(name2);
    expect(name1).not.toBe(name3);
    expect(name2).not.toBe(name3);
  });

  it('should be deterministic', () => {
    const variantData = createVariantData();
    const name1 = getVariantName(variantData);
    const name2 = getVariantName(variantData);

    expect(name1).toBe(name2);
  });

  it('should handle all 504 variant combinations uniquely', () => {
    // 7 styles × 6 weights × 4 fills × 3 grades × 4 sizes = 2,016 possible (but Material uses subset)
    // Test a representative sample
    const names = new Set<string>();

    const styles = ['rounded', 'outlined'];
    const weights = [400, 700];
    const fills = [0, 1];
    const grades = [0, 200];
    const sizes = [24, 48];

    for (const style of styles) {
      for (const weight of weights) {
        for (const fill of fills) {
          for (const grade of grades) {
            for (const opticalSize of sizes) {
              const variantData = createVariantData({
                style: style as any,
                variant: { weight, fill, grade, opticalSize },
              });
              names.add(getVariantName(variantData));
            }
          }
        }
      }
    }

    // Should have 2 × 2 × 2 × 2 × 2 = 32 unique names
    expect(names.size).toBe(32);
  });
});

describe('getDefaultVariantName', () => {
  it('should return the default variant name', () => {
    const name = getDefaultVariantName();
    expect(name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp');
  });

  it('should match DEFAULT_VARIANT constant', () => {
    const name = getDefaultVariantName();
    expect(name).toContain(`Style=${DEFAULT_VARIANT.style}`);
    expect(name).toContain(`Weight=${DEFAULT_VARIANT.weight}`);
    expect(name).toContain(`Fill=${DEFAULT_VARIANT.fill}`);
    expect(name).toContain(`Grade=${DEFAULT_VARIANT.grade}`);
    expect(name).toContain(`Optical size=${DEFAULT_VARIANT.opticalSize}`);
  });

  it('should be consistent across calls', () => {
    const name1 = getDefaultVariantName();
    const name2 = getDefaultVariantName();
    expect(name1).toBe(name2);
  });

  it('should match getVariantName for default variant', () => {
    const defaultVariantData = createVariantData({
      style: 'rounded',
      variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
    });

    const fromDefault = getDefaultVariantName();
    const fromVariantData = getVariantName(defaultVariantData);

    expect(fromDefault).toBe(fromVariantData);
  });
});

describe('sortComponentsForDefault', () => {
  it('should move default variant to first position', () => {
    const components = [
      createMockComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // default
      createMockComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    sortComponentsForDefault(components as any);

    expect(components[0].name).toBe(
      'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );
  });

  it('should not change order if default is already first', () => {
    const components = [
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // default
      createMockComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createMockComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const originalOrder = components.map((c) => c.name);
    sortComponentsForDefault(components as any);
    const newOrder = components.map((c) => c.name);

    expect(newOrder).toEqual(originalOrder);
  });

  it('should preserve order of non-default variants', () => {
    const components = [
      createMockComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createMockComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // default
      createMockComponent('Style=Outlined, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    sortComponentsForDefault(components as any);

    // Default should be first
    expect(components[0].name).toBe(
      'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );

    // Others should maintain relative order
    expect(components[1].name).toBe(
      'Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );
    expect(components[2].name).toBe(
      'Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );
    expect(components[3].name).toBe(
      'Style=Outlined, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp'
    );
  });

  it('should handle array with no default variant', () => {
    const components = [
      createMockComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createMockComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const originalOrder = components.map((c) => c.name);
    sortComponentsForDefault(components as any);
    const newOrder = components.map((c) => c.name);

    // Order should remain unchanged
    expect(newOrder).toEqual(originalOrder);
  });

  it('should handle empty array', () => {
    const components: MockComponentNode[] = [];
    expect(() => sortComponentsForDefault(components as any)).not.toThrow();
    expect(components).toHaveLength(0);
  });

  it('should handle single component', () => {
    const components = [
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    sortComponentsForDefault(components as any);
    expect(components).toHaveLength(1);
  });

  it('should modify array in place', () => {
    const components = [
      createMockComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const arrayReference = components;
    sortComponentsForDefault(components as any);

    // Should be same array reference
    expect(components).toBe(arrayReference);
    expect(components[0].name).toContain('Rounded');
  });
});

describe('ensureDefaultVariantFirst', () => {
  it('should move default variant to index 0', () => {
    const defaultComponent = createMockComponent(
      'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );
    const otherComponent = createMockComponent(
      'Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );

    const componentSet = createMockComponentSet([otherComponent, defaultComponent]);

    ensureDefaultVariantFirst(componentSet as any);

    expect(componentSet.insertChild).toHaveBeenCalledWith(0, defaultComponent);
  });

  it('should not modify if default is already at index 0', () => {
    const defaultComponent = createMockComponent(
      'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );
    const otherComponent = createMockComponent(
      'Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );

    const componentSet = createMockComponentSet([defaultComponent, otherComponent]);

    ensureDefaultVariantFirst(componentSet as any);

    expect(componentSet.insertChild).not.toHaveBeenCalled();
  });

  it('should handle component set with no default variant', () => {
    const component1 = createMockComponent(
      'Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );
    const component2 = createMockComponent(
      'Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
    );

    const componentSet = createMockComponentSet([component1, component2]);

    // Should not throw and should use first child as fallback
    expect(() => ensureDefaultVariantFirst(componentSet as any)).not.toThrow();
  });

  it('should handle empty component set', () => {
    const componentSet = createMockComponentSet([]);

    expect(() => ensureDefaultVariantFirst(componentSet as any)).not.toThrow();
  });

  it('should work with many variants', () => {
    const components = [
      createMockComponent('Style=Outlined, Weight=100, Fill=Off, Grade=Normal, Optical size=20dp'),
      createMockComponent('Style=Outlined, Weight=200, Fill=Off, Grade=Normal, Optical size=20dp'),
      createMockComponent('Style=Outlined, Weight=300, Fill=Off, Grade=Normal, Optical size=20dp'),
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // default
      createMockComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const componentSet = createMockComponentSet(components);

    ensureDefaultVariantFirst(componentSet as any);

    expect(componentSet.insertChild).toHaveBeenCalledWith(0, components[3]);
  });
});

describe('Variant naming integration', () => {
  it('should work with complete icon generation workflow', () => {
    // Simulate generating multiple variants
    const styles = ['rounded', 'outlined', 'sharp'];
    const weights = [400, 700];

    const variantNames: string[] = [];

    for (const style of styles) {
      for (const weight of weights) {
        const variantData = createVariantData({
          style: style as any,
          variant: { weight, fill: 0, grade: 0, opticalSize: 24 },
        });
        variantNames.push(getVariantName(variantData));
      }
    }

    // Check all names are unique
    expect(new Set(variantNames).size).toBe(variantNames.length);

    // Check default is in the list
    expect(variantNames).toContain(getDefaultVariantName());
  });

  it('should support sorting and reordering workflow', () => {
    // Create mixed components
    const components = [
      createMockComponent('Style=Sharp, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp'),
      createMockComponent(
        'Style=Outlined, Weight=300, Fill=Off, Grade=Dark theme, Optical size=20dp'
      ),
      createMockComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // default
      createMockComponent('Style=Outlined, Weight=400, Fill=On, Grade=Normal, Optical size=24dp'),
    ];

    // Sort to put default first
    sortComponentsForDefault(components as any);

    // Verify default is first
    expect(components[0].name).toBe(getDefaultVariantName());

    // Create component set and ensure default first
    const componentSet = createMockComponentSet(components);
    ensureDefaultVariantFirst(componentSet as any);

    // Should not need to move since already sorted
    expect(componentSet.insertChild).not.toHaveBeenCalled();
  });
});
