import type { Message } from '../types';

// 重新导出 Message 类型
export type { Message };

/**
 * 项目元数据
 */
export interface ProjectMeta {
  /** 项目唯一 ID */
  id: string;
  /** 项目原始路径 */
  originalPath: string;
  /** 项目名称 */
  name: string;
  /** 创建时间（Unix 毫秒时间戳） */
  createdAt: number;
  /** 最后活动时间（Unix 毫秒时间戳） */
  lastActivity: number;
  /** 会话数量 */
  sessionCount: number;
}

/**
 * 会话元数据（存储专用）
 */
export interface StorageSessionMeta {
  /** 会话唯一 ID */
  id: string;
  /** 所属项目 ID */
  projectId: string;
  /** 会话标题 */
  title: string;
  /** 消息数量 */
  messageCount: number;
  /** 创建时间（Unix 毫秒时间戳） */
  createdAt: number;
  /** 更新时间（Unix 毫秒时间戳） */
  updatedAt: number;
  /** 是否置顶 */
  pinned?: boolean;
  /** 置顶时间（Unix 毫秒时间戳） */
  pinnedAt?: number;
}

/**
 * 项目数据
 */
export interface ProjectData {
  /** 项目唯一 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目原始路径 */
  originalPath: string;
  /** 创建时间（Unix 毫秒时间戳） */
  createdAt: number;
  /** 最后活动时间（Unix 毫秒时间戳） */
  lastActivity: number;
  /** 会话列表 */
  sessions: StorageSessionMeta[];
}

/**
 * 存储 API 接口
 */
export interface IStorageAPI {
  /**
   * 获取或创建项目
   * @param projectPath - 项目路径
   * @returns 项目元数据
   */
  getOrCreateProject(projectPath: string): Promise<ProjectMeta>;
  /**
   * 获取项目
   * @param projectId - 项目 ID
   * @returns 项目元数据，不存在时返回 null
   */
  getProject(projectId: string): Promise<ProjectMeta | null>;
  /**
   * 更新项目活动时间
   * @param projectId - 项目 ID
   */
  updateProjectActivity(projectId: string): Promise<void>;
  /**
   * 列出项目的所有会话
   * @param projectId - 项目 ID
   * @returns 会话元数据列表
   */
  listSessions(projectId: string): Promise<StorageSessionMeta[]>;
  /**
   * 创建新会话
   * @param projectId - 项目 ID
   * @param title - 会话标题
   * @returns 会话元数据
   */
  createSession(projectId: string, title: string): Promise<StorageSessionMeta>;
  /**
   * 加载会话消息
   * @param sessionId - 会话 ID
   * @returns 消息列表
   */
  loadSession(sessionId: string): Promise<Message[]>;
  /**
   * 追加单条消息
   * @param sessionId - 会话 ID
   * @param message - 消息内容
   */
  appendMessage(sessionId: string, message: Message): Promise<void>;
  /**
   * 追加多条消息
   * @param sessionId - 会话 ID
   * @param messages - 消息列表
   */
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
  /**
   * 更新会话元数据
   * @param sessionId - 会话 ID
   * @param updates - 要更新的字段
   */
  updateSessionMeta(sessionId: string, updates: Partial<StorageSessionMeta>): Promise<void>;
  /**
   * 更新会话的所有消息
   * @param sessionId - 会话 ID
   * @param messages - 新的消息列表
   */
  updateSessionMessages(sessionId: string, messages: Message[]): Promise<void>;
  /**
   * 删除会话
   * @param sessionId - 会话 ID
   */
  deleteSession(sessionId: string): Promise<void>;
}
