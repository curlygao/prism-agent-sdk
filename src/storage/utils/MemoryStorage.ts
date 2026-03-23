// packages/core/src/storage/utils/MemoryStorage.ts
import type { IStorageAPI, StorageSessionMeta, ProjectMeta } from '../types';
import type { Message } from '../../types/chat';

/**
 * 内存存储实现 - 用于开发测试
 */
export class MemoryStorage implements IStorageAPI {
  private sessions = new Map<string, StorageSessionMeta>();
  private messages = new Map<string, Message[]>();
  private projects = new Map<string, ProjectMeta>();

  async getOrCreateProject(projectPath: string): Promise<ProjectMeta> {
    let project = Array.from(this.projects.values()).find(p => p.originalPath === projectPath);
    if (!project) {
      project = {
        id: `proj_${Date.now()}`,
        originalPath: projectPath,
        name: projectPath.split('/').pop() || 'Unnamed Project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };
      this.projects.set(project.id, project);
    }
    return project;
  }

  async getProject(projectId: string): Promise<ProjectMeta | null> {
    return this.projects.get(projectId) || null;
  }

  async updateProjectActivity(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.lastActivity = Date.now();
    }
  }

  async listSessions(projectId: string): Promise<StorageSessionMeta[]> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.projectId === projectId || projectId === ''
    );
  }

  async createSession(projectId: string, title: string): Promise<StorageSessionMeta> {
    const session: StorageSessionMeta = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      projectId,
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);

    return session;
  }

  async loadSession(sessionId: string): Promise<Message[]> {
    return this.messages.get(sessionId) || [];
  }

  async appendMessage(sessionId: string, message: Message): Promise<void> {
    const messages = this.messages.get(sessionId) || [];
    messages.push(message);
    this.messages.set(sessionId, messages);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = messages.length;
      session.updatedAt = Date.now();
    }
  }

  async appendMessages(sessionId: string, messages: Message[]): Promise<void> {
    const existingMessages = this.messages.get(sessionId) || [];
    existingMessages.push(...messages);
    this.messages.set(sessionId, existingMessages);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = existingMessages.length;
      session.updatedAt = Date.now();
    }
  }

  async updateSessionMeta(sessionId: string, updates: Partial<StorageSessionMeta>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.updatedAt = Date.now();
    }
  }

  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    this.messages.set(sessionId, messages);

    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = messages.length;
      session.updatedAt = Date.now();
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
  }
}
