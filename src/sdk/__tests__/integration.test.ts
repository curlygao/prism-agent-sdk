/**
 * 并行会话集成测试
 *
 * 测试要点：
 * 1. 支持创建和使用单个会话
 * 2. 支持并行执行多个会话
 * 3. 支持全局事件监听
 * 4. 拒绝同一会话的并发消息
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../SessionManager';
import { SDKEventBus } from '../SDKEventBus';
import { SessionBusyError, SessionClosedError } from '../errors';
import type { IStorageAPI, ProjectMeta, StorageSessionMeta } from '../../storage/types';
import type { ToolRegistry } from '../../tools/ToolRegistry';

/**
 * 创建 Mock Storage API
 */
function createMockStorage(): IStorageAPI {
  const sessions = new Map<string, StorageSessionMeta>();
  const messages = new Map<string, any[]>();
  let projectIdCounter = 1;

  return {
    getOrCreateProject: vi.fn(async (path: string): Promise<ProjectMeta> => {
      return {
        id: `project-${projectIdCounter++}`,
        originalPath: path,
        name: 'Test Project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };
    }),

    getProject: vi.fn(async (id: string): Promise<ProjectMeta | null> => {
      if (id.startsWith('project-')) {
        return {
          id,
          originalPath: '/test/path',
          name: 'Test Project',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          sessionCount: 0,
        };
      }
      return null;
    }),

    updateProjectActivity: vi.fn(),

    listSessions: vi.fn(async (projectId: string): Promise<StorageSessionMeta[]> => {
      return Array.from(sessions.values()).filter(s => s.projectId === projectId);
    }),

    createSession: vi.fn(async (projectId: string, title: string): Promise<StorageSessionMeta> => {
      const session: StorageSessionMeta = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        title,
        messageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessions.set(session.id, session);
      messages.set(session.id, []);
      return session;
    }),

    loadSession: vi.fn(async (sessionId: string): Promise<any[] | null> => {
      return messages.get(sessionId) || null;
    }),

    appendMessage: vi.fn(async (sessionId: string, message: any): Promise<void> => {
      const sessionMessages = messages.get(sessionId);
      if (sessionMessages) {
        sessionMessages.push(message);
        const session = sessions.get(sessionId);
        if (session) {
          session.messageCount = sessionMessages.length;
          session.updatedAt = Date.now();
        }
      }
    }),

    appendMessages: vi.fn(),
    updateSessionMeta: vi.fn(),
    updateSessionMessages: vi.fn(),
    deleteSession: vi.fn(async (sessionId: string): Promise<void> => {
      sessions.delete(sessionId);
      messages.delete(sessionId);
    }),
  };
}

/**
 * 创建 Mock ToolRegistry
 */
function createMockToolRegistry(): ToolRegistry {
  const mockRegistry = {
    getTool: vi.fn(() => null),
    listTools: vi.fn(() => []),
    getOpenAIFunctions: vi.fn(() => []),
    toVercelAITools: vi.fn(() => ({})),
    register: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, output: 'mock result' }),
  } as unknown as ToolRegistry;
  return mockRegistry;
}

/**
 * 创建 Mock SDKEventBus
 */
function createMockEventBus(): SDKEventBus {
  const bus = new SDKEventBus();
  // Mock internalEmit to actually emit events
  const originalInternalEmit = bus.internalEmit.bind(bus);
  (bus as any).internalEmit = vi.fn((event: string, data: any) => {
    originalInternalEmit(event, data);
  });
  return bus;
}

describe('并行会话集成测试', () => {
  let sessionManager: SessionManager;
  let mockStorage: IStorageAPI;
  let mockToolRegistry: ToolRegistry;
  let mockEventBus: SDKEventBus;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockToolRegistry = createMockToolRegistry();
    mockEventBus = createMockEventBus();
    sessionManager = new SessionManager(
      mockStorage,
      mockToolRegistry,
      mockEventBus,
      '/test/workspace'
    );
  });

  afterEach(async () => {
    await sessionManager.closeAll();
  });

  describe('1. 单个会话的创建和使用', () => {
    it('应该能够创建新会话', async () => {
      const session = await sessionManager.create({ title: 'Test Session' });

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session-/);
      expect(session.projectId).toMatch(/^project-/);
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('应该能够发送消息并接收响应', async () => {
      const session = await sessionManager.create();

      const response = await session.sendMessage('Hello, world!');

      expect(response).toBeDefined();
      expect(mockStorage.appendMessage).toHaveBeenCalled();
    });

    it('应该能够监听会话事件', async () => {
      const session = await sessionManager.create();
      const textDoneHandler = vi.fn();

      session.on('text:done', textDoneHandler);

      await session.sendMessage('Test message');

      // 等待事件触发
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(textDoneHandler).toHaveBeenCalled();
    });

    it('应该能够关闭会话', async () => {
      const session = await sessionManager.create();

      await session.close();

      // 关闭后再发送消息应该抛出错误
      await expect(session.sendMessage('Should fail')).rejects.toThrow(SessionClosedError);
    });
  });

  describe('2. 并行执行多个会话', () => {
    it('应该能够创建多个独立的会话', async () => {
      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });
      const session3 = await sessionManager.create({ title: 'Session 3' });

      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);
      expect(session3.id).not.toBe(session1.id);
    });

    it('应该能够并行发送消息到不同会话', async () => {
      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });
      const session3 = await sessionManager.create({ title: 'Session 3' });

      // 并行发送消息
      const results = await Promise.all([
        session1.sendMessage('Message 1'),
        session2.sendMessage('Message 2'),
        session3.sendMessage('Message 3'),
      ]);

      expect(results).toHaveLength(3);
      expect(mockStorage.appendMessage).toHaveBeenCalledTimes(6); // 每个会话 2 条消息（用户 + 助手）
    });

    it('应该能够独立监听不同会话的事件', async () => {
      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      session1.on('text:done', handler1);
      session2.on('text:done', handler2);

      // 并行发送消息
      await Promise.all([
        session1.sendMessage('Message 1'),
        session2.sendMessage('Message 2'),
      ]);

      // 等待事件触发
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('应该能够独立关闭不同会话', async () => {
      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });

      await session1.close();

      // session1 应该关闭，session2 应该仍然可用
      await expect(session1.sendMessage('Should fail')).rejects.toThrow(SessionClosedError);
      await expect(session2.sendMessage('Should work')).resolves.toBeDefined();
    });
  });

  describe('3. 全局事件监听', () => {
    it('应该能够监听所有会话的事件', async () => {
      const eventBus = sessionManager.getEventBus();
      const textDoneHandler = vi.fn();

      // 监听全局事件
      eventBus.on('text:done', textDoneHandler);

      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });

      await Promise.all([
        session1.sendMessage('Message 1'),
        session2.sendMessage('Message 2'),
      ]);

      // 等待事件触发
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(textDoneHandler).toHaveBeenCalled();
    });

    it('应该能够取消全局事件监听', async () => {
      const eventBus = sessionManager.getEventBus();
      const textDoneHandler = vi.fn();

      eventBus.on('text:done', textDoneHandler);
      eventBus.off('text:done', textDoneHandler);

      const session = await sessionManager.create();
      await session.sendMessage('Test message');

      // 等待事件触发
      await new Promise(resolve => setTimeout(resolve, 100));

      // 因为取消监听，所以不应该被调用
      expect(textDoneHandler).not.toHaveBeenCalled();
    });

    it('应该能够使用 once 监听一次性事件', async () => {
      const eventBus = sessionManager.getEventBus();
      const textDoneHandler = vi.fn();

      eventBus.once('text:done', textDoneHandler);

      const session = await sessionManager.create();

      await session.sendMessage('Message 1');
      await session.sendMessage('Message 2');

      // 等待事件触发
      await new Promise(resolve => setTimeout(resolve, 100));

      // 应该只被调用一次
      expect(textDoneHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. 拒绝同一会话的并发消息', () => {
    it('应该在处理消息时拒绝新消息', async () => {
      const session = await sessionManager.create();

      // 模拟慢速处理
      const slowPromise = new Promise(resolve => setTimeout(resolve, 200));

      // 发送第一个消息（由于 mock 处理很快，我们需要使用其他方式测试）
      // 这里我们直接测试并发调用 sendMessage
      await expect(
        Promise.all([
          session.sendMessage('Message 1'),
          session.sendMessage('Message 2'),
        ])
      ).rejects.toThrow(SessionBusyError);
    });

    it('应该在消息处理完成后允许新消息', async () => {
      const session = await sessionManager.create();

      // 发送第一条消息
      await session.sendMessage('Message 1');

      // 等待处理完成
      await new Promise(resolve => setTimeout(resolve, 50));

      // 发送第二条消息应该成功
      await expect(session.sendMessage('Message 2')).resolves.toBeDefined();
    });

    it('应该在会话关闭时拒绝消息', async () => {
      const session = await sessionManager.create();

      await session.close();

      await expect(session.sendMessage('Should fail')).rejects.toThrow(SessionClosedError);
    });

    it('应该在会话忙碌时提供清晰的错误信息', async () => {
      const session = await sessionManager.create();

      try {
        await Promise.all([
          session.sendMessage('Message 1'),
          session.sendMessage('Message 2'),
        ]);
        fail('Should have thrown SessionBusyError');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionBusyError);
        expect((error as SessionBusyError).sessionId).toBe(session.id);
        expect((error as SessionBusyError).code).toBe('SESSION_BUSY');
      }
    });
  });

  describe('5. 会话管理功能', () => {
    it('应该能够列出所有会话', async () => {
      // 先设置当前项目，这样 list() 才能返回会话
      await sessionManager.setCurrentProject('/test/workspace');

      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });

      // 获取第一个会话的项目 ID
      const projectId = session1.projectId;

      const sessions = await sessionManager.list(projectId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].title).toBe('Session 1');
      expect(sessions[1].title).toBe('Session 2');
    });

    it('应该能够删除会话', async () => {
      await sessionManager.setCurrentProject('/test/workspace');

      const session = await sessionManager.create({ title: 'To Delete' });

      await sessionManager.delete(session.id);

      const sessions = await sessionManager.list(session.projectId);
      expect(sessions).toHaveLength(0);
    });

    it('应该能够获取已存在的会话', async () => {
      const created = await sessionManager.create({ title: 'Test Session' });

      const retrieved = await sessionManager.get(created.id);

      expect(retrieved.id).toBe(created.id);
    });

    it('应该能够关闭所有会话', async () => {
      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });

      await sessionManager.closeAll();

      await expect(session1.sendMessage('Should fail')).rejects.toThrow();
      await expect(session2.sendMessage('Should fail')).rejects.toThrow();
    });
  });

  describe('6. 实际场景测试', () => {
    it('应该支持多用户并发场景', async () => {
      // 模拟三个用户同时创建会话并发送消息
      const user1Session = await sessionManager.create({ title: 'User 1' });
      const user2Session = await sessionManager.create({ title: 'User 2' });
      const user3Session = await sessionManager.create({ title: 'User 3' });

      // 每个用户只发送一条消息（因为同一会话不能并发发送）
      const results = await Promise.all([
        user1Session.sendMessage('Hello from User 1'),
        user2Session.sendMessage('Hello from User 2'),
        user3Session.sendMessage('Hello from User 3'),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
    });

    it('应该支持会话状态的独立性', async () => {
      const session1 = await sessionManager.create({ title: 'Session 1' });
      const session2 = await sessionManager.create({ title: 'Session 2' });

      const state1 = session1.getState();
      const state2 = session2.getState();

      expect(state1.sessionId).toBe(session1.id);
      expect(state2.sessionId).toBe(session2.id);
      expect(state1.sessionId).not.toBe(state2.sessionId);
    });
  });
});
