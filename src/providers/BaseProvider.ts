/**
 * LLM Provider 抽象基类
 *
 * 定义统一的 Provider 接口，Core 层通过此接口调用 LLM
 * Provider 层不知道 Part 的存在，只返回原始数据
 */

import type { Message } from '../types/chat';
import type {
  ProviderStreamEvent,
  EndData,
  StreamOptions,
  TokenUsage,
  FinishReason,
} from './types';

// ============================================================================
// 旧类型定义（向后兼容）
// ============================================================================

/**
 * @deprecated 使用 StreamOptions
 */
export interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
}

/**
 * @deprecated 使用 ProviderStreamEvent
 */
export interface StreamChunk {
  type: 'content' | 'reasoning' | 'tool_call' | 'end';
  data?: any;
}

/**
 * @deprecated 使用 ProviderStreamEvent
 */
export interface StreamChunkObject {
  type: string;
  data?: any;
}

/**
 * @deprecated 使用 EndData
 */
export interface ChatCompletionResponse {
  content?: string;
  toolCalls?: any[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}


/**
 * 工具调用数据结构（用于事件）
 */
export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export abstract class BaseProvider {
  /**
   * 提供商名称
   */
  abstract name: string;

  /**
   * API 基础 URL
   */
  abstract apiBase: string;

  /**
   * API 密钥
   */
  abstract apiKey: string;

  /**
   * 流式调用 LLM（唯一接口）
   *
   * @param messages - 消息历史（核心层 Message 格式）
   * @param options - 流式选项
   * @returns AsyncGenerator，yield ProviderStreamEvent，return EndData
   */
  abstract chatStream(
    messages: Message[],
    options: StreamOptions
  ): AsyncGenerator<ProviderStreamEvent, EndData>;

  /**
   * 获取模型列表（可选实现）
   */
  async listModels(): Promise<string[]> {
    return [];
  }

  /**
   * 验证配置（可选实现）
   */
  validateConfig(): boolean {
    return !!this.apiKey;
  }

  /**
   * 辅助方法：将核心层 Message 转换为 Provider API 格式
   * 默认实现转换为 OpenAI 兼容格式
   *
   * 子类可以重写此方法以支持特定 API 格式
   */
  protected toProviderMessages(messages: Message[]): any[] {
    return messages.map((msg) => {
      const apiMsg: any = { role: msg.role };

      if (!msg.parts || !Array.isArray(msg.parts)) {
        apiMsg.content = '';
        return apiMsg;
      }

      // 从 parts 中提取文本内容
      const textParts = msg.parts.filter((p) => p.type === 'text');
      if (textParts.length > 0) {
        apiMsg.content = textParts.map((p) => (p as any).text).join('');
      }

      // 提取工具调用（assistant 消息）
      const toolParts = msg.parts.filter((p) => p.type === 'tool') as any[];
      if (toolParts.length > 0 && msg.role === 'assistant') {
        apiMsg.tool_calls = toolParts.map((p) => ({
          id: p.callID,
          type: 'function',
          function: {
            name: p.tool,
            arguments: JSON.stringify(p.state.input || {}),
          },
        }));
      }

      // 工具结果消息（tool 消息）
      if (msg.role === 'tool' && toolParts.length > 0) {
        const toolPart = toolParts[0];
        apiMsg.tool_call_id = toolPart.callID;
        apiMsg.content = toolPart.state?.output || toolPart.state?.error || '';
      }

      return apiMsg;
    });
  }

  /**
   * 辅助方法：解析工具调用参数
   */
  protected parseToolCallArguments(argsString: string): Record<string, any> {
    try {
      return JSON.parse(argsString);
    } catch {
      return {};
    }
  }
}

// 导出类型，供外部使用
export type { ProviderStreamEvent, EndData, StreamOptions, TokenUsage, FinishReason } from './types';
