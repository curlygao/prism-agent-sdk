import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SDKEventBus } from '../SDKEventBus';

describe('SDKEventBus', () => {
  let bus: SDKEventBus;

  beforeEach(() => {
    bus = new SDKEventBus();
  });

  describe('基础功能', () => {
    it('应该能够订阅和触发事件', () => {
      const handler = vi.fn();
      bus.on('test:event', handler);
      bus.internalEmit('test:event', { data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('应该支持多个订阅者', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test:event', handler1);
      bus.on('test:event', handler2);
      bus.internalEmit('test:event', { data: 'test' });
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('应该能够取消订阅', () => {
      const handler = vi.fn();
      bus.on('test:event', handler);
      bus.off('test:event', handler);
      bus.internalEmit('test:event', { data: 'test' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('应该支持一次性订阅', () => {
      const handler = vi.fn();
      bus.once('test:event', handler);
      bus.internalEmit('test:event', { data: 'test1' });
      bus.internalEmit('test:event', { data: 'test2' });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
