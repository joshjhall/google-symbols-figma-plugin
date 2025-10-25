/**
 * @module @figma/utils/__tests__/logger
 *
 * Unit tests for structured logging utilities.
 * Tests log levels, filtering, formatting, timing, and context.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

describe('PluginLogger', () => {
  // Spy on console methods
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset logger to default state
    logger.setEnabled(true);
    logger.setLevel('info');
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  describe('setLevel', () => {
    it('should filter debug messages when level is info', () => {
      logger.setLevel('info');
      logger.debug('debug message');
      logger.info('info message');

      expect(consoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('debug message'),
        expect.anything()
      );
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('info message'), '');
    });

    it('should allow debug messages when level is debug', () => {
      logger.setLevel('debug');
      logger.debug('debug message');

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('debug message'), '');
    });

    it('should filter info and debug when level is warn', () => {
      logger.setLevel('warn');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('warn message'), '');
    });

    it('should only allow error when level is error', () => {
      logger.setLevel('error');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('error'), '');
    });
  });

  describe('setEnabled', () => {
    it('should disable all logging when false', () => {
      logger.setEnabled(false);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('should re-enable logging when true', () => {
      logger.setEnabled(false);
      logger.info('should not log');
      expect(consoleLog).not.toHaveBeenCalled();

      logger.setEnabled(true);
      logger.info('should log');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('should log'), '');
    });
  });

  describe('debug', () => {
    it('should log debug messages', () => {
      logger.setLevel('debug');
      logger.debug('debug message');

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'), '');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('debug message'), '');
    });

    it('should include data object', () => {
      logger.setLevel('debug');
      const data = { foo: 'bar', count: 42 };
      logger.debug('debug with data', data);

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('debug with data'), data);
    });

    it('should be filtered by log level', () => {
      logger.setLevel('info');
      logger.debug('filtered');

      expect(consoleLog).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('info message');

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), '');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('info message'), '');
    });

    it('should include data object', () => {
      const data = { icon: 'home', variants: 504 };
      logger.info('processing icon', data);

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('processing icon'), data);
    });

    it('should include timestamp', () => {
      logger.info('test');

      const call = consoleLog.mock.calls[0][0] as string;
      // Timestamp format: HH:MM:SS
      expect(call).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('warning message');

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), '');
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('warning message'), '');
    });

    it('should include data object', () => {
      const data = { reason: 'Rate limit approaching' };
      logger.warn('slow down', data);

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('slow down'), data);
    });

    it('should not be filtered when level is warn', () => {
      logger.setLevel('warn');
      logger.warn('warning');

      expect(consoleWarn).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('error message');

      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'), '');
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('error message'), '');
    });

    it('should include data object', () => {
      const data = { code: 'ICON_FAILED', iconName: 'home' };
      logger.error('generation failed', data);

      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('generation failed'), data);
    });

    it('should always log regardless of level', () => {
      const levels = ['debug', 'info', 'warn', 'error'] as const;

      levels.forEach((level) => {
        consoleError.mockClear();
        logger.setLevel(level);
        logger.error('error');
        expect(consoleError).toHaveBeenCalled();
      });
    });
  });

  describe('notify', () => {
    it('should log info notify message', () => {
      logger.notify('Success message');

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[NOTIFY]'), '');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Success message'), '');
    });

    it('should log error notify message', () => {
      logger.notify('Error message', true);

      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[NOTIFY]'), '');
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Error message'), '');
    });

    it('should handle figma.notify when available', () => {
      // Mock figma global
      const mockNotify = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).figma = { notify: mockNotify };

      logger.notify('Test notification');
      expect(mockNotify).toHaveBeenCalledWith('Test notification', { error: false, timeout: 3000 });

      logger.notify('Error notification', true);
      expect(mockNotify).toHaveBeenCalledWith('Error notification', { error: true, timeout: 5000 });

      // Cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).figma;
    });

    it('should work without figma global', () => {
      // Ensure figma is undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).figma;

      // Should not throw
      expect(() => logger.notify('Test')).not.toThrow();
      expect(consoleLog).toHaveBeenCalled();
    });
  });

  describe('time', () => {
    it('should log start and end of operation', () => {
      const endTimer = logger.time('Test operation');

      // Start message should be logged at debug level
      logger.setLevel('debug');
      logger.time('Debug operation');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[TIMER]'), '');
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Debug operation started'),
        ''
      );

      // End timer
      endTimer();
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[TIMER]'), '');
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test operation completed'),
        ''
      );
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('ms'), '');
    });

    it('should measure elapsed time', async () => {
      const endTimer = logger.time('Timed operation');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      endTimer();

      const call = consoleLog.mock.calls.find((c) =>
        (c[0] as string).includes('Timed operation completed')
      );
      expect(call).toBeDefined();

      if (call) {
        // Extract duration from log message
        const message = call[0] as string;
        const durationMatch = message.match(/(\d+)ms/);
        expect(durationMatch).toBeTruthy();

        if (durationMatch) {
          const duration = parseInt(durationMatch[1], 10);
          expect(duration).toBeGreaterThanOrEqual(10);
        }
      }
    });

    it('should return a function that can be called multiple times', () => {
      const endTimer = logger.time('Multi-call');
      consoleLog.mockClear();

      endTimer();
      const firstCallCount = consoleLog.mock.calls.length;

      endTimer();
      const secondCallCount = consoleLog.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount * 2);
    });
  });

  describe('withContext', () => {
    it('should include context in log messages', () => {
      const contextLogger = logger.withContext({
        component: 'IconGenerator',
        version: '1.0.0',
      });

      contextLogger.info('Processing');

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Processing'),
        expect.objectContaining({
          component: 'IconGenerator',
          version: '1.0.0',
        })
      );
    });

    it('should merge context with additional data', () => {
      const contextLogger = logger.withContext({
        component: 'Test',
      });

      contextLogger.info('Message', { iconName: 'home' });

      expect(consoleLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          component: 'Test',
          iconName: 'home',
        })
      );
    });

    it('should work with all log levels', () => {
      logger.setLevel('debug');
      const contextLogger = logger.withContext({ ctx: 'value' });

      contextLogger.debug('debug');
      expect(consoleLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ctx: 'value' })
      );

      contextLogger.info('info');
      expect(consoleLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ctx: 'value' })
      );

      contextLogger.warn('warn');
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ctx: 'value' })
      );

      contextLogger.error('error');
      expect(consoleError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ctx: 'value' })
      );
    });

    it('should handle non-object data', () => {
      const contextLogger = logger.withContext({ ctx: 'test' });

      contextLogger.info('Message', 'string data');

      expect(consoleLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ctx: 'test',
          data: 'string data',
        })
      );
    });

    it('should handle null data', () => {
      const contextLogger = logger.withContext({ ctx: 'test' });

      contextLogger.info('Message', null);

      expect(consoleLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ctx: 'test',
        })
      );
    });
  });

  describe('Log formatting', () => {
    it('should include timestamp in HH:MM:SS format', () => {
      logger.info('test');

      const call = consoleLog.mock.calls[0][0] as string;
      expect(call).toMatch(/\[INFO\] \d{2}:\d{2}:\d{2}/);
    });

    it('should format different log levels correctly', () => {
      logger.setLevel('debug');

      logger.debug('debug');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'), '');

      logger.info('info');
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), '');

      logger.warn('warn');
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), '');

      logger.error('error');
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'), '');
    });

    it('should use empty string when no data provided', () => {
      logger.info('message without data');

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('message without data'), '');
    });
  });

  describe('Real-world scenarios', () => {
    it('should support icon generation workflow logging', () => {
      logger.setLevel('info');
      const iconLogger = logger.withContext({ icon: 'home' });

      iconLogger.info('Fetching variants');
      iconLogger.info('Creating components', { count: 504 });

      const endTimer = logger.time('Icon generation');
      // Simulate work
      endTimer();

      iconLogger.info('Generation complete');

      expect(consoleLog).toHaveBeenCalledTimes(4);
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Fetching variants'),
        expect.objectContaining({ icon: 'home' })
      );
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Creating components'),
        expect.objectContaining({ icon: 'home', count: 504 })
      );
    });

    it('should support error handling workflow', () => {
      logger.setLevel('info');

      logger.info('Starting generation');

      try {
        logger.error('Failed to fetch', { url: 'https://example.com', status: 404 });
      } catch {
        // Ignore
      }

      logger.warn('Retrying with fallback');
      logger.info('Retry successful');

      expect(consoleLog).toHaveBeenCalledTimes(2);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalledTimes(1);
    });

    it('should support performance monitoring', () => {
      const timers: Array<() => void> = [];

      // Start multiple timers
      timers.push(logger.time('Fetch icons'));
      timers.push(logger.time('Generate components'));
      timers.push(logger.time('Apply variables'));

      // End all timers
      timers.forEach((end) => end());

      const timerMessages = consoleLog.mock.calls.filter(
        (c) => (c[0] as string).includes('[TIMER]') && (c[0] as string).includes('completed')
      );

      expect(timerMessages).toHaveLength(3);
    });
  });
});
