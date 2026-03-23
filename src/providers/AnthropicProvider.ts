/**
 * Anthropic Provider
 *
 * 支持 Claude 系列 API，包括 Claude 3.7+ 的原生 reasoning
 *
 * 支持通过配置切换不同的 API 端点：
 * - Anthropic 原生: https://api.anthropic.com
 * - MiniMax Anthropic 兼容: https://api.minimaxi.com
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './BaseProvider';
import type { Message } from '../types/chat';
import type { ProviderStreamEvent, EndData, StreamOptions } from './types';

/**
 * Anthropic Provider 配置选项
 */
export interface AnthropicConfig {
  /** API 端点 base URL（不包含 /v1 后缀） */
  apiBase?: string;
  /** 模型名称，默认 claude-opus-4-5 */
  model?: string;
}

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic';
  apiBase: string;
  apiKey: string;
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey: string, config: AnthropicConfig = {}) {
    super();
    this.apiKey = apiKey;
    // Anthropic SDK 默认使用 https://api.anthropic.com，不需要 /v1 后缀
    this.apiBase = config.apiBase || 'https://api.anthropic.com';
    this.defaultModel = config.model || 'claude-opus-4-5';
    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.apiBase,
    });
  }

  /**
   * 设置默认模型
   */
  setModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.defaultModel;
  }

  async *chatStream(
    messages: Message[],
    options: StreamOptions = {}
  ): AsyncGenerator<ProviderStreamEvent, EndData> {
    const { maxTokens = 8192, temperature = 0.7, tools } = options;

    try {
      // 使用 Anthropic SDK 的流式接口
      const stream = this.client.messages.stream({
        model: this.defaultModel,
        max_tokens: maxTokens,
        temperature,
        messages: this.toAnthropicMessages(messages),
        tools: tools?.length ? this.toAnthropicTools(tools) : undefined,
      });

      let finishReason: string | undefined;
      let usage: any = undefined;

      // 用于累积工具调用参数
      const accumulatedToolCalls = new Map<string, {
        id: string;
        name: string;
        arguments: string;
        complete: boolean;
      }>();

      // 迭代流事件
      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            // 消息开始，记录 usage
            if (event.message.usage) {
              usage = {
                input_tokens: event.message.usage.input_tokens,
                output_tokens: event.message.usage.output_tokens,
              };
            }
            break;

          case 'content_block_start':
            // 内容块开始
            break;

          case 'content_block_delta':
            // 内容块增量（可能是文本、思考或工具调用参数）
            if (event.delta.type === 'text_delta') {
              yield {
                type: 'content',
                data: event.delta.text,
              };
            } else if (event.delta.type === 'thinking_delta') {
              yield {
                type: 'reasoning',
                data: { text: event.delta.thinking },
              };
            } else if (event.delta.type === 'input_json_delta') {
              // 工具调用的参数增量
              const toolUse = event as any;
              if (toolUse.index !== undefined) {
                // 找到对应的工具调用累积
                // 注意：Anthropic 流式工具调用的处理方式
              }
            }
            break;

          case 'content_block_stop':
            // 内容块结束
            break;

          case 'message_delta':
            // 消息增量，包含 finish_reason 和 usage
            if (event.delta.stop_reason) {
              finishReason = event.delta.stop_reason;
            }
            if (event.usage) {
              usage = {
                input_tokens: event.usage.input_tokens,
                output_tokens: event.usage.output_tokens,
              };
            }
            break;

          case 'message_stop':
            // 消息结束
            break;
        }
      }

      // 获取最终消息以检查工具调用
      const finalMessage = await stream.finalMessage();

      // 处理最终的工具调用（如果流式期间没有完全接收到）
      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          yield {
            type: 'tool_call',
            data: {
              id: block.id,
              name: block.name,
              arguments: block.input as Record<string, any>,
            },
          };
        }
      }

      // 映射 finish_reason
      let mappedFinishReason: 'stop' | 'tool_calls' | 'length' | 'error' | 'content_filter' = 'stop';
      if (finishReason === 'end_turn') {
        mappedFinishReason = 'stop';
      } else if (finishReason === 'tool_use') {
        mappedFinishReason = 'tool_calls';
      } else if (finishReason === 'max_tokens') {
        mappedFinishReason = 'length';
      } else if (finishReason === 'refusal') {
        mappedFinishReason = 'content_filter';
      }

      return {
        finishReason: mappedFinishReason,
        model: this.defaultModel,
        usage: usage ? {
          promptTokens: usage.input_tokens || 0,
          completionTokens: usage.output_tokens || 0,
          totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        } : undefined,
      };
    } catch (error) {
      console.error('Anthropic 流式调用失败:', error);
      throw new Error(`Anthropic 流式调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 将 Message 数组转换为 Anthropic 格式
   */
  private toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.parts.map(part => {
        if (part.type === 'text') {
          return {
            type: 'text',
            text: part.text,
          } as Anthropic.TextBlockParam;
        }
        return {
          type: 'text',
          text: '[unsupported part type]',
        } as Anthropic.TextBlockParam;
      }),
    }));
  }

  /**
   * 将工具定义转换为 Anthropic 格式
   */
  private toAnthropicTools(tools: any[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    })) as Anthropic.Tool[];
  }
}
