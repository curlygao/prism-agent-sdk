/**
 * Agent 相关类型定义
 *
 * 从 src/lib/types/agent.ts 迁移并整理
 * 只保留 packages/core 必需的类型
 */

import type { Message } from './chat';
import type { Part, FinishReason, TokenUsage } from './parts';
import type { ToolContext } from './tools';

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  /** 消息历史 */
  history: Message[];
  /** 当前用户消息 */
  currentMessage: string;
  /** 会话 ID */
  sessionId: string;
  /** 工作区路径（可选） */
  workspace?: string;
  /** 最后一条消息 ID（用于判断循环退出） */
  lastMessageId?: string;
}

/**
 * Agent 响应
 *
 * 新架构：只包含 message（含 parts）和元数据
 * 不再有 content 和 toolCalls 字段
 * 使用者应从 message.parts 中提取需要的信息
 */
export interface AgentResponse {
  /** 完整消息（包含 parts） */
  message: Message;
  /** 结束原因 */
  finishReason?: FinishReason;
  /** Token 使用统计 */
  usage?: TokenUsage;
  /** 模型名称 */
  model?: string;
}

/**
 * Agent 选项
 */
export interface AgentOptions {
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 是否使用流式响应 */
  stream?: boolean;
}

// 重新导出 ToolContext，避免重复定义
export type { ToolContext } from './tools';
