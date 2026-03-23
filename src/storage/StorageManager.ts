import type { IFileSystem } from './utils/fs';
import type { IStorageAPI, ProjectMeta, StorageSessionMeta, Message } from './types';
import { ProjectStorage } from './ProjectStorage';
import { SessionStorage } from './SessionStorage';

/**
 * 存储管理器
 * 整合 ProjectStorage 和 SessionStorage，提供统一的存储 API
 */
export class StorageManager implements IStorageAPI {
  private projectStorage: ProjectStorage;
  private sessionStorage: SessionStorage;

  constructor(fs: IFileSystem, baseDir: string = '~/.prism-agent/projects') {
    this.projectStorage = new ProjectStorage(fs, baseDir);
    this.sessionStorage = new SessionStorage(fs, baseDir, this.projectStorage);
  }

  // ===== 项目管理 =====

  async getOrCreateProject(projectPath: string): Promise<ProjectMeta> {
    return await this.projectStorage.getOrCreateProject(projectPath);
  }

  async getProject(projectId: string): Promise<ProjectMeta | null> {
    return await this.projectStorage.getProject(projectId);
  }

  async updateProjectActivity(projectId: string): Promise<void> {
    await this.projectStorage.updateProjectActivity(projectId);
  }

  // ===== 会话管理 =====

  async listSessions(projectId: string): Promise<StorageSessionMeta[]> {
    return await this.projectStorage.listSessions(projectId);
  }

  async createSession(projectId: string, title: string): Promise<StorageSessionMeta> {
    return await this.sessionStorage.createSession(projectId, title);
  }

  async loadSession(sessionId: string): Promise<Message[]> {
    return await this.sessionStorage.loadSession(sessionId);
  }

  async appendMessage(sessionId: string, message: Message): Promise<void> {
    await this.sessionStorage.appendMessage(sessionId, message);
  }

  async appendMessages(sessionId: string, messages: Message[]): Promise<void> {
    await this.sessionStorage.appendMessages(sessionId, messages);
  }

  async updateSessionMeta(sessionId: string, updates: Partial<StorageSessionMeta>): Promise<void> {
    await this.sessionStorage.updateSessionMeta(sessionId, updates);
  }

  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    await this.sessionStorage.updateSessionMessages(sessionId, messages);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionStorage.deleteSession(sessionId);
  }
}
