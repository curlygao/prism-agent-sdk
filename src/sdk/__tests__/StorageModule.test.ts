import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageModule } from '../StorageModule';
import type { IStorageAPI, ProjectMeta, StorageSessionMeta } from '../../storage/types';
import type { Message } from '../../types';

describe('StorageModule', () => {
  let module: StorageModule;
  let mockStorage: IStorageAPI;

  beforeEach(() => {
    // 创建 mock storage
    mockStorage = {
      getOrCreateProject: vi.fn(),
      getProject: vi.fn(),
      updateProjectActivity: vi.fn(),
      listSessions: vi.fn(),
      createSession: vi.fn(),
      loadSession: vi.fn(),
      appendMessage: vi.fn(),
      appendMessages: vi.fn(),
      updateSessionMeta: vi.fn(),
      updateSessionMessages: vi.fn(),
      deleteSession: vi.fn(),
    } as unknown as IStorageAPI;

    module = new StorageModule(mockStorage);
  });

  describe('基础功能', () => {
    it('应该暴露 storage 属性', () => {
      expect(module.storage).toBe(mockStorage);
    });
  });

  describe('项目操作', () => {
    it('应该能够获取项目（按 ID）', async () => {
      const mockProject: ProjectMeta = {
        id: 'proj-1',
        originalPath: '/test/path',
        name: 'Test Project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };
      vi.mocked(mockStorage.getProject).mockResolvedValue(mockProject);

      const result = await module.getProject('proj-1');
      expect(result).toEqual(mockProject);
      expect(mockStorage.getProject).toHaveBeenCalledWith('proj-1');
    });

    it('当项目不存在时应该返回 null', async () => {
      vi.mocked(mockStorage.getProject).mockResolvedValue(null);

      const result = await module.getProject('nonexistent');
      expect(result).toBeNull();
    });

    it('应该能够按路径查找项目', async () => {
      const mockProjects: ProjectMeta[] = [
        {
          id: 'proj-1',
          originalPath: '/path/to/project1',
          name: 'Project 1',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          sessionCount: 0,
        },
        {
          id: 'proj-2',
          originalPath: '/path/to/project2',
          name: 'Project 2',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          sessionCount: 0,
        },
      ];
      vi.mocked(mockStorage.listSessions as any).mockResolvedValue(mockProjects);

      const result = await module.findProjectByPath('/path/to/project2');
      expect(result).toEqual(mockProjects[1]);
      expect(result?.id).toBe('proj-2');
    });

    it('当路径不存在时应该返回 null', async () => {
      vi.mocked(mockStorage.listSessions as any).mockResolvedValue([]);

      const result = await module.findProjectByPath('/nonexistent');
      expect(result).toBeNull();
    });

    it('应该能够获取或创建项目', async () => {
      const mockProject: ProjectMeta = {
        id: 'proj-1',
        originalPath: '/test/path',
        name: 'Test Project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);

      const result = await module.getOrCreateProject('/test/path');
      expect(result).toEqual(mockProject);
      expect(mockStorage.getOrCreateProject).toHaveBeenCalledWith('/test/path');
    });
  });

  describe('会话操作', () => {
    it('应该能够获取项目的所有会话', async () => {
      const mockSessions: StorageSessionMeta[] = [
        {
          id: 'session-1',
          projectId: 'proj-1',
          title: 'Session 1',
          messageCount: 10,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'session-2',
          projectId: 'proj-1',
          title: 'Session 2',
          messageCount: 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      vi.mocked(mockStorage.listSessions).mockResolvedValue(mockSessions);

      const result = await module.listSessions('proj-1');
      expect(result).toEqual(mockSessions);
      expect(mockStorage.listSessions).toHaveBeenCalledWith('proj-1');
    });

    it('应该能够获取会话详情', async () => {
      const mockSessions: StorageSessionMeta[] = [
        {
          id: 'session-1',
          projectId: 'proj-1',
          title: 'Session 1',
          messageCount: 10,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'session-2',
          projectId: 'proj-1',
          title: 'Session 2',
          messageCount: 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      vi.mocked(mockStorage.listSessions as any).mockResolvedValue(mockSessions);

      const result = await module.getSession('session-2');
      expect(result).toEqual(mockSessions[1]);
      expect(result?.id).toBe('session-2');
    });

    it('当会话不存在时应该返回 null', async () => {
      vi.mocked(mockStorage.listSessions as any).mockResolvedValue([]);

      const result = await module.getSession('nonexistent');
      expect(result).toBeNull();
    });

    it('应该能够获取会话消息历史', async () => {
      const mockMessages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
        },
      ];
      vi.mocked(mockStorage.loadSession).mockResolvedValue(mockMessages);

      const result = await module.getSessionMessages('session-1');
      expect(result).toEqual(mockMessages);
      expect(mockStorage.loadSession).toHaveBeenCalledWith('session-1');
    });
  });
});
