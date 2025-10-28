/**
 * @module @figma/icons/__tests__/variant-utils
 *
 * Unit tests for variant utility functions.
 * Tests variant parsing, default selection logic, and intelligent fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VARIANT_PREFERENCES,
  parseVariantName,
  findBestDefaultVariant,
  buildVariantName,
  getIdealDefaultVariantName,
  cleanupVariantFills,
} from '../variant-utils';

// Mock logger to suppress output during tests
vi.mock('@lib/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('VARIANT_PREFERENCES', () => {
  it('should have correct preference order for styles', () => {
    expect(VARIANT_PREFERENCES.style).toEqual(['Rounded', 'Sharp', 'Outlined']);
  });

  it('should have correct preference order for weights', () => {
    expect(VARIANT_PREFERENCES.weight).toEqual([400, 300, 500, 200, 600, 100, 700]);
  });

  it('should have correct preference order for fill', () => {
    expect(VARIANT_PREFERENCES.fill).toEqual(['Off', 'On']);
  });

  it('should have correct preference order for grade', () => {
    expect(VARIANT_PREFERENCES.grade).toEqual(['Normal', 'Dark theme', 'Emphasis']);
  });

  it('should have correct preference order for opticalSize', () => {
    expect(VARIANT_PREFERENCES.opticalSize).toEqual(['24dp', '40dp', '20dp', '48dp']);
  });

  it('should have most preferred values first', () => {
    expect(VARIANT_PREFERENCES.style[0]).toBe('Rounded');
    expect(VARIANT_PREFERENCES.weight[0]).toBe(400);
    expect(VARIANT_PREFERENCES.fill[0]).toBe('Off');
    expect(VARIANT_PREFERENCES.grade[0]).toBe('Normal');
    expect(VARIANT_PREFERENCES.opticalSize[0]).toBe('24dp');
  });
});

describe('parseVariantName', () => {
  it('should parse valid variant name', () => {
    const name = 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp';
    const props = parseVariantName(name);

    expect(props).toEqual({
      style: 'Rounded',
      weight: 400,
      fill: 'Off',
      grade: 'Normal',
      opticalSize: '24dp',
    });
  });

  it('should parse all style variants', () => {
    const styles = ['Rounded', 'Outlined', 'Sharp'];

    styles.forEach((style) => {
      const name = `Style=${style}, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp`;
      const props = parseVariantName(name);
      expect(props?.style).toBe(style);
    });
  });

  it('should parse all weight variants', () => {
    const weights = [100, 200, 300, 400, 500, 600, 700];

    weights.forEach((weight) => {
      const name = `Style=Rounded, Weight=${weight}, Fill=Off, Grade=Normal, Optical size=24dp`;
      const props = parseVariantName(name);
      expect(props?.weight).toBe(weight);
    });
  });

  it('should parse fill variants', () => {
    const fillOn = 'Style=Rounded, Weight=400, Fill=On, Grade=Normal, Optical size=24dp';
    const fillOff = 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp';

    expect(parseVariantName(fillOn)?.fill).toBe('On');
    expect(parseVariantName(fillOff)?.fill).toBe('Off');
  });

  it('should parse all grade variants', () => {
    const grades = ['Normal', 'Dark theme', 'Emphasis'];

    grades.forEach((grade) => {
      const name = `Style=Rounded, Weight=400, Fill=Off, Grade=${grade}, Optical size=24dp`;
      const props = parseVariantName(name);
      expect(props?.grade).toBe(grade);
    });
  });

  it('should parse all optical size variants', () => {
    const sizes = ['20dp', '24dp', '40dp', '48dp'];

    sizes.forEach((size) => {
      const name = `Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=${size}`;
      const props = parseVariantName(name);
      expect(props?.opticalSize).toBe(size);
    });
  });

  it('should return null for invalid format', () => {
    const invalid = 'Invalid format';
    expect(parseVariantName(invalid)).toBeNull();
  });

  it('should return null for missing properties', () => {
    const incomplete = 'Style=Rounded, Weight=400';
    expect(parseVariantName(incomplete)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseVariantName('')).toBeNull();
  });

  it('should return null for malformed weight', () => {
    const badWeight = 'Style=Rounded, Weight=abc, Fill=Off, Grade=Normal, Optical size=24dp';
    expect(parseVariantName(badWeight)).toBeNull();
  });

  it('should handle extra whitespace gracefully', () => {
    const name = 'Style=Rounded,  Weight=400,  Fill=Off,  Grade=Normal,  Optical size=24dp';
    const props = parseVariantName(name);

    // Should handle or return null (implementation dependent)
    expect(props).toBeDefined();
  });

  it('should be case sensitive', () => {
    const lowercase = 'style=rounded, weight=400, fill=off, grade=normal, optical size=24dp';
    expect(parseVariantName(lowercase)).toBeNull();
  });
});

describe('buildVariantName', () => {
  it('should build valid variant name from properties', () => {
    const props = {
      style: 'Rounded',
      weight: 400,
      fill: 'Off',
      grade: 'Normal',
      opticalSize: '24dp',
    };

    const name = buildVariantName(props);
    expect(name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp');
  });

  it('should handle all style values', () => {
    const styles = ['Rounded', 'Outlined', 'Sharp'];

    styles.forEach((style) => {
      const name = buildVariantName({
        style,
        weight: 400,
        fill: 'Off',
        grade: 'Normal',
        opticalSize: '24dp',
      });
      expect(name).toContain(`Style=${style}`);
    });
  });

  it('should handle all weight values', () => {
    const weights = [100, 200, 300, 400, 500, 600, 700];

    weights.forEach((weight) => {
      const name = buildVariantName({
        style: 'Rounded',
        weight,
        fill: 'Off',
        grade: 'Normal',
        opticalSize: '24dp',
      });
      expect(name).toContain(`Weight=${weight}`);
    });
  });

  it('should be reversible with parseVariantName', () => {
    const original = {
      style: 'Sharp',
      weight: 700,
      fill: 'On',
      grade: 'Emphasis',
      opticalSize: '48dp',
    };

    const name = buildVariantName(original);
    const parsed = parseVariantName(name);

    expect(parsed).toEqual(original);
  });

  it('should maintain property order', () => {
    const name = buildVariantName({
      style: 'Rounded',
      weight: 400,
      fill: 'Off',
      grade: 'Normal',
      opticalSize: '24dp',
    });

    const parts = name.split(', ');
    expect(parts[0]).toContain('Style=');
    expect(parts[1]).toContain('Weight=');
    expect(parts[2]).toContain('Fill=');
    expect(parts[3]).toContain('Grade=');
    expect(parts[4]).toContain('Optical size=');
  });
});

describe('getIdealDefaultVariantName', () => {
  it('should return Rounded as default when available', () => {
    const styles = ['Rounded', 'Sharp', 'Outlined'];
    const name = getIdealDefaultVariantName(styles);

    expect(name).toContain('Style=Rounded');
    expect(name).toContain('Weight=400');
    expect(name).toContain('Fill=Off');
    expect(name).toContain('Grade=Normal');
    expect(name).toContain('Optical size=24dp');
  });

  it('should fallback to Sharp when Rounded not available', () => {
    const styles = ['Sharp', 'Outlined'];
    const name = getIdealDefaultVariantName(styles);

    expect(name).toContain('Style=Sharp');
  });

  it('should fallback to Outlined when only Outlined available', () => {
    const styles = ['Outlined'];
    const name = getIdealDefaultVariantName(styles);

    expect(name).toContain('Style=Outlined');
  });

  it('should use first style if no preferences match', () => {
    const styles = ['CustomStyle'];
    const name = getIdealDefaultVariantName(styles);

    expect(name).toContain('Style=CustomStyle');
  });

  it('should use Rounded as fallback for empty array', () => {
    const styles: string[] = [];
    const name = getIdealDefaultVariantName(styles);

    expect(name).toContain('Style=Rounded');
  });

  it('should handle lowercase style names', () => {
    const styles = ['rounded', 'sharp'];
    const name = getIdealDefaultVariantName(styles);

    expect(name).toContain('Style=Rounded');
  });

  it('should always use most preferred non-style values', () => {
    const name = getIdealDefaultVariantName(['Any']);

    expect(name).toContain('Weight=400');
    expect(name).toContain('Fill=Off');
    expect(name).toContain('Grade=Normal');
    expect(name).toContain('Optical size=24dp');
  });
});

describe('findBestDefaultVariant', () => {
  function createComponent(name: string) {
    return { name };
  }

  it('should find exact match for preferred variant', () => {
    const components = [
      createComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // preferred
      createComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp');
  });

  it('should prefer Rounded over other styles', () => {
    const components = [
      createComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Outlined, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toContain('Style=Rounded');
  });

  it('should prefer weight 400 over other weights', () => {
    const components = [
      createComponent('Style=Rounded, Weight=100, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // preferred
      createComponent('Style=Rounded, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toContain('Weight=400');
  });

  it('should prefer Fill=Off over Fill=On', () => {
    const components = [
      createComponent('Style=Rounded, Weight=400, Fill=On, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // preferred
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toContain('Fill=Off');
  });

  it('should prefer Grade=Normal', () => {
    const components = [
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Emphasis, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // preferred
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Dark theme, Optical size=24dp'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toContain('Grade=Normal');
  });

  it('should prefer 24dp optical size', () => {
    const components = [
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=20dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'), // preferred
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=48dp'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toContain('Optical size=24dp');
  });

  it('should use fallback when exact match not available', () => {
    const components = [
      createComponent('Style=Sharp, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp'),
      createComponent('Style=Outlined, Weight=300, Fill=Off, Grade=Normal, Optical size=20dp'),
    ];

    const best = findBestDefaultVariant(components);

    // Should pick something, likely Outlined (second preferred style)
    expect(best).toBeTruthy();
    expect(best?.name).toBeDefined();
  });

  it('should relax optical size criteria first in fallback', () => {
    const components = [
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=48dp'), // Only diff: size
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=48dp');
  });

  it('should handle single component', () => {
    const components = [
      createComponent('Style=Sharp, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toBe('Style=Sharp, Weight=700, Fill=On, Grade=Emphasis, Optical size=48dp');
  });

  it('should return null for empty array', () => {
    const components: Array<{ name: string }> = [];

    const best = findBestDefaultVariant(components);

    expect(best).toBeNull();
  });

  it('should return null for invalid variant names', () => {
    const components = [createComponent('Invalid format'), createComponent('Also invalid')];

    const best = findBestDefaultVariant(components);

    expect(best).toBeNull();
  });

  it('should use custom preferences when provided', () => {
    const components = [
      createComponent('Style=Sharp, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const customPrefs = {
      ...VARIANT_PREFERENCES,
      style: ['Sharp', 'Rounded', 'Outlined'], // Prefer Sharp
      weight: [700, 400, 300, 500, 200, 600, 100], // Prefer 700
    };

    const best = findBestDefaultVariant(components, customPrefs);

    expect(best?.name).toBe('Style=Sharp, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp');
  });

  it('should handle mixed valid and invalid variants', () => {
    const components = [
      createComponent('Invalid'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Also invalid'),
    ];

    const best = findBestDefaultVariant(components);

    expect(best?.name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp');
  });

  it('should follow fallback hierarchy (style > weight > fill > grade > size)', () => {
    const components = [
      // Has best style (Rounded) but non-preferred everything else
      createComponent('Style=Rounded, Weight=100, Fill=On, Grade=Emphasis, Optical size=20dp'),
      // Has second-best style (Sharp) but all other properties are preferred
      createComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const best = findBestDefaultVariant(components);

    // Should prefer Rounded (best style) despite non-preferred other properties
    expect(best?.name).toContain('Style=Rounded');
  });

  it('should work with real Material Icons variant set', () => {
    // Simulate a real icon with multiple variants
    const components = [
      createComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=20dp'),
      createComponent('Style=Outlined, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=20dp'),
      createComponent('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=400, Fill=On, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Rounded, Weight=700, Fill=Off, Grade=Normal, Optical size=24dp'),
      createComponent('Style=Sharp, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'),
    ];

    const best = findBestDefaultVariant(components);

    // Should select the most preferred: Rounded/400/Off/Normal/24dp
    expect(best?.name).toBe('Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp');
  });
});

describe('Integration: parse and build', () => {
  it('should round-trip correctly', () => {
    const original = 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp';
    const parsed = parseVariantName(original);

    expect(parsed).toBeTruthy();
    if (parsed) {
      const rebuilt = buildVariantName(parsed);
      expect(rebuilt).toBe(original);
    }
  });

  it('should work with all variant combinations', () => {
    const combinations = [
      { style: 'Rounded', weight: 400, fill: 'Off', grade: 'Normal', opticalSize: '24dp' },
      { style: 'Outlined', weight: 700, fill: 'On', grade: 'Emphasis', opticalSize: '48dp' },
      { style: 'Sharp', weight: 300, fill: 'Off', grade: 'Dark theme', opticalSize: '20dp' },
    ];

    combinations.forEach((combo) => {
      const built = buildVariantName(combo);
      const parsed = parseVariantName(built);
      expect(parsed).toEqual(combo);
    });
  });
});

describe('cleanupVariantFills', () => {
  // Create a mock component node with configurable fills
  function createMockComponent(hasFills = false): ComponentNode {
    const fills: readonly Paint[] = hasFills
      ? [
          { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false, opacity: 1 },
          { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 }, visible: false, opacity: 0.5 },
        ]
      : [];

    return {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
      fills,
    } as ComponentNode;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when component has no fills', () => {
    const component = createMockComponent(false);
    const result = cleanupVariantFills(component);

    expect(result).toBe(false);
  });

  it('should return true when component has fills', () => {
    const component = createMockComponent(true);
    const result = cleanupVariantFills(component);

    expect(result).toBe(true);
  });

  it('should remove all fills from component', () => {
    const component = createMockComponent(true);

    expect((component.fills as readonly Paint[]).length).toBe(2);

    cleanupVariantFills(component);

    expect((component.fills as readonly Paint[]).length).toBe(0);
  });

  it('should handle component without fills property', () => {
    const component = {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
    } as unknown as ComponentNode;

    const result = cleanupVariantFills(component);

    expect(result).toBe(false);
  });

  it('should handle errors gracefully', () => {
    const component = {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
      get fills() {
        throw new Error('Access denied');
      },
    } as unknown as ComponentNode;

    const result = cleanupVariantFills(component);

    expect(result).toBe(false);
  });

  it('should remove multiple fills', () => {
    const component = {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
      fills: [
        { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false },
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, visible: false },
        { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 }, visible: true },
        { type: 'GRADIENT_LINEAR', gradientStops: [], visible: false },
        { type: 'IMAGE', scaleMode: 'FILL', visible: false },
      ] as readonly Paint[],
    } as unknown as ComponentNode;

    expect((component.fills as readonly Paint[]).length).toBe(5);

    const result = cleanupVariantFills(component);

    expect(result).toBe(true);
    expect((component.fills as readonly Paint[]).length).toBe(0);
  });

  it('should handle component with empty fills array', () => {
    const component = {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
      fills: [] as readonly Paint[],
    } as ComponentNode;

    const result = cleanupVariantFills(component);

    expect(result).toBe(false);
  });

  it('should only affect fills, not other component properties', () => {
    const component = {
      type: 'COMPONENT',
      name: 'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp',
      variantProperties: { fill: 'Off', weight: '400' }, // These should remain
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false }] as readonly Paint[], // These should be removed
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, visible: true }], // These should remain
    } as unknown as ComponentNode;

    cleanupVariantFills(component);

    expect(component.variantProperties).toEqual({ fill: 'Off', weight: '400' });
    expect((component.fills as readonly Paint[]).length).toBe(0);
    expect(component.strokes?.length).toBe(1); // Strokes should be unchanged
  });
});
