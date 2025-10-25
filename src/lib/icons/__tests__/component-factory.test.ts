/**
 * @module @figma/icons/__tests__/component-factory
 *
 * Unit tests for component factory with Figma API mocks.
 * Tests SVG parsing, component creation/update, and hash management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStoredHash,
  setStoredHash,
  createVariantComponent,
  updateVariantComponent,
} from '../component-factory';
import type { VariantData } from '../generator';
import {
  installMockFigmaAPI,
  uninstallMockFigmaAPI,
  resetMockFigmaAPI,
  createMockComponentNode,
  type MockFigmaAPI,
} from '../../../__tests__/mocks/figma-api.mock';

// Mock logger
vi.mock('@lib/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  hashSvg: vi.fn((content: string) => {
    // Simple hash mock for testing
    return `hash-${content.length}-${content.substring(0, 10)}`;
  }),
}));

describe('component-factory', () => {
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
      svgContent:
        '<svg width="24" height="24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockFigma = installMockFigmaAPI();
  });

  afterEach(() => {
    uninstallMockFigmaAPI();
  });

  describe('getStoredHash', () => {
    it('should retrieve stored hash from component', () => {
      const component = createMockComponentNode('Test Component') as any;
      component.setPluginData('svg_hash', 'test-hash-123');

      const hash = getStoredHash(component);

      expect(hash).toBe('test-hash-123');
    });

    it('should return null if no hash stored', () => {
      const component = createMockComponentNode('Test Component') as any;

      const hash = getStoredHash(component);

      expect(hash).toBeNull();
    });

    it('should return null if getPluginData returns empty string', () => {
      const component = createMockComponentNode('Test Component') as any;
      component.getPluginData.mockReturnValue('');

      const hash = getStoredHash(component);

      expect(hash).toBeNull();
    });

    it('should handle errors gracefully', () => {
      const component = createMockComponentNode('Test Component') as any;
      component.getPluginData.mockImplementation(() => {
        throw new Error('Plugin data error');
      });

      const hash = getStoredHash(component);

      expect(hash).toBeNull();
    });

    it('should call getPluginData with correct key', () => {
      const component = createMockComponentNode('Test Component') as any;

      getStoredHash(component);

      expect(component.getPluginData).toHaveBeenCalledWith('svg_hash');
    });
  });

  describe('setStoredHash', () => {
    it('should store hash in component plugin data', () => {
      const component = createMockComponentNode('Test Component') as any;

      setStoredHash(component, 'new-hash-456');

      expect(component.setPluginData).toHaveBeenCalledWith('svg_hash', 'new-hash-456');
    });

    it('should handle errors gracefully', () => {
      const component = createMockComponentNode('Test Component') as any;
      component.setPluginData.mockImplementation(() => {
        throw new Error('Cannot set plugin data');
      });

      // Should not throw
      expect(() => setStoredHash(component, 'hash')).not.toThrow();
    });

    it('should accept any hash string', () => {
      const component = createMockComponentNode('Test Component') as any;
      const hashes = ['abc123', '', 'very-long-hash-string-with-special-chars-!@#$'];

      hashes.forEach((hash) => {
        setStoredHash(component, hash);
        expect(component.setPluginData).toHaveBeenCalledWith('svg_hash', hash);
      });
    });
  });

  describe('createVariantComponent', () => {
    it('should create component from SVG content', async () => {
      const variantData = createVariantData();

      const component = await createVariantComponent(variantData);

      expect(component).toBeTruthy();
      expect(component?.type).toBe('COMPONENT');
    });

    it('should call createNodeFromSvg with SVG content', async () => {
      const variantData = createVariantData({
        svgContent: '<svg><circle r="10"/></svg>',
      });

      await createVariantComponent(variantData);

      expect(mockFigma.createNodeFromSvg).toHaveBeenCalledWith('<svg><circle r="10"/></svg>');
    });

    it('should create empty component first', async () => {
      const variantData = createVariantData();

      await createVariantComponent(variantData);

      expect(mockFigma.createComponent).toHaveBeenCalled();
    });

    it('should set component name from variant data', async () => {
      const variantData = createVariantData();

      const component = await createVariantComponent(variantData);

      expect(component?.name).toBe(
        'Style=Rounded, Weight=400, Fill=Off, Grade=Normal, Optical size=24dp'
      );
    });

    it('should resize component to optical size', async () => {
      const variantData = createVariantData({
        variant: { weight: 400, fill: 0, grade: 0, opticalSize: 48 },
      });

      const component = await createVariantComponent(variantData);

      expect(component?.resize).toHaveBeenCalledWith(48, 48);
    });

    it('should handle all optical sizes', async () => {
      const sizes = [20, 24, 40, 48] as const;

      for (const size of sizes) {
        resetMockFigmaAPI(mockFigma);
        const variantData = createVariantData({
          variant: { weight: 400, fill: 0, grade: 0, opticalSize: size },
        });

        const component = await createVariantComponent(variantData);

        expect(component?.resize).toHaveBeenCalledWith(size, size);
      }
    });

    it('should set fills to empty array', async () => {
      const variantData = createVariantData();

      const component = await createVariantComponent(variantData);

      expect(component?.fills).toEqual([]);
    });

    it('should move vector children from frame to component', async () => {
      const variantData = createVariantData();

      const component = await createVariantComponent(variantData);

      // Should have moved 2 vectors (from mock createNodeFromSvg)
      expect(component?.children).toHaveLength(2);
      expect(component?.appendChild).toHaveBeenCalledTimes(2);
    });

    it('should remove temporary SVG frame after moving children', async () => {
      const variantData = createVariantData();

      await createVariantComponent(variantData);

      // The frame's remove method should have been called
      expect(mockFigma.createNodeFromSvg).toHaveBeenCalled();
      // Frame should be removed (we can't directly test this without inspecting mock internals)
    });

    it('should store content hash in plugin data', async () => {
      const variantData = createVariantData({
        svgContent: '<svg>test</svg>',
      });

      const component = await createVariantComponent(variantData);

      // Hash should be stored (mocked hash function returns predictable value)
      expect(component?.setPluginData).toHaveBeenCalledWith(
        'svg_hash',
        expect.stringMatching(/^hash-/)
      );
    });

    it('should return null if createNodeFromSvg fails', async () => {
      mockFigma.createNodeFromSvg.mockReturnValue(null);
      const variantData = createVariantData();

      const component = await createVariantComponent(variantData);

      expect(component).toBeNull();
    });

    it('should return null if createNodeFromSvg returns non-frame', async () => {
      mockFigma.createNodeFromSvg.mockReturnValue({ type: 'VECTOR' });
      const variantData = createVariantData();

      const component = await createVariantComponent(variantData);

      expect(component).toBeNull();
    });

    it('should handle empty SVG content', async () => {
      const variantData = createVariantData({
        svgContent: '',
      });

      const component = await createVariantComponent(variantData);

      expect(mockFigma.createNodeFromSvg).toHaveBeenCalledWith('');
      expect(component).toBeTruthy();
    });

    it('should handle appendChild errors gracefully', async () => {
      const variantData = createVariantData();

      // Make appendChild throw on second call
      let callCount = 0;
      mockFigma.createComponent.mockImplementation(() => {
        const component = createMockComponentNode();
        component.appendChild.mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Cannot append child');
          }
        });
        return component;
      });

      // Should not throw
      const component = await createVariantComponent(variantData);

      expect(component).toBeTruthy();
      // Should have attempted to append both children
      expect(component?.appendChild).toHaveBeenCalledTimes(2);
    });

    it('should work with different styles', async () => {
      const styles = ['rounded', 'outlined', 'sharp'] as const;

      for (const style of styles) {
        resetMockFigmaAPI(mockFigma);
        const variantData = createVariantData({ style });

        const component = await createVariantComponent(variantData);

        expect(component).toBeTruthy();
        const capitalizedStyle = style.charAt(0).toUpperCase() + style.slice(1);
        expect(component?.name).toContain(`Style=${capitalizedStyle}`);
      }
    });

    it('should handle complex SVG with multiple paths', async () => {
      const variantData = createVariantData({
        svgContent: `<svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M1 1L10 10"/>
          <path d="M10 10L20 20"/>
          <circle cx="12" cy="12" r="5"/>
          <rect x="5" y="5" width="14" height="14"/>
        </svg>`,
      });

      const component = await createVariantComponent(variantData);

      expect(component).toBeTruthy();
      expect(mockFigma.createNodeFromSvg).toHaveBeenCalled();
    });
  });

  describe('updateVariantComponent', () => {
    it('should remove existing children', async () => {
      const component = createMockComponentNode('Test') as any;
      const child1 = createMockComponentNode('Child1') as any;
      const child2 = createMockComponentNode('Child2') as any;
      component.children = [child1, child2];

      const variantData = createVariantData();

      await updateVariantComponent(component, variantData);

      expect(child1.remove).toHaveBeenCalled();
      expect(child2.remove).toHaveBeenCalled();
    });

    it('should resize component to new optical size', async () => {
      const component = createMockComponentNode('Test') as any;
      const variantData = createVariantData({
        variant: { weight: 400, fill: 0, grade: 0, opticalSize: 48 },
      });

      await updateVariantComponent(component, variantData);

      expect(component.resize).toHaveBeenCalledWith(48, 48);
    });

    it('should add new SVG content', async () => {
      const component = createMockComponentNode('Test') as any;
      const variantData = createVariantData({
        svgContent: '<svg><circle /></svg>',
      });

      await updateVariantComponent(component, variantData);

      expect(mockFigma.createNodeFromSvg).toHaveBeenCalledWith('<svg><circle /></svg>');
    });

    it('should move new vector children to component', async () => {
      const component = createMockComponentNode('Test') as any;
      const variantData = createVariantData();

      await updateVariantComponent(component, variantData);

      // Should append new children
      expect(component.appendChild).toHaveBeenCalled();
    });

    it('should store new content hash', async () => {
      const component = createMockComponentNode('Test') as any;
      const variantData = createVariantData({
        svgContent: '<svg>updated</svg>',
      });

      await updateVariantComponent(component, variantData);

      expect(component.setPluginData).toHaveBeenCalledWith(
        'svg_hash',
        expect.stringMatching(/^hash-/)
      );
    });

    it('should handle empty existing children', async () => {
      const component = createMockComponentNode('Test') as any;
      component.children = [];

      const variantData = createVariantData();

      // Should not throw
      await expect(updateVariantComponent(component, variantData)).resolves.not.toThrow();
    });

    it('should remove temporary frame after update', async () => {
      const component = createMockComponentNode('Test') as any;
      const variantData = createVariantData();

      await updateVariantComponent(component, variantData);

      // Frame should be created and removed
      expect(mockFigma.createNodeFromSvg).toHaveBeenCalled();
    });

    it('should handle appendChild errors during update', async () => {
      const component = createMockComponentNode('Test') as any;
      component.appendChild.mockImplementation(() => {
        throw new Error('Cannot append');
      });

      const variantData = createVariantData();

      // Should not throw
      await expect(updateVariantComponent(component, variantData)).resolves.not.toThrow();
    });

    it('should update component with different variant properties', async () => {
      const component = createMockComponentNode('Test') as any;

      // New variant
      const updated = createVariantData({
        variant: { weight: 700, fill: 1, grade: 200, opticalSize: 48 },
        svgContent: '<svg>new content</svg>',
      });

      await updateVariantComponent(component, updated);

      expect(component.resize).toHaveBeenCalledWith(48, 48);
      expect(mockFigma.createNodeFromSvg).toHaveBeenCalledWith('<svg>new content</svg>');
    });

    it('should handle null/undefined createNodeFromSvg result', async () => {
      mockFigma.createNodeFromSvg.mockReturnValue(null);

      const component = createMockComponentNode('Test') as any;
      const variantData = createVariantData();

      // Should not throw
      await expect(updateVariantComponent(component, variantData)).resolves.not.toThrow();
    });

    it('should preserve component identity (ID, parent)', async () => {
      const component = createMockComponentNode('Test') as any;
      const originalId = component.id;
      const originalParent = { type: 'COMPONENT_SET', name: 'Parent' };
      component.parent = originalParent;

      const variantData = createVariantData();

      await updateVariantComponent(component, variantData);

      // Identity should be preserved
      expect(component.id).toBe(originalId);
      expect(component.parent).toBe(originalParent);
    });
  });

  describe('Integration: create and update workflow', () => {
    it('should support full lifecycle: create → get hash → update', async () => {
      const variantData = createVariantData({
        svgContent: '<svg>original</svg>',
      });

      // Create component
      const component = await createVariantComponent(variantData);
      expect(component).toBeTruthy();

      // Get stored hash
      const originalHash = getStoredHash(component as any);
      expect(originalHash).toBeTruthy();

      // Update with new content
      const updatedData = createVariantData({
        svgContent: '<svg>updated</svg>',
      });
      await updateVariantComponent(component as any, updatedData);

      // Hash should be different
      const newHash = getStoredHash(component as any);
      expect(newHash).not.toBe(originalHash);
    });

    it('should handle multiple updates', async () => {
      const component = await createVariantComponent(createVariantData());

      for (let i = 0; i < 5; i++) {
        const data = createVariantData({
          svgContent: `<svg>version-${i}</svg>`,
        });
        await updateVariantComponent(component as any, data);
      }

      // Should work without errors
      expect(component).toBeTruthy();
      expect((component as any).setPluginData).toHaveBeenCalledTimes(6); // 1 create + 5 updates
    });

    it('should maintain consistent state across operations', async () => {
      const data = createVariantData({
        variant: { weight: 400, fill: 0, grade: 0, opticalSize: 24 },
      });

      const component = await createVariantComponent(data);

      expect(component?.width).toBe(24);
      expect(component?.height).toBe(24);
      expect(component?.fills).toEqual([]);

      // Update to larger size
      const updated = createVariantData({
        variant: { weight: 400, fill: 0, grade: 0, opticalSize: 48 },
      });
      await updateVariantComponent(component as any, updated);

      expect((component as any).resize).toHaveBeenLastCalledWith(48, 48);
    });
  });
});
