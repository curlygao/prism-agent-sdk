import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../SessionManager';
import { SDKEventBus } from '../SDKEventBus';
import type { IStorageAPI, ProjectMeta, StorageSessionMeta } from '../../storage/types';
import type { ToolRegistry } from '../../tools/ToolRegistry';
import { SessionNotFoundError } from '../errors';

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockStorage: IStorageAPI;
  let mockToolRegistry: ToolRegistry;
  let mockEventBus: SDKEventBus;
  let mockProject: ProjectMeta;
  let mockSessionMeta: StorageSessionMeta;

  beforeEach(() => {
    // 创建 mock 对象
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

    mockToolRegistry = {
      toVercelAITools: vi.fn().mockReturnValue({}),
    } as unknown as ToolRegistry;

    mockEventBus = new SDKEventBus();

    mockProject = {
      id: 'project-1',
      originalPath: '/path/to/project',
      name: 'Test Project',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      sessionCount: 1,
    };

    mockSessionMeta = {
      id: 'session-1',
      projectId: 'project-1',
      title: 'Test Session',
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    manager = new SessionManager(mockStorage, mockToolRegistry, mockEventBus, '/workspace');
  });

  afterEach(async () => {
    await manager.closeAll();
  });

  describe('初始化', () => {
    it('应该正确初始化', () => {
      expect(manager).toBeDefined();
    });

    it('应该没有当前项目', () => {
      const currentProject = manager.getCurrentProject();
      expect(currentProject).toBeNull();
    });
  });

  describe('create', () => {
    it('应该创建新会话并返回 SessionHandle', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      // 先设置当前项目
      await manager.setCurrentProject('/path/to/project');

      const session = await manager.create({ title: 'Test Session' });

      expect(session).toBeDefined();
      expect(session.id).toBe('session-1');
      expect(session.projectId).toBe('project-1');
    });

    it('应该使用当前项目创建会话（如果没有指定 projectId）', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      // 先设置当前项目
      await manager.setCurrentProject('/path/to/project');

      const session = await manager.create({ title: 'Test Session' });

      expect(session.projectId).toBe('project-1');
    });

    it('应该使用指定的 projectId 创建会话', async () => {
      vi.mocked(mockStorage.getProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      const session = await manager.create({
        title: 'Test Session',
        projectId: 'project-1',
      });

      expect(session.projectId).toBe('project-1');
    });
  });

  describe('get', () => {
    it('应该获取已存在的会话（返回同一实例）', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      await manager.setCurrentProject('/path/to/project');

      const session1 = await manager.create({ title: 'Test Session' });
      const session2 = await manager.get('session-1');

      expect(session1).toBe(session2);
    });

    it('应该从存储加载会话（如果未在内存中）', async () => {
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      const session = await manager.get('session-1');

      expect(session).toBeDefined();
      expect(session.id).toBe('session-1');
    });

    it('获取不存在的会话应该抛出错误', async () => {
      vi.mocked(mockStorage.loadSession).mockResolvedValue(null);

      await expect(manager.get('non-existent')).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('list', () => {
    it('应该列出所有会话（使用当前项目）', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      await manager.setCurrentProject('/path/to/project');

      const sessions = [
        { ...mockSessionMeta, id: 'session-1' },
        { ...mockSessionMeta, id: 'session-2', title: 'Session 2' },
      ];

      vi.mocked(mockStorage.listSessions).mockResolvedValue(sessions);

      const result = await manager.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-1');
      expect(result[1].id).toBe('session-2');
    });

    it('应该列出指定项目的会话', async () => {
      const sessions = [
        { ...mockSessionMeta, id: 'session-1', projectId: 'project-1' },
      ];

      vi.mocked(mockStorage.listSessions).mockResolvedValue(sessions);

      const result = await manager.list('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('project-1');
    });

    it('应该返回会话元数据', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      await manager.setCurrentProject('/path/to/project');

      vi.mocked(mockStorage.listSessions).mockResolvedValue([mockSessionMeta]);

      const result = await manager.list();

      expect(result[0]).toMatchObject({
        id: 'session-1',
        projectId: 'project-1',
        title: 'Test Session',
      });
    });
  });

  describe('delete', () => {
    it('应该删除会话', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);
      vi.mocked(mockStorage.deleteSession).mockResolvedValue();

      await manager.setCurrentProject('/path/to/project');
      await manager.create({ title: 'Test Session' });
      await manager.delete('session-1');

      expect(mockStorage.deleteSession).toHaveBeenCalledWith('session-1');
    });

    it('删除后应该从会话映射中移除', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);
      vi.mocked(mockStorage.deleteSession).mockResolvedValue();

      await manager.setCurrentProject('/path/to/project');
      await manager.create({ title: 'Test Session' });
      await manager.delete('session-1');

      // 尝试获取已删除的会话应该从存储重新加载
      // 而不是返回内存中的实例
      vi.mocked(mockStorage.loadSession).mockResolvedValue(null);

      await expect(manager.get('session-1')).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('closeAll', () => {
    it('应该关闭所有会话', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession)
        .mockResolvedValueOnce(mockSessionMeta)
        .mockResolvedValueOnce({ ...mockSessionMeta, id: 'session-2' });
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      await manager.setCurrentProject('/path/to/project');
      await manager.create({ title: 'Session 1' });
      await manager.create({ title: 'Session 2' });

      const closeSpy1 = vi.spyOn(await (await manager.get('session-1')) as any, 'close');
      const closeSpy2 = vi.spyOn(await (await manager.get('session-2')) as any, 'close');

      await manager.closeAll();

      expect(closeSpy1).toHaveBeenCalled();
      expect(closeSpy2).toHaveBeenCalled();
    });

    it('关闭所有会话后应该清空会话映射', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);
      vi.mocked(mockStorage.createSession).mockResolvedValue(mockSessionMeta);
      vi.mocked(mockStorage.loadSession).mockResolvedValue([]);

      await manager.setCurrentProject('/path/to/project');
      await manager.create({ title: 'Test Session' });
      await manager.closeAll();

      // 尝试获取已关闭的会话应该从存储重新加载
      vi.mocked(mockStorage.loadSession).mockResolvedValue(null);

      await expect(manager.get('session-1')).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('getCurrentProject', () => {
    it('应该返回当前项目', () => {
      expect(manager.getCurrentProject()).toBeNull();
    });
  });

  describe('setCurrentProject', () => {
    it('应该设置当前项目', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);

      await manager.setCurrentProject('/path/to/project');

      const currentProject = manager.getCurrentProject();
      expect(currentProject).toEqual(mockProject);
    });

    it('应该使用存储 API 获取或创建项目', async () => {
      vi.mocked(mockStorage.getOrCreateProject).mockResolvedValue(mockProject);

      await manager.setCurrentProject('/path/to/project');

      expect(mockStorage.getOrCreateProject).toHaveBeenCalledWith('/path/to/project');
    });
  });
});
