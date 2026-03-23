/**
 * Storage 集成测试
 *
 * 测试存储模块的完整功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageManager } from '../StorageManager';
import { ProjectStorage } from '../ProjectStorage';
import { SessionStorage } from '../SessionStorage';
import type { IFileSystem } from '../utils/fs';
import type { ProjectMeta, StorageSessionMeta, Message } from '../types';

/**
 * 创建内存文件系统 Mock
 */
class MockFileSystem implements IFileSystem {
  private files = new Map<string, string>();
  private directories = new Set<string>();

  constructor() {
    // 初始化根目录
    this.directories.add('/');
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        this.directories.add(current);
      }
    } else {
      this.directories.add(path);
    }
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    // 确保父目录存在
    const dir = path.substring(0, path.lastIndexOf('/')) || '/';
    this.directories.add(dir);
  }

  async appendFile(path: string, content: string): Promise<void> {
    const existing = this.files.get(path) || '';
    this.files.set(path, existing + content);
  }

  async readdir(path: string): Promise<string[]> {
    const entries: string[] = [];
    const prefix = path.endsWith('/') ? path : path + '/';

    for (const dir of this.directories) {
      if (dir.startsWith(prefix)) {
        const relative = dir.substring(prefix.length);
        const firstPart = relative.split('/')[0];
        if (firstPart && !entries.includes(firstPart)) {
          entries.push(firstPart);
        }
      }
    }

    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const relative = file.substring(prefix.length);
        const firstPart = relative.split('/')[0];
        if (firstPart && !entries.includes(firstPart) && !firstPart.includes('/')) {
          entries.push(firstPart);
        }
      }
    }

    return entries;
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async readFileLines(path: string): Promise<string[]> {
    const content = await this.readFile(path);
    return content.split('\n').filter(line => line.trim() !== '');
  }

  // 测试辅助方法
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }
}

describe('Storage 集成测试', () => {
  let mockFs: MockFileSystem;
  let storageManager: StorageManager;
  let projectStorage: ProjectStorage;
  let sessionStorage: SessionStorage;
  const testBaseDir = '/test/projects';

  beforeEach(() => {
    mockFs = new MockFileSystem();
    projectStorage = new ProjectStorage(mockFs, testBaseDir);
    sessionStorage = new SessionStorage(mockFs, testBaseDir, projectStorage);
    storageManager = new StorageManager(mockFs as any, testBaseDir);
  });

  afterEach(() => {
    mockFs.clear();
  });

  // ============================================================================
  // ProjectStorage 测试
  // ============================================================================

  describe('ProjectStorage', () => {
    it('应该创建新项目', async () => {
      const project = await projectStorage.getOrCreateProject('/test/my-project');

      expect(project).toBeDefined();
      expect(project.name).toBe('my-project');
      expect(project.originalPath).toBe('/test/my-project');
      expect(project.id).toMatch(/^proj_/);
      expect(project.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('应该获取已存在的项目', async () => {
      const project1 = await projectStorage.getOrCreateProject('/test/existing');
      const project2 = await projectStorage.getOrCreateProject('/test/existing');

      expect(project1.id).toBe(project2.id);
      expect(project1.name).toBe(project2.name);
    });

    it('应该通过 ID 获取项目', async () => {
      const created = await projectStorage.getOrCreateProject('/test/by-id');
      const found = await projectStorage.getProject(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.originalPath).toBe('/test/by-id');
    });

    it('应该返回 null 对于不存在的项目 ID', async () => {
      const found = await projectStorage.getProject('non-existent-id');
      expect(found).toBeNull();
    });

    it('应该更新项目活动时间', async () => {
      const project = await projectStorage.getOrCreateProject('/test/activity');

      await new Promise(resolve => setTimeout(resolve, 10));

      await projectStorage.updateProjectActivity(project.id);

      const updated = await projectStorage.getProject(project.id);
      expect(updated!.lastActivity).toBeGreaterThan(project.lastActivity);
    });

    it('应该列出所有项目', async () => {
      await projectStorage.getOrCreateProject('/test/proj1');
      await projectStorage.getOrCreateProject('/test/proj2');
      await projectStorage.getOrCreateProject('/test/proj3');

      const projects = await projectStorage.listAllProjects();

      expect(projects).toHaveLength(3);
      // 应该按最后活动时间排序
      expect(projects[0].lastActivity).toBeGreaterThanOrEqual(projects[1].lastActivity);
    });

    it('应该从路径提取项目名称', async () => {
      const project1 = await projectStorage.getOrCreateProject('/path/to/MyProject');
      const project2 = await projectStorage.getOrCreateProject('C:\\Projects\\AnotherProject');

      expect(project1.name).toBe('MyProject');
      expect(project2.name).toBe('AnotherProject');
    });
  });

  // ============================================================================
  // SessionStorage 测试
  // ============================================================================

  describe('SessionStorage', () => {
    let testProject: ProjectMeta;

    beforeEach(async () => {
      testProject = await projectStorage.getOrCreateProject('/test/session-project');
    });

    it('应该创建新会话', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Test Session');

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_/);
      expect(session.title).toBe('Test Session');
      expect(session.projectId).toBe(testProject.id);
      expect(session.messageCount).toBe(0);
    });

    it('应该在项目中列出会话', async () => {
      await sessionStorage.createSession(testProject.id, 'Session 1');
      await sessionStorage.createSession(testProject.id, 'Session 2');

      const sessions = await projectStorage.listSessions(testProject.id);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].title).toBe('Session 2'); // 最新创建的在前
      expect(sessions[1].title).toBe('Session 1');
    });

    it('应该加载空会话', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Empty Session');
      const messages = await sessionStorage.loadSession(session.id);

      expect(messages).toEqual([]);
    });

    it('应该追加消息到会话', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Message Session');

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
        timestamp: Date.now(),
        createdAt: Date.now(),
      };

      await sessionStorage.appendMessage(session.id, message);

      const messages = await sessionStorage.loadSession(session.id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);

      // 检查消息计数更新
      const sessions = await projectStorage.listSessions(testProject.id);
      expect(sessions[0].messageCount).toBe(1);
    });

    it('应该批量追加消息', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Batch Session');

      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'First' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Second' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
      ];

      await sessionStorage.appendMessages(session.id, messages);

      const loaded = await sessionStorage.loadSession(session.id);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('msg-1');
      expect(loaded[1].id).toBe('msg-2');
    });

    it('应该更新会话元数据', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Old Title');

      await sessionStorage.updateSessionMeta(session.id, { title: 'New Title' });

      const sessions = await projectStorage.listSessions(testProject.id);
      expect(sessions[0].title).toBe('New Title');
    });

    it('应该更新会话的所有消息', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Update Session');

      const newMessages: Message[] = [
        {
          id: 'msg-new-1',
          role: 'user',
          parts: [{ type: 'text', text: 'New message' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
      ];

      await sessionStorage.updateSessionMessages(session.id, newMessages);

      const loaded = await sessionStorage.loadSession(session.id);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('msg-new-1');
    });

    it('应该删除会话', async () => {
      const session = await sessionStorage.createSession(testProject.id, 'Delete Me');

      await sessionStorage.deleteSession(session.id);

      const messages = await sessionStorage.loadSession(session.id);
      expect(messages).toEqual([]);

      const sessions = await projectStorage.listSessions(testProject.id);
      expect(sessions.find(s => s.id === session.id)).toBeUndefined();
    });

    it('应该处理跨项目的会话', async () => {
      const project2 = await projectStorage.getOrCreateProject('/test/project-2');

      const session1 = await sessionStorage.createSession(testProject.id, 'Session 1');
      const session2 = await sessionStorage.createSession(project2.id, 'Session 2');

      const project1Sessions = await projectStorage.listSessions(testProject.id);
      const project2Sessions = await projectStorage.listSessions(project2.id);

      expect(project1Sessions).toHaveLength(1);
      expect(project2Sessions).toHaveLength(1);
      expect(project1Sessions[0].id).toBe(session1.id);
      expect(project2Sessions[0].id).toBe(session2.id);
    });
  });

  // ============================================================================
  // StorageManager 集成测试
  // ============================================================================

  describe('StorageManager 集成', () => {
    it('应该创建完整的项目和会话流程', async () => {
      // 1. 创建项目
      const project = await storageManager.getOrCreateProject('/test/flow-project');

      // 2. 创建会话
      const session = await storageManager.createSession(project.id, 'Flow Session');

      // 3. 添加消息
      const userMessage: Message = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, AI!' }],
        timestamp: Date.now(),
        createdAt: Date.now(),
      };

      await storageManager.appendMessage(session.id, userMessage);

      // 4. 加载会话
      const messages = await storageManager.loadSession(session.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].parts[0].text).toBe('Hello, AI!');

      // 5. 列出会话
      const sessions = await storageManager.listSessions(project.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].messageCount).toBe(1);
    });

    it('应该支持复杂的对话场景', async () => {
      const project = await storageManager.getOrCreateProject('/test/complex');
      const session = await storageManager.createSession(project.id, 'Complex Chat');

      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'What is the capital of France?' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'The capital of France is Paris.' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
        {
          id: 'msg-3',
          role: 'user',
          parts: [{ type: 'text', text: 'And what about Germany?' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          parts: [{ type: 'text', text: 'The capital of Germany is Berlin.' }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        },
      ];

      await storageManager.appendMessages(session.id, messages);

      const loaded = await storageManager.loadSession(session.id);
      expect(loaded).toHaveLength(4);
      expect(loaded[0].role).toBe('user');
      expect(loaded[1].role).toBe('assistant');
    });
  });

  // ============================================================================
  // 错误处理测试
  // ============================================================================

  describe('错误处理', () => {
    it('应该拒绝在不存在的项目中创建会话', async () => {
      await expect(
        sessionStorage.createSession('non-existent-project', 'Session')
      ).rejects.toThrow();
    });

    it('应该拒绝加载不存在的会话', async () => {
      await expect(
        sessionStorage.loadSession('non-existent-session')
      ).rejects.toThrow();
    });

    it('应该拒绝更新不存在的会话元数据', async () => {
      await expect(
        sessionStorage.updateSessionMeta('non-existent', { title: 'New' })
      ).rejects.toThrow();
    });

    it('应该拒绝删除不存在的会话', async () => {
      await expect(
        sessionStorage.deleteSession('non-existent-session')
      ).rejects.toThrow();
    });

    it('应该拒绝更新不存在项目的活动时间', async () => {
      await expect(
        projectStorage.updateProjectActivity('non-existent-project')
      ).rejects.toThrow();
    });

    it('应该拒绝在不存在的项目中列出会话', async () => {
      await expect(
        projectStorage.listSessions('non-existent-project')
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // 边界情况测试
  // ============================================================================

  describe('边界情况', () => {
    it('应该处理空标题的会话', async () => {
      const project = await projectStorage.getOrCreateProject('/test/empty-title');
      const session = await sessionStorage.createSession(project.id, '');

      expect(session.title).toBe('');
    });

    it('应该处理包含特殊字符的标题', async () => {
      const project = await projectStorage.getOrCreateProject('/test/special-chars');
      const specialTitle = '测试 🧪 Session & "Quotes"';

      const session = await sessionStorage.createSession(project.id, specialTitle);

      expect(session.title).toBe(specialTitle);
    });

    it('应该处理空的 Part 内容', async () => {
      const project = await projectStorage.getOrCreateProject('/test/empty-part');
      const session = await sessionStorage.createSession(project.id, 'Empty Part');

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: '' }],
        timestamp: Date.now(),
        createdAt: Date.now(),
      };

      await sessionStorage.appendMessage(session.id, message);

      const loaded = await sessionStorage.loadSession(session.id);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].parts[0].text).toBe('');
    });

    it('应该处理多个 Part 的消息', async () => {
      const project = await projectStorage.getOrCreateProject('/test/multi-part');
      const session = await sessionStorage.createSession(project.id, 'Multi Part');

      const message: Message = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Here is the response' },
          {
            type: 'tool',
            callID: 'call-1',
            tool: 'test_tool',
            state: {
              status: 'completed',
              input: { query: 'test' },
              output: 'result',
            },
          },
        ],
        timestamp: Date.now(),
        createdAt: Date.now(),
      };

      await sessionStorage.appendMessage(session.id, message);

      const loaded = await sessionStorage.loadSession(session.id);
      expect(loaded[0].parts).toHaveLength(2);
    });

    it('应该处理大量消息', async () => {
      const project = await projectStorage.getOrCreateProject('/test/large-session');
      const session = await sessionStorage.createSession(project.id, 'Large Session');

      const messages: Message[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        parts: [{ type: 'text', text: `Message ${i}` }],
        timestamp: Date.now(),
        createdAt: Date.now(),
      }));

      await sessionStorage.appendMessages(session.id, messages);

      const loaded = await sessionStorage.loadSession(session.id);
      expect(loaded).toHaveLength(1000);
    });
  });

  // ============================================================================
  // 并发操作测试
  // ============================================================================

  describe('并发操作', () => {
    it('应该支持并发创建多个会话', async () => {
      const project = await projectStorage.getOrCreateProject('/test/concurrent');

      const sessionPromises = Array.from({ length: 10 }, (_, i) =>
        sessionStorage.createSession(project.id, `Concurrent Session ${i}`)
      );

      const sessions = await Promise.all(sessionPromises);

      expect(sessions).toHaveLength(10);
      expect(new Set(sessions.map(s => s.id)).size).toBe(10); // 所有 ID 应该唯一
    });

    it('应该支持并发追加消息', async () => {
      const project = await projectStorage.getOrCreateProject('/test/concurrent-messages');
      const session = await sessionStorage.createSession(project.id, 'Concurrent Messages');

      const messagePromises = Array.from({ length: 100 }, (_, i) =>
        sessionStorage.appendMessage(session.id, {
          id: `msg-${i}`,
          role: 'user',
          parts: [{ type: 'text', text: `Message ${i}` }],
          timestamp: Date.now(),
          createdAt: Date.now(),
        })
      );

      await Promise.all(messagePromises);

      const messages = await sessionStorage.loadSession(session.id);
      expect(messages).toHaveLength(100);
    });
  });

  // ============================================================================
  // 数据持久性测试
  // ============================================================================

  describe('数据持久性', () => {
    it('应该正确序列化和反序列化消息', async () => {
      const project = await projectStorage.getOrCreateProject('/test/serialization');
      const session = await sessionStorage.createSession(project.id, 'Serialization Test');

      const originalMessage: Message = {
        id: 'msg-serialize',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Test message with unicode: 你好世界 🌍',
          },
        ],
        timestamp: 1234567890,
        createdAt: 1234567890,
        parentId: 'parent-msg',
      };

      await sessionStorage.appendMessage(session.id, originalMessage);

      const loaded = await sessionStorage.loadSession(session.id);
      expect(loaded[0]).toEqual(originalMessage);
    });

    it('应该保持项目元数据一致性', async () => {
      const project = await projectStorage.getOrCreateProject('/test/metadata');
      const session = await sessionStorage.createSession(project.id, 'Meta Test');

      // 添加消息
      await sessionStorage.appendMessage(session.id, {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
        timestamp: Date.now(),
        createdAt: Date.now(),
      });

      // 重新加载项目
      const reloaded = await projectStorage.getProject(project.id);

      expect(reloaded!.sessionCount).toBe(1);
    });
  });
});
