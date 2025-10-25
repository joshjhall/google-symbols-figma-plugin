/**
 * @module __tests__/mocks/figma-api
 *
 * Comprehensive Figma API mocks for testing.
 * Provides type-safe mocks for Figma nodes, API methods, and plugin operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi } from 'vitest';

/**
 * Mock base node with common properties
 */
interface MockBaseNode {
  id: string;
  name: string;
  type: string;
  parent: MockBaseNode | null;
  remove: ReturnType<typeof vi.fn>;
}

/**
 * Mock scene node with visual properties
 */
interface MockSceneNode extends MockBaseNode {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

/**
 * Mock frame node (created by createNodeFromSvg)
 */
export interface MockFrameNode extends MockSceneNode {
  type: 'FRAME';
  children: MockSceneNode[];
  appendChild: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  fills: any[];
}

/**
 * Mock component node
 */
export interface MockComponentNode extends MockSceneNode {
  type: 'COMPONENT';
  children: MockSceneNode[];
  appendChild: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  fills: any[];
  getPluginData: ReturnType<typeof vi.fn>;
  setPluginData: ReturnType<typeof vi.fn>;
}

/**
 * Mock component set node
 */
export interface MockComponentSetNode extends MockSceneNode {
  type: 'COMPONENT_SET';
  children: MockComponentNode[];
  insertChild: ReturnType<typeof vi.fn>;
  appendChild: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  setPluginData: ReturnType<typeof vi.fn>;
  getPluginData: ReturnType<typeof vi.fn>;
}

/**
 * Mock vector node (child of SVG frame)
 */
export interface MockVectorNode extends MockSceneNode {
  type: 'VECTOR';
  vectorPaths: any[];
  fillStyleId: string;
  strokeStyleId: string;
}

/**
 * Create a mock vector node (typical SVG child)
 */
export function createMockVectorNode(name = 'vector'): MockVectorNode {
  return {
    id: `vector-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'VECTOR',
    parent: null,
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    vectorPaths: [],
    fillStyleId: '',
    strokeStyleId: '',
    remove: vi.fn(function (this: MockVectorNode) {
      if (this.parent) {
        // Remove from parent's children
        const parentWithChildren = this.parent as any;
        if (parentWithChildren.children) {
          const index = parentWithChildren.children.indexOf(this);
          if (index > -1) {
            parentWithChildren.children.splice(index, 1);
          }
        }
      }
      this.parent = null;
    }) as any,
  };
}

/**
 * Create a mock frame node (returned by createNodeFromSvg)
 */
export function createMockFrameNode(name = 'frame', children: MockSceneNode[] = []): MockFrameNode {
  const childrenArray = [...children];

  const frame: MockFrameNode = {
    id: `frame-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'FRAME',
    parent: null,
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    children: childrenArray,
    fills: [],
    appendChild: vi.fn(function (this: MockFrameNode, child: MockSceneNode) {
      child.parent = this;
      this.children.push(child);
    }) as any,
    resize: vi.fn(function (this: MockFrameNode, width: number, height: number) {
      this.width = width;
      this.height = height;
    }) as any,
    remove: vi.fn(function (this: MockFrameNode) {
      if (this.parent) {
        const parentWithChildren = this.parent as any;
        if (parentWithChildren.children) {
          const index = parentWithChildren.children.indexOf(this);
          if (index > -1) {
            parentWithChildren.children.splice(index, 1);
          }
        }
      }
      this.parent = null;
      this.children = [];
    }) as any,
  };

  // Set parent reference for children
  childrenArray.forEach((child) => {
    child.parent = frame;
  });

  return frame;
}

/**
 * Create a mock component node
 */
export function createMockComponentNode(name = 'Component'): MockComponentNode {
  const pluginData = new Map<string, string>();

  const component: MockComponentNode = {
    id: `component-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'COMPONENT',
    parent: null,
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    children: [],
    fills: [],
    appendChild: vi.fn(function (this: MockComponentNode, child: MockSceneNode) {
      // Remove child from previous parent
      if (child.parent) {
        const oldParentWithChildren = child.parent as any;
        if (oldParentWithChildren.children) {
          const index = oldParentWithChildren.children.indexOf(child);
          if (index > -1) {
            oldParentWithChildren.children.splice(index, 1);
          }
        }
      }
      // Add to new parent
      child.parent = this;
      this.children.push(child);
    }) as any,
    resize: vi.fn(function (this: MockComponentNode, width: number, height: number) {
      this.width = width;
      this.height = height;
    }) as any,
    getPluginData: vi.fn(function (this: MockComponentNode, key: string) {
      return pluginData.get(key) || '';
    }) as any,
    setPluginData: vi.fn(function (this: MockComponentNode, key: string, value: string) {
      pluginData.set(key, value);
    }) as any,
    remove: vi.fn(function (this: MockComponentNode) {
      if (this.parent) {
        const parentWithChildren = this.parent as any;
        if (parentWithChildren.children) {
          const index = parentWithChildren.children.indexOf(this);
          if (index > -1) {
            parentWithChildren.children.splice(index, 1);
          }
        }
      }
      this.parent = null;
      this.children = [];
    }) as any,
  };

  return component;
}

/**
 * Create a mock component set node
 */
export function createMockComponentSetNode(
  name = 'ComponentSet',
  children: MockComponentNode[] = []
): MockComponentSetNode {
  const childrenArray = [...children];
  const pluginData = new Map<string, string>();

  const componentSet: MockComponentSetNode = {
    id: `componentset-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'COMPONENT_SET',
    parent: null,
    x: 0,
    y: 0,
    width: 56,
    height: 56,
    rotation: 0,
    visible: true,
    locked: false,
    children: childrenArray,
    appendChild: vi.fn(function (this: MockComponentSetNode, child: MockComponentNode) {
      child.parent = this;
      this.children.push(child);
    }) as any,
    insertChild: vi.fn(function (
      this: MockComponentSetNode,
      index: number,
      child: MockComponentNode
    ) {
      // Remove from current position if already in children
      const currentIndex = this.children.indexOf(child);
      if (currentIndex > -1) {
        this.children.splice(currentIndex, 1);
      }
      // Insert at new position
      this.children.splice(index, 0, child);
      child.parent = this;
    }) as any,
    resize: vi.fn(function (this: MockComponentSetNode, width: number, height: number) {
      this.width = width;
      this.height = height;
    }) as any,
    getPluginData: vi.fn(function (this: MockComponentSetNode, key: string) {
      return pluginData.get(key) || '';
    }) as any,
    setPluginData: vi.fn(function (this: MockComponentSetNode, key: string, value: string) {
      pluginData.set(key, value);
    }) as any,
    remove: vi.fn(),
  };

  // Set parent reference for children
  childrenArray.forEach((child) => {
    child.parent = componentSet;
  });

  return componentSet;
}

/**
 * Mock Figma API global object
 */
export interface MockFigmaAPI {
  createComponent: ReturnType<typeof vi.fn>;
  createNodeFromSvg: ReturnType<typeof vi.fn>;
  combineAsVariants: ReturnType<typeof vi.fn>;
  currentPage: any;
  notify: ReturnType<typeof vi.fn>;
}

/**
 * Create a complete mock Figma API
 */
export function createMockFigmaAPI(): MockFigmaAPI {
  return {
    createComponent: vi.fn(() => createMockComponentNode()) as any,
    createNodeFromSvg: vi.fn((_svg: string) => {
      // Simulate creating a frame with vector children from SVG
      const vector1 = createMockVectorNode('path');
      const vector2 = createMockVectorNode('circle');
      return createMockFrameNode('svg-frame', [vector1, vector2]);
    }) as any,
    combineAsVariants: vi.fn(
      (components: MockComponentNode[], parent: any): MockComponentSetNode => {
        const componentSet = createMockComponentSetNode('IconSet', components);
        components.forEach((c) => {
          c.parent = componentSet;
        });
        // Add component set to parent page
        if (parent && parent.children) {
          componentSet.parent = parent;
          parent.children.push(componentSet);
        }
        return componentSet;
      }
    ) as any,
    currentPage: {
      appendChild: vi.fn(),
      children: [],
    },
    notify: vi.fn(),
  };
}

/**
 * Install mock Figma API globally
 */
export function installMockFigmaAPI(): MockFigmaAPI {
  const mockFigma = createMockFigmaAPI();
  (global as any).figma = mockFigma;
  return mockFigma;
}

/**
 * Uninstall mock Figma API
 */
export function uninstallMockFigmaAPI(): void {
  delete (global as any).figma;
}

/**
 * Reset all mocks in Figma API
 */
export function resetMockFigmaAPI(mockFigma: MockFigmaAPI): void {
  mockFigma.createComponent.mockClear();
  mockFigma.createNodeFromSvg.mockClear();
  mockFigma.combineAsVariants.mockClear();
  mockFigma.notify.mockClear();
}
