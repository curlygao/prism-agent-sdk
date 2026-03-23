/**
 * Provider 层类型定义
 *
 * 这一层不知道 Part 的存在，只负责与 LLM API 交互
 * Core 层通过这些接口调用 Provider，无需关心具体实现
 */

import type { ToolDefinition } from '../tools';

/**
 * 流式选项
 */
export interface StreamOptions {
  /** 最大 token 数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 工具定义 */
  tools?: ToolDefinition[];
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 结束原因
 */
export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'error' | 'content_filter';

/**
 * 流式事件类型
 */
export type ProviderStreamEvent = ContentEvent | ReasoningEvent | ToolCallEvent | EndEvent;

/**
 * 内容增量事件
 */
export interface ContentEvent {
  type: 'content';
  data: string;
}

/**
 * 推理增量事件
 */
export interface ReasoningEvent {
  type: 'reasoning';
  data: {
    text: string;
    id?: string;
  };
}

/**
 * 工具调用事件
 */
export interface ToolCallEvent {
  type: 'tool_call';
  data: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  };
}

/**
 * 流结束事件
 */
export interface EndEvent {
  type: 'end';
  data: EndData;
}

/**
 * 结束数据（AsyncGenerator 的返回值）
 */
export interface EndData {
  /** 结束原因 */
  finishReason: FinishReason;
  /** Token 使用统计 */
  usage?: TokenUsage;
  /** 模型名称（必须） */
  model: string;
  /** 原始响应（可选，用于调试） */
  rawResponse?: unknown;
}
