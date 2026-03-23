/**
 * 核心类型验证测试
 */
import { describe, it, expect } from 'vitest';
import type { Message, ChatSession, SessionMeta, ProjectMeta, FileInfo } from '../common';
import type { Part } from '../parts';

describe('Core Types', () => {
  describe('Message', () => {
    it('应该正确定义 Message 类型', () => {
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        parts: [] as Part[],
        timestamp: Date.now(),
      };
      expect(message.role).toBe('user');
      expect(message.id).toBe('msg-1');
    });

    it('应该支持可选字段', () => {
      const message: Message = {
        role: 'assistant',
        parts: [] as Part[],
        timestamp: Date.now(),
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
      expect(message.finishReason).toBe('stop');
      expect(message.usage?.totalTokens).toBe(30);
    });
  });

  describe('ChatSession', () => {
    it('应该正确定义 ChatSession 类型', () => {
      const session: ChatSession = {
        id: 'session-1',
        title: 'Test Session',
        projectId: 'project-1',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(session.messages).toEqual([]);
      expect(session.title).toBe('Test Session');
    });
  });

  describe('SessionMeta', () => {
    it('应该正确定义 SessionMeta 类型', () => {
      const meta: SessionMeta = {
        id: 'session-1',
        title: 'Test',
        projectId: 'project-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 5,
      };
      expect(meta.messageCount).toBe(5);
    });
  });

  describe('ProjectMeta', () => {
    it('应该正确定义 ProjectMeta 类型', () => {
      const project: ProjectMeta = {
        id: 'project-1',
        path: '/path/to/project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sessionCount: 3,
      };
      expect(project.sessionCount).toBe(3);
    });
  });

  describe('FileInfo', () => {
    it('应该正确定义 FileInfo 类型', () => {
      const fileInfo: FileInfo = {
        name: 'test.txt',
        path: '/path/to/test.txt',
        is_dir: false,
        is_file: true,
        size: 1024,
        modified: Date.now(),
      };
      expect(fileInfo.is_file).toBe(true);
      expect(fileInfo.size).toBe(1024);
    });
  });
});
