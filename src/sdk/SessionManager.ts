/**
 * SessionManager - 会话管理器
 *
 * 负责会话的生命周期管理，管理当前项目上下文，持有活跃会话的 Map
 */

import type { IStorageAPI, ProjectMeta, StorageSessionMeta } from '../storage/types';
import type { ToolRegistry } from '../tools/ToolRegistry';
import type { CreateSessionOptions, SessionInfo } from './types';
import { SessionHandle } from './SessionHandle';
import type { SessionState } from './types';
import { SDKEventBus } from './SDKEventBus';
import { SessionNotFoundError } from './errors';

export class SessionManager {
  private sessions: Map<string, SessionHandle> = new Map();
  private currentProject: ProjectMeta | null = null;
  private eventBus: SDKEventBus;
  private storage: IStorageAPI;
  private toolRegistry: ToolRegistry;
  private workspace: string;

  constructor(
    storage: IStorageAPI,
    toolRegistry: ToolRegistry,
    eventBus: SDKEventBus,  // 传入共享的事件总线
    workspace: string
  ) {
    this.storage = storage;
    this.toolRegistry = toolRegistry;
    this.workspace = workspace;
    this.eventBus = eventBus;  // 使用传入的事件总线，而不是创建新的
  }

  /**
   * 创建新会话
   * @param options - 创建会话选项
   * @returns SessionHandle - 会话句柄
   */
  async create(options: CreateSessionOptions = {}): Promise<SessionHandle> {
    // 确定 projectId
    let projectId: string;
    if (options.projectId) {
      // 使用指定的项目
      const project = await this.storage.getProject(options.projectId);
      if (!project) {
        throw new Error(`Project not found: ${options.projectId}`);
      }
      projectId = project.id;
    } else if (this.currentProject) {
      // 使用当前项目
      projectId = this.currentProject.id;
    } else {
      // 如果没有指定项目和当前项目，使用默认项目
      // 在实际使用中，应该要求用户先设置项目
      // 这里为了测试方便，我们自动创建一个默认项目
      const defaultProject = await this.storage.getOrCreateProject('/default/workspace');
      projectId = defaultProject.id;
    }

    // 创建会话元数据
    const sessionMeta = await this.storage.createSession(
      projectId,
      options.title || 'New Session'
    );

    // 创建会话句柄
    const session = new SessionHandle(
      sessionMeta.id,
      sessionMeta.projectId,
      this.storage,
      this.toolRegistry,
      this.eventBus,
      this.workspace
    );

    // 添加到会话映射
    this.sessions.set(sessionMeta.id, session);

    // 监听会话关闭事件，自动从映射中移除
    session.on('closed', () => {
      this.sessions.delete(sessionMeta.id);
    });

    return session;
  }

  /**
   * 获取已存在的会话句柄
   * @param id - 会话 ID
   * @returns SessionHandle - 会话句柄
   * @throws SessionNotFoundError - 会话不存在
   */
  async get(id: string): Promise<SessionHandle> {
    // 首先检查内存中是否已有实例
    const existingSession = this.sessions.get(id);
    if (existingSession) {
      return existingSession;
    }

    // 从存储加载会话
    const messages = await this.storage.loadSession(id);
    if (!messages) {
      throw new SessionNotFoundError(id);
    }

    // 从存储获取会话元数据
    // 注意：这里我们无法直接从 IStorageAPI 获取单个会话的元数据
    // 我们需要从会话消息中推断或使用其他方式
    // 为了简化，我们假设可以从消息中获取 projectId
    // 在实际实现中，可能需要添加 IStorageAPI.getSessionMeta(id) 方法

    // 暂时我们使用一个简化的方法：从第一条消息中获取（如果存在）
    // 或者创建一个临时的会话元数据
    const projectId = messages.length > 0
      ? (messages[0] as any).projectId || 'default'
      : 'default';

    // 创建会话句柄
    const session = new SessionHandle(
      id,
      projectId,
      this.storage,
      this.toolRegistry,
      this.eventBus,
      this.workspace
    );

    // 从消息历史恢复处理状态
    // 检查最后一条消息是否有处理状态
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1] as any;
      // 如果最后一条消息是 assistant 消息且没有完成状态，说明还在处理中
      if (lastMessage.role === 'assistant' && lastMessage.finishReason && lastMessage.finishReason !== 'stop' && lastMessage.finishReason !== 'error') {
        session.setProcessing(true, lastMessage.currentTask || 'Recovering...');
      } else {
        // 否则设置为未处理状态（包括 finishReason 为 undefined 的情况）
        session.setProcessing(false);
      }
    } else {
      // 否则设置为未处理状态
      session.setProcessing(false);
    }

    // 添加到会话映射
    this.sessions.set(id, session);

    // 监听会话关闭事件，自动从映射中移除
    session.on('closed', () => {
      this.sessions.delete(id);
    });

    return session;
  }

  /**
   * 列出会话元数据
   * @param projectId - 可选的项目 ID，如果不提供则列出所有会话
   * @returns SessionInfo[] - 会话元数据列表
   */
  async list(projectId?: string): Promise<SessionInfo[]> {
    if (projectId) {
      const sessions = await this.storage.listSessions(projectId);
      return sessions.map(this.toSessionInfo);
    }

    // 如果没有指定 projectId，使用当前项目
    if (this.currentProject) {
      const sessions = await this.storage.listSessions(this.currentProject.id);
      return sessions.map(this.toSessionInfo);
    }

    // 如果没有当前项目，返回空数组
    return [];
  }

  /**
   * 删除会话
   * @param id - 会话 ID
   */
  async delete(id: string): Promise<void> {
    // 先关闭会话（如果已加载）
    const session = this.sessions.get(id);
    if (session) {
      await session.close();
      this.sessions.delete(id);
    }

    // 从存储中删除
    await this.storage.deleteSession(id);
  }

  /**
   * 关闭所有会话
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.sessions.values()).map(session => session.close());
    await Promise.all(closePromises);
    this.sessions.clear();
  }

  /**
   * 更新会话元数据
   * @param sessionId - 会话 ID
   * @param updates - 更新内容
   */
  async update(sessionId: string, updates: { title?: string; pinned?: boolean; pinnedAt?: number }): Promise<void> {
    await this.storage.updateSessionMeta(sessionId, updates);
  }

  /**
   * 获取当前项目
   * @returns ProjectMeta | null - 当前项目元数据
   */
  getCurrentProject(): ProjectMeta | null {
    return this.currentProject;
  }

  /**
   * 设置当前项目
   * @param path - 项目路径
   */
  async setCurrentProject(path: string): Promise<void> {
    const project = await this.storage.getOrCreateProject(path);
    this.currentProject = project;
  }

  /**
   * 获取事件总线
   * @returns SDKEventBus - 事件总线实例
   */
  getEventBus(): SDKEventBus {
    return this.eventBus;
  }

  /**
   * 将存储会话元数据转换为会话信息
   */
  private toSessionInfo(meta: StorageSessionMeta): SessionInfo {
    return {
      id: meta.id,
      title: meta.title,
      projectId: meta.projectId,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      pinned: meta.pinned,
      pinnedAt: meta.pinnedAt,
    };
  }
}
