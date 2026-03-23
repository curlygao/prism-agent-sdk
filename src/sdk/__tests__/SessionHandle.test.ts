import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionHandle } from '../SessionHandle';
import { SessionClosedError, SessionBusyError } from '../errors';

describe('SessionHandle', () => {
  let mockStorage: any;
  let mockProvider: any;
  let mockToolRegistry: any;
  let mockEventBus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock storage
    mockStorage = {
      loadSession: vi.fn().mockResolvedValue([]),
      appendMessage: vi.fn().mockResolvedValue(undefined),
    };

    // Mock provider with required method
    const createMockStream = () => {
      let callCount = 0;
      return {
        async next() {
          callCount++;
          if (callCount === 1) {
            // 第一次调用返回一个简单内容事件
            return {
              done: false,
              value: {
                type: 'content',
                data: { text: 'Response' },
              },
            };
          } else if (callCount === 2) {
            // 第二次调用返回结束
            return {
              done: true,
              value: {
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                model: 'test-model',
              },
            };
          }
          // 后续调用保持完成状态
          return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };

    mockProvider = {
      chatStream: vi.fn().mockReturnValue(createMockStream()),
    };

    // Mock tool registry with required method
    mockToolRegistry = {
      getOpenAIFunctions: vi.fn().mockReturnValue([]),
    };

    // Mock event bus
    mockEventBus = {
      internalEmit: vi.fn(),
    };
  });

  it('应该正确初始化 SessionHandle', () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    expect(handle.id).toBe('session-1');
    expect(handle.projectId).toBe('project-1');
    expect(handle.createdAt).toBeLessThanOrEqual(Date.now());
    expect(handle.getState().sessionId).toBe('session-1');
  });

  it('应该成功发送消息', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    const response = await handle.sendMessage('Hello');

    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
    expect(mockStorage.appendMessage).toHaveBeenCalled();
  });

  it('应该拒绝并发消息', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    // 模拟第一个消息正在处理
    let firstMessageResolved = false;
    vi.spyOn(handle['agentLoop'], 'processMessage').mockImplementationOnce(
      () => new Promise(resolve => {
        setTimeout(() => {
          firstMessageResolved = true;
          resolve({
            message: {
              id: 'msg-1',
              role: 'assistant',
              parts: [],
              timestamp: Date.now(),
            },
            finishReason: 'stop',
          });
        }, 100);
      })
    );

    const firstMessage = handle.sendMessage('First');

    // 等待一点时间确保第一个消息开始处理
    await new Promise(resolve => setTimeout(resolve, 10));

    // 第二个消息应该被拒绝
    await expect(handle.sendMessage('Second')).rejects.toThrow(SessionBusyError);

    await firstMessage;
    expect(firstMessageResolved).toBe(true);
  });

  it('应该在关闭后拒绝消息', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    await handle.close();

    await expect(handle.sendMessage('Hello')).rejects.toThrow(SessionClosedError);
  });

  it('应该支持事件监听', () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    const handler = vi.fn();
    handle.on('text:delta', handler);

    // 验证方法不报错
    expect(() => handle.on('text:delta', handler)).not.toThrow();
  });

  it('应该支持事件移除', () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    const handler = vi.fn();
    handle.on('text:delta', handler);
    handle.off('text:delta', handler);

    // 验证方法不报错
    expect(() => handle.off('text:delta', handler)).not.toThrow();
  });

  it('应该支持 once 一次性监听', () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    const handler = vi.fn();
    handle.once('text:done', handler);

    // 验证方法不报错
    expect(() => handle.once('text:done', handler)).not.toThrow();
  });

  it('应该正确关闭会话', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    const closedHandler = vi.fn();
    // 使用 EventEmitter 的监听方法
    (handle as any).addListener('closed', closedHandler);

    await handle.close();

    // 验证再次关闭不会出错
    await handle.close();

    // closed 事件应该被触发
    expect(closedHandler).toHaveBeenCalled();
  });

  it('应该在消息处理后清理 processing 状态', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    expect(handle.getState().isProcessing()).toBe(false);

    const promise = handle.sendMessage('Hello');
    expect(handle.getState().isProcessing()).toBe(true);

    await promise;
    expect(handle.getState().isProcessing()).toBe(false);
  });

  it('应该在消息处理失败时清理 processing 状态', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    vi.spyOn(handle['agentLoop'], 'processMessage').mockRejectedValueOnce(
      new Error('Processing failed')
    );

    expect(handle.getState().isProcessing()).toBe(false);

    await expect(handle.sendMessage('Hello')).rejects.toThrow('Processing failed');

    expect(handle.getState().isProcessing()).toBe(false);
  });

  it('应该保存新消息到存储', async () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    await handle.sendMessage('Hello');

    expect(mockStorage.appendMessage).toHaveBeenCalled();
  });

  it('应该转发 AgentLoop 事件', () => {
    const handle = new SessionHandle(
      'session-1',
      'project-1',
      mockStorage,
      mockProvider,
      mockToolRegistry,
      mockEventBus,
      '/workspace'
    );

    // 验证所有事件都被注册
    const agentLoop = (handle as any)['agentLoop'];
    const onSpy = vi.spyOn(agentLoop, 'on');

    // 重新调用事件设置来验证
    (handle as any)['setupAgentLoopEvents']();

    // 验证 on 方法被调用
    expect(onSpy).toHaveBeenCalled();
  });
});
