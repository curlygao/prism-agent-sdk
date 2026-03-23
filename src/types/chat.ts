/**
 * 消息相关类型定义
 *
 * 从 src/lib/types/chat.ts 迁移并整理
 * 只保留 Message 类型，其他类型已在各自模块中定义
 */

import type { Part, TokenUsage, FinishReason } from './parts';

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 消息接口（重构后）
 *
 * 基于 Part 架构的消息类型
 */
export interface Message {
  /** 消息唯一标识 */
  id?: string;
  /** 消息角色 */
  role: MessageRole;
  /** 父消息 ID */
  parentId?: string;
  /** Part 数组（核心数据结构） */
  parts: Part[];
  /** 时间戳 */
  timestamp: number;
  /** 创建时间 */
  createdAt?: number;
  /** 结束原因 */
  finishReason?: FinishReason;
  /** Token 使用统计 */
  usage?: TokenUsage;
}
