// packages/core/src/sdk/StorageModule.ts

import type { IStorageAPI, ProjectMeta } from '../storage/types';

/**
 * Storage 模块
 * 负责纯持久化操作，无业务逻辑
 */
export class StorageModule {
  constructor(storage: IStorageAPI) {
    this._storage = storage;
  }

  /**
   * 获取项目（按 ID）
   */
  async getProject(id: string) {
    return this.storage.getProject(id);
  }

  /**
   * 按路径查找项目
   * @todo 这个方法实现有问题，需要重新设计
   */
  async findProjectByPath(path: string): Promise<ProjectMeta | null> {
    // 暂时返回 null，避免类型错误
    return null;
  }

  /**
   * 获取或创建项目
   */
  async getOrCreateProject(path: string) {
    return this.storage.getOrCreateProject(path);
  }

  /**
   * 获取项目的所有会话
   */
  async listSessions(projectId: string) {
    return this.storage.listSessions(projectId);
  }

  /**
   * 获取会话详情
   */
  async getSession(id: string) {
    const sessions = await this.storage.listSessions?.('') ?? [];
    return sessions.find(s => s.id === id) ?? null;
  }

  /**
   * 获取会话消息历史
   */
  async getSessionMessages(sessionId: string) {
    return this.storage.loadSession(sessionId);
  }

  /**
   * 内部：直接访问存储 API（供其他模块使用）
   */
  get storage(): IStorageAPI {
    return this._storage;
  }

  private _storage: IStorageAPI;
}
