// packages/core/src/agent/__tests__/ContextManager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../ContextManager';
import type { IStorageAPI } from '../../storage/types';
import type { Message } from '../../types/chat';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockStorage: IStorageAPI;

  beforeEach(() => {
    mockStorage = {
      loadSession: vi.fn().mockResolvedValue([]),
      createSession: vi.fn(),
      saveMessage: vi.fn(),
      saveMessages: vi.fn(),
      deleteSession: vi.fn(),
      listSessions: vi.fn(),
      updateSessionMeta: vi.fn(),
    } as unknown as IStorageAPI;
    contextManager = new ContextManager(mockStorage);
  });

  it('应该从 Storage 加载会话历史并构建上下文', async () => {
    const mockHistory: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
        timestamp: Date.now(),
      },
    ];
    (mockStorage.loadSession as any).mockResolvedValue(mockHistory);

    const context = await contextManager.buildContext('session-123', 'Hello World');

    expect(context.sessionId).toBe('session-123');
    expect(context.currentMessage).toBe('Hello World');
    expect(context.history).toEqual(mockHistory);
    expect(mockStorage.loadSession).toHaveBeenCalledWith('session-123');
  });

  it('应该包含工作区路径', async () => {
    (mockStorage.loadSession as any).mockResolvedValue([]);

    const context = await contextManager.buildContext('session-123', 'Test');

    expect(context.workspace).toBeDefined();
    expect(typeof context.workspace).toBe('string');
  });
});
