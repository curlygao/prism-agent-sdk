import type { AgentResponse } from '../types/agent';

/**
 * 会话状态
 */
export interface SessionState {
  /** 会话唯一 ID */
  readonly sessionId: string;
  /** 所属项目 ID */
  readonly projectId: string;
  /** 创建时间 */
  readonly createdAt: number;

  /** 处理状态 */
  processingState: {
    isProcessing: boolean;
    currentTask: string | null;
  };
  /** 当前消息 ID */
  currentMessageId?: string;
}

/**
 * 会话事件类型
 */
export type SessionEvent =
  | 'text:start'
  | 'text:delta'
  | 'text:done'
  | 'reasoning:start'
  | 'reasoning:delta'
  | 'reasoning:done'
  | 'tool:call:start'
  | 'tool:call:done'
  | 'tool:execute:start'
  | 'tool:execute:done'
  | 'tool:execute:error'
  | 'agent:done'
  | 'error'
  | 'closed';

/**
 * 会话信息（元数据）
 */
export interface SessionInfo {
  id: string;
  title: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  pinnedAt?: number;
}

/**
 * 创建会话选项
 */
export interface CreateSessionOptions {
  title?: string;
  projectId?: string;
}

/**
 * 发送消息选项
 */
export interface SendOptions {
  abortSignal?: AbortSignal;
}

/**
 * SessionHandle 接口
 *
 * 会话句柄的公共接口定义
 */
export interface SessionHandle {
  /** 会话 ID */
  readonly id: string;
  /** 项目 ID */
  readonly projectId: string;
  /** 创建时间 */
  readonly createdAt: number;

  /**
   * 发送消息
   */
  sendMessage(content: string, options?: SendOptions): Promise<AgentResponse>;

  /**
   * 监听事件
   */
  on(event: SessionEvent, handler: (data: any) => void): void;

  /**
   * 移除监听器
   */
  off(event: SessionEvent, handler: (data: any) => void): void;

  /**
   * 一次性监听
   */
  once(event: SessionEvent, handler: (data: any) => void): void;

  /**
   * 中止当前处理
   */
  abort(): void;

  /**
   * 关闭会话
   */
  close(): Promise<void>;
}
