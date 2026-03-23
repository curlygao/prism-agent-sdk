/**
 * Part 工厂函数
 *
 * 从 src/utils/PartFactory.ts 迁移
 * 简化版本，只包含 AgentLoop 使用的功能
 */

import type {
  Part,
  TextPart,
  ToolPart,
  ToolStatePending,
} from '../types/parts';

/**
 * Part 创建选项
 */
export interface PartCreateOptions {
  /** 所属会话 ID */
  sessionId: string;
  /** 所属消息 ID */
  messageId: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 是否发布事件 */
  emitEvent?: boolean;
}

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'part'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Part 工厂函数
 */
export const PartFactory = {
  /**
   * 创建 TextPart
   */
  createTextPart(
    text: string,
    options: PartCreateOptions
  ): TextPart {
    const now = Date.now();
    const part: TextPart = {
      id: generateId('text'),
      type: 'text',
      text,
      createdAt: now,
      time: { start: now },
      sessionId: options.sessionId,
      messageId: options.messageId,
      metadata: options.metadata,
    };

    return part;
  },

  /**
   * 创建 ToolPart (Pending 状态)
   */
  createToolPart(
    callID: string,
    tool: string,
    input: Record<string, unknown>,
    raw: string,
    options: PartCreateOptions
  ): ToolPart {
    const now = Date.now();
    const state: ToolStatePending = {
      status: 'pending',
      input,
      raw,
    };

    const part: ToolPart = {
      id: generateId('tool'),
      type: 'tool',
      callID,
      tool,
      state,
      createdAt: now,
      sessionId: options.sessionId,
      messageId: options.messageId,
    };

    return part;
  },
};
