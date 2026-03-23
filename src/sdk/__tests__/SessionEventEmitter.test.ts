import { describe, it, expect, vi } from 'vitest';
import { SessionEventEmitter } from '../SessionEventEmitter';

describe('SessionEventEmitter', () => {
  it('应该正确注册和触发监听器', () => {
    const emitter = new SessionEventEmitter('session-1', null);
    const handler = vi.fn();

    emitter.on('test-event', handler);
    emitter.emit('test-event', { data: 'test' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });

  it('应该支持 off 移除监听器', () => {
    const emitter = new SessionEventEmitter('session-1', null);
    const handler = vi.fn();

    emitter.on('test-event', handler);
    emitter.off('test-event', handler);
    emitter.emit('test-event', { data: 'test' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('应该支持 once 一次性监听器', () => {
    const emitter = new SessionEventEmitter('session-1', null);
    const handler = vi.fn();

    emitter.once('test-event', handler);
    emitter.emit('test-event', { data: 'test1' });
    emitter.emit('test-event', { data: 'test2' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ data: 'test1' });
  });

  it('应该委托事件到全局总线', () => {
    const globalBus = {
      internalEmit: vi.fn(),
    };
    const emitter = new SessionEventEmitter('session-1', globalBus as any);

    emitter.emit('test-event', { data: 'test' });

    expect(globalBus.internalEmit).toHaveBeenCalledWith('test-event', {
      sessionId: 'session-1',
      data: 'test',
    });
  });

  it('应该清理所有监听器', () => {
    const emitter = new SessionEventEmitter('session-1', null);
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('event1', handler1);
    emitter.on('event2', handler2);
    emitter.removeAllListeners();

    emitter.emit('event1', {});
    emitter.emit('event2', {});

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});
