// packages/core/src/types/sdk.ts

/**
 * SDK 配置选项
 */
export interface PrismAgentOptions {
  /** 工作目录路径 */
  workingDir: string;
  /** 配置文件目录（默认 ~/.prism-agent） */
  configDir?: string;
  /** 日志级别（默认 info） */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

// ========== 事件类型定义 ==========

/**
 * SDK 事件基础属性
 */
interface SDKEventBase {
  /** 事件时间戳（Unix 毫秒） */
  timestamp: number;
}

/**
 * 消息增量事件
 */
export interface MessageDeltaEvent extends SDKEventBase {
  sessionId: string;
  messageId: string;
  text: string;
}

/**
 * 消息完成事件
 */
export interface MessageDoneEvent extends SDKEventBase {
  sessionId: string;
  messageId: string;
  finishReason?: string;
}

/**
 * 推理增量事件
 */
export interface ReasoningDeltaEvent extends SDKEventBase {
  sessionId: string;
  text: string;
}

/**
 * 工具开始事件
 */
export interface ToolStartEvent extends SDKEventBase {
  sessionId: string;
  toolName: string;
  arguments: Record<string, any>;
}

/**
 * 工具完成事件
 */
export interface ToolDoneEvent extends SDKEventBase {
  sessionId: string;
  toolName: string;
  result: string;
  success: boolean;
  duration: number;
}

/**
 * 会话创建事件
 */
export interface SessionCreatedEvent extends SDKEventBase {
  sessionId: string;
  title: string;
  projectId: string;
}

/**
 * 会话删除事件
 */
export interface SessionDeletedEvent extends SDKEventBase {
  sessionId: string;
}

/**
 * 项目变更事件
 */
export interface ProjectChangedEvent extends SDKEventBase {
  projectId: string;
  path: string;
}

/**
 * 处理状态变更事件
 */
export interface ProcessingChangedEvent extends SDKEventBase {
  isProcessing: boolean;
  currentTask: string | null;
}

/**
 * 错误事件
 */
export interface ErrorEvent extends SDKEventBase {
  code: string;
  message: string;
  details?: any;
}
