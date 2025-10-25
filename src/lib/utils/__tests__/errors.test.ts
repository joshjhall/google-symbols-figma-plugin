/**
 * @module @figma/utils/__tests__/errors
 *
 * Unit tests for error handling utilities.
 * Tests all custom error classes and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  FigmaPluginError,
  VariableNotFoundError,
  VariableBindingError,
  IconGenerationError,
  FetchError,
  isFigmaPluginError,
  wrapError,
} from '../errors';

describe('FigmaPluginError', () => {
  it('should create error with message, code, and details', () => {
    const error = new FigmaPluginError('Test error', 'TEST_CODE', { foo: 'bar' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FigmaPluginError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.name).toBe('FigmaPluginError');
  });

  it('should have a timestamp', () => {
    const before = new Date().toISOString();
    const error = new FigmaPluginError('Test', 'TEST');
    const after = new Date().toISOString();

    expect(error.timestamp).toBeDefined();
    expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(error.timestamp >= before).toBe(true);
    expect(error.timestamp <= after).toBe(true);
  });

  it('should work without details', () => {
    const error = new FigmaPluginError('Test error', 'TEST_CODE');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toBeUndefined();
  });

  it('should capture stack trace', () => {
    const error = new FigmaPluginError('Test', 'TEST');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('FigmaPluginError');
  });

  it('should be serializable', () => {
    const error = new FigmaPluginError('Test error', 'TEST_CODE', { foo: 'bar' });
    const serialized = JSON.stringify({
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp,
    });

    expect(serialized).toContain('Test error');
    expect(serialized).toContain('TEST_CODE');
    expect(serialized).toContain('bar');
  });
});

describe('VariableNotFoundError', () => {
  it('should create error with variable name', () => {
    const error = new VariableNotFoundError('M3/palette/primary');

    expect(error).toBeInstanceOf(FigmaPluginError);
    expect(error.message).toBe('Variable "M3/palette/primary" not found in library or page');
    expect(error.code).toBe('VARIABLE_NOT_FOUND');
    expect(error.details).toEqual({ variableName: 'M3/palette/primary' });
  });

  it('should merge additional details', () => {
    const error = new VariableNotFoundError('test-var', {
      searchedCollections: ['M3', 'M2'],
      availableVariables: 150,
    });

    expect(error.details).toEqual({
      variableName: 'test-var',
      searchedCollections: ['M3', 'M2'],
      availableVariables: 150,
    });
  });

  it('should handle non-object details', () => {
    const error = new VariableNotFoundError('test-var', 'invalid details');

    expect(error.details).toEqual({ variableName: 'test-var' });
  });

  it('should handle null details', () => {
    const error = new VariableNotFoundError('test-var', null);

    expect(error.details).toEqual({ variableName: 'test-var' });
  });
});

describe('VariableBindingError', () => {
  it('should create error with message and details', () => {
    const error = new VariableBindingError('Failed to bind corner radius', {
      nodeId: '123',
      variableId: '456',
      field: 'cornerRadius',
    });

    expect(error).toBeInstanceOf(FigmaPluginError);
    expect(error.message).toBe('Failed to bind corner radius');
    expect(error.code).toBe('VARIABLE_BINDING_ERROR');
    expect(error.details).toEqual({
      nodeId: '123',
      variableId: '456',
      field: 'cornerRadius',
    });
  });

  it('should work without details', () => {
    const error = new VariableBindingError('Binding failed');

    expect(error.message).toBe('Binding failed');
    expect(error.details).toBeUndefined();
  });
});

describe('IconGenerationError', () => {
  it('should create error with icon name and reason', () => {
    const error = new IconGenerationError('home', 'SVG content is empty');

    expect(error).toBeInstanceOf(FigmaPluginError);
    expect(error.message).toBe('Failed to generate icon "home": SVG content is empty');
    expect(error.code).toBe('ICON_GENERATION_ERROR');
    expect(error.details).toEqual({
      iconName: 'home',
      reason: 'SVG content is empty',
    });
  });

  it('should merge additional details', () => {
    const error = new IconGenerationError('home', 'No variants', {
      url: 'https://example.com/icon.svg',
      variant: 'rounded',
    });

    expect(error.details).toEqual({
      iconName: 'home',
      reason: 'No variants',
      url: 'https://example.com/icon.svg',
      variant: 'rounded',
    });
  });

  it('should handle special characters in icon name', () => {
    const error = new IconGenerationError('icon-with-dashes_123', 'Failed');

    expect(error.message).toBe('Failed to generate icon "icon-with-dashes_123": Failed');
    expect(error.details).toEqual({
      iconName: 'icon-with-dashes_123',
      reason: 'Failed',
    });
  });

  it('should handle non-object details', () => {
    const error = new IconGenerationError('test', 'Failed', 42);

    expect(error.details).toEqual({
      iconName: 'test',
      reason: 'Failed',
    });
  });
});

describe('FetchError', () => {
  it('should create error with URL and status code', () => {
    const error = new FetchError('https://example.com/icon.svg', 404);

    expect(error).toBeInstanceOf(FigmaPluginError);
    expect(error.message).toBe('Failed to fetch from https://example.com/icon.svg (404)');
    expect(error.code).toBe('FETCH_ERROR');
    expect(error.details).toEqual({
      url: 'https://example.com/icon.svg',
      statusCode: 404,
    });
  });

  it('should work without status code', () => {
    const error = new FetchError('https://example.com/icon.svg');

    expect(error.message).toBe('Failed to fetch from https://example.com/icon.svg');
    expect(error.details).toEqual({
      url: 'https://example.com/icon.svg',
      statusCode: undefined,
    });
  });

  it('should include additional details', () => {
    const error = new FetchError('https://example.com/icon.svg', 500, {
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/html' },
    });

    expect(error.details).toEqual({
      url: 'https://example.com/icon.svg',
      statusCode: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/html' },
    });
  });

  it('should handle different status codes', () => {
    const codes = [400, 401, 403, 404, 429, 500, 502, 503];

    codes.forEach((code) => {
      const error = new FetchError('https://example.com/test', code);
      expect(error.message).toContain(`(${code})`);
      expect(error.details).toHaveProperty('statusCode', code);
    });
  });
});

describe('isFigmaPluginError', () => {
  it('should return true for FigmaPluginError', () => {
    const error = new FigmaPluginError('Test', 'TEST');
    expect(isFigmaPluginError(error)).toBe(true);
  });

  it('should return true for subclasses', () => {
    const errors = [
      new VariableNotFoundError('test'),
      new VariableBindingError('test'),
      new IconGenerationError('icon', 'reason'),
      new FetchError('url'),
    ];

    errors.forEach((error) => {
      expect(isFigmaPluginError(error)).toBe(true);
    });
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    expect(isFigmaPluginError(error)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isFigmaPluginError({})).toBe(false);
    expect(isFigmaPluginError('string')).toBe(false);
    expect(isFigmaPluginError(123)).toBe(false);
    expect(isFigmaPluginError(null)).toBe(false);
    expect(isFigmaPluginError(undefined)).toBe(false);
  });
});

describe('wrapError', () => {
  it('should return FigmaPluginError unchanged', () => {
    const original = new FigmaPluginError('Test', 'TEST_CODE', { foo: 'bar' });
    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
    expect(wrapped.message).toBe('Test');
    expect(wrapped.code).toBe('TEST_CODE');
    expect(wrapped.details).toEqual({ foo: 'bar' });
  });

  it('should wrap regular Error', () => {
    const original = new Error('Original error');
    const wrapped = wrapError(original, 'WRAPPED_ERROR');

    expect(wrapped).toBeInstanceOf(FigmaPluginError);
    expect(wrapped.message).toBe('Original error');
    expect(wrapped.code).toBe('WRAPPED_ERROR');
    expect(wrapped.details).toHaveProperty('originalError', 'Error');
    expect(wrapped.details).toHaveProperty('stack');
  });

  it('should use default code if not provided', () => {
    const original = new Error('Test');
    const wrapped = wrapError(original);

    expect(wrapped.code).toBe('UNKNOWN_ERROR');
  });

  it('should wrap string errors', () => {
    const wrapped = wrapError('String error', 'STRING_ERROR');

    expect(wrapped).toBeInstanceOf(FigmaPluginError);
    expect(wrapped.message).toBe('String error');
    expect(wrapped.code).toBe('STRING_ERROR');
    expect(wrapped.details).toEqual({ originalError: 'String error' });
  });

  it('should wrap number errors', () => {
    const wrapped = wrapError(404, 'NUMERIC_ERROR');

    expect(wrapped.message).toBe('404');
    expect(wrapped.details).toEqual({ originalError: 404 });
  });

  it('should wrap null/undefined', () => {
    const wrappedNull = wrapError(null);
    const wrappedUndefined = wrapError(undefined);

    expect(wrappedNull.message).toBe('null');
    expect(wrappedUndefined.message).toBe('undefined');
  });

  it('should wrap object errors', () => {
    const obj = { error: 'custom', code: 123 };
    const wrapped = wrapError(obj);

    expect(wrapped.message).toBe('[object Object]');
    expect(wrapped.details).toEqual({ originalError: obj });
  });

  it('should preserve subclass instances', () => {
    const original = new IconGenerationError('home', 'Failed');
    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
    expect(wrapped).toBeInstanceOf(IconGenerationError);
  });
});

describe('Error inheritance', () => {
  it('should maintain proper prototype chain', () => {
    const error = new IconGenerationError('test', 'reason');

    expect(error instanceof IconGenerationError).toBe(true);
    expect(error instanceof FigmaPluginError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  it('should allow instanceof checks for all subclasses', () => {
    const errors = [
      new VariableNotFoundError('test'),
      new VariableBindingError('test'),
      new IconGenerationError('icon', 'reason'),
      new FetchError('url'),
    ];

    errors.forEach((error) => {
      expect(error instanceof FigmaPluginError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});

describe('Error details handling', () => {
  it('should handle complex nested details', () => {
    const details = {
      level1: {
        level2: {
          level3: 'deep value',
        },
      },
      array: [1, 2, 3],
      null: null,
      undefined: undefined,
    };

    const error = new FigmaPluginError('Test', 'TEST', details);

    expect(error.details).toEqual(details);
    expect(error.details).toHaveProperty('level1.level2.level3', 'deep value');
    expect(error.details).toHaveProperty('array', [1, 2, 3]);
  });

  it('should allow details to be any type', () => {
    const error1 = new FigmaPluginError('Test', 'TEST', 'string details');
    const error2 = new FigmaPluginError('Test', 'TEST', 12345);
    const error3 = new FigmaPluginError('Test', 'TEST', [1, 2, 3]);

    expect(error1.details).toBe('string details');
    expect(error2.details).toBe(12345);
    expect(error3.details).toEqual([1, 2, 3]);
  });
});
