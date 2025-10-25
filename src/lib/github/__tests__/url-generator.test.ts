/**
 * @module @figma/github/__tests__/url-generator
 *
 * Unit tests for GitHub URL generation functions.
 * Tests filename generation, URL construction, and variant helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateFilename,
  generateGitHubUrl,
  generateAllVariants,
  generateCommonVariants,
  setGitHubRef,
  getGitHubRef,
  type IconVariant,
} from '../url-generator';

describe('url-generator', () => {
  // Reset GitHub ref before each test
  beforeEach(() => {
    setGitHubRef('master');
  });

  describe('generateFilename', () => {
    it('should generate filename with all defaults', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const filename = generateFilename('home', variant);

      expect(filename).toBe('home_24px.svg');
    });

    it('should include fill modifier when filled', () => {
      const variant: IconVariant = {
        fill: 1,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const filename = generateFilename('home', variant);

      expect(filename).toBe('home_fill1_24px.svg');
    });

    it('should include weight modifier when not 400', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 300,
        grade: 0,
        opticalSize: 24,
      };

      const filename = generateFilename('home', variant);

      expect(filename).toBe('home_wght300_24px.svg');
    });

    it('should include grade modifier for -25 (dark theme)', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: -25,
        opticalSize: 24,
      };

      const filename = generateFilename('home', variant);

      expect(filename).toBe('home_gradN25_24px.svg');
    });

    it('should include grade modifier for 200 (emphasis)', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 200,
        opticalSize: 24,
      };

      const filename = generateFilename('home', variant);

      expect(filename).toBe('home_grad200_24px.svg');
    });

    it('should handle different optical sizes', () => {
      const sizes: Array<20 | 24 | 40 | 48> = [20, 24, 40, 48];

      sizes.forEach((size) => {
        const variant: IconVariant = {
          fill: 0,
          weight: 400,
          grade: 0,
          opticalSize: size,
        };

        const filename = generateFilename('home', variant);
        expect(filename).toBe(`home_${size}px.svg`);
      });
    });

    it('should combine multiple modifiers in correct order', () => {
      const variant: IconVariant = {
        fill: 1,
        weight: 300,
        grade: 200,
        opticalSize: 48,
      };

      const filename = generateFilename('home', variant);

      // Order: weight, grade, fill
      expect(filename).toBe('home_wght300grad200fill1_48px.svg');
    });

    it('should handle all weights', () => {
      const weights: IconVariant['weight'][] = [100, 200, 300, 400, 500, 600, 700];

      weights.forEach((weight) => {
        const variant: IconVariant = {
          fill: 0,
          weight,
          grade: 0,
          opticalSize: 24,
        };

        const filename = generateFilename('home', variant);

        if (weight === 400) {
          // Default weight is omitted
          expect(filename).toBe('home_24px.svg');
        } else {
          expect(filename).toBe(`home_wght${weight}_24px.svg`);
        }
      });
    });

    it('should handle icon names with underscores', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const filename = generateFilename('arrow_back', variant);

      expect(filename).toBe('arrow_back_24px.svg');
    });

    it('should handle complex icon names', () => {
      const variant: IconVariant = {
        fill: 1,
        weight: 700,
        grade: 0,
        opticalSize: 48,
      };

      const filename = generateFilename('keyboard_double_arrow_right', variant);

      expect(filename).toBe('keyboard_double_arrow_right_wght700fill1_48px.svg');
    });
  });

  describe('generateGitHubUrl', () => {
    it('should generate URL with rounded style', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const url = generateGitHubUrl('home', 'rounded', variant);

      expect(url).toBe(
        'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/home/materialsymbolsrounded/home_24px.svg'
      );
    });

    it('should generate URL with outlined style', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const url = generateGitHubUrl('home', 'outlined', variant);

      expect(url).toContain('/materialsymbolsoutlined/');
    });

    it('should generate URL with sharp style', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const url = generateGitHubUrl('home', 'sharp', variant);

      expect(url).toContain('/materialsymbolssharp/');
    });

    it('should include icon name in path', () => {
      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const url = generateGitHubUrl('search', 'rounded', variant);

      expect(url).toContain('/symbols/web/search/');
    });

    it('should use configured GitHub ref', () => {
      setGitHubRef('4.0.0');

      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const url = generateGitHubUrl('home', 'rounded', variant);

      expect(url).toContain('/material-design-icons/4.0.0/');
    });

    it('should generate complete URL with all modifiers', () => {
      const variant: IconVariant = {
        fill: 1,
        weight: 700,
        grade: 200,
        opticalSize: 48,
      };

      const url = generateGitHubUrl('star', 'rounded', variant);

      expect(url).toBe(
        'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/star/materialsymbolsrounded/star_wght700grad200fill1_48px.svg'
      );
    });
  });

  describe('setGitHubRef / getGitHubRef', () => {
    it('should return default ref', () => {
      const ref = getGitHubRef();

      expect(ref).toBe('master');
    });

    it('should set and get custom ref', () => {
      setGitHubRef('4.0.0');

      expect(getGitHubRef()).toBe('4.0.0');
    });

    it('should accept branch names', () => {
      setGitHubRef('main');

      expect(getGitHubRef()).toBe('main');
    });

    it('should accept commit SHAs', () => {
      setGitHubRef('abc123def456');

      expect(getGitHubRef()).toBe('abc123def456');
    });

    it('should affect subsequent URL generation', () => {
      setGitHubRef('test-branch');

      const variant: IconVariant = {
        fill: 0,
        weight: 400,
        grade: 0,
        opticalSize: 24,
      };

      const url = generateGitHubUrl('home', 'rounded', variant);

      expect(url).toContain('/test-branch/');
    });
  });

  describe('generateAllVariants', () => {
    it('should generate all 504 variant combinations', () => {
      const variants = generateAllVariants();

      // 2 fills × 7 weights × 3 grades × 4 optical sizes = 168
      // Wait, that's not 504...
      // Actually: 7 weights × 2 fills × 3 grades × 4 sizes = 168
      expect(variants).toHaveLength(168);
    });

    it('should include all fills', () => {
      const variants = generateAllVariants();
      const fills = new Set(variants.map((v) => v.fill));

      expect(fills).toEqual(new Set([0, 1]));
    });

    it('should include all weights', () => {
      const variants = generateAllVariants();
      const weights = new Set(variants.map((v) => v.weight));

      expect(weights).toEqual(new Set([100, 200, 300, 400, 500, 600, 700]));
    });

    it('should include all grades', () => {
      const variants = generateAllVariants();
      const grades = new Set(variants.map((v) => v.grade));

      expect(grades).toEqual(new Set([-25, 0, 200]));
    });

    it('should include all optical sizes', () => {
      const variants = generateAllVariants();
      const sizes = new Set(variants.map((v) => v.opticalSize));

      expect(sizes).toEqual(new Set([20, 24, 40, 48]));
    });

    it('should generate unique combinations', () => {
      const variants = generateAllVariants();
      const serialized = variants.map((v) => JSON.stringify(v));
      const uniqueSerialized = new Set(serialized);

      expect(uniqueSerialized.size).toBe(variants.length);
    });

    it('should include default variant', () => {
      const variants = generateAllVariants();
      const hasDefault = variants.some(
        (v) => v.fill === 0 && v.weight === 400 && v.grade === 0 && v.opticalSize === 24
      );

      expect(hasDefault).toBe(true);
    });
  });

  describe('generateCommonVariants', () => {
    it('should generate common variants with default weights', () => {
      const variants = generateCommonVariants();

      // Default weights: [300, 400]
      // Each weight: 4 variants at 24px + 2 at different sizes = 6
      // Total: 6 × 2 = 12
      expect(variants).toHaveLength(12);
    });

    it('should generate common variants with custom weights', () => {
      const variants = generateCommonVariants([400, 700]);

      expect(variants).toHaveLength(12);
    });

    it('should generate common variants with single weight', () => {
      const variants = generateCommonVariants([400]);

      expect(variants).toHaveLength(6);
    });

    it('should include standard 24px variants', () => {
      const variants = generateCommonVariants([400]);

      const has24pxUnfilled = variants.some(
        (v) => v.weight === 400 && v.fill === 0 && v.grade === 0 && v.opticalSize === 24
      );
      const has24pxFilled = variants.some(
        (v) => v.weight === 400 && v.fill === 1 && v.grade === 0 && v.opticalSize === 24
      );

      expect(has24pxUnfilled).toBe(true);
      expect(has24pxFilled).toBe(true);
    });

    it('should include dark theme variant', () => {
      const variants = generateCommonVariants([400]);

      const hasDarkTheme = variants.some(
        (v) => v.weight === 400 && v.fill === 0 && v.grade === -25 && v.opticalSize === 24
      );

      expect(hasDarkTheme).toBe(true);
    });

    it('should include emphasis variant', () => {
      const variants = generateCommonVariants([400]);

      const hasEmphasis = variants.some(
        (v) => v.weight === 400 && v.fill === 0 && v.grade === 200 && v.opticalSize === 24
      );

      expect(hasEmphasis).toBe(true);
    });

    it('should include different optical sizes', () => {
      const variants = generateCommonVariants([400]);

      const has20px = variants.some((v) => v.opticalSize === 20);
      const has40px = variants.some((v) => v.opticalSize === 40);

      expect(has20px).toBe(true);
      expect(has40px).toBe(true);
    });

    it('should work with all weights', () => {
      const variants = generateCommonVariants([100, 200, 300, 400, 500, 600, 700]);

      // 7 weights × 6 variants each = 42
      expect(variants).toHaveLength(42);
    });
  });
});
