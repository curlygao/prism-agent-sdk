/**
 * OpenRouter Provider
 *
 * 支持 OpenRouter API，可以访问多种模型
 */

import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import type { Message } from '../types/chat';
import type { ProviderStreamEvent, EndData, StreamOptions } from './types';

export class OpenRouterProvider extends BaseProvider {
  name = 'openrouter';
  apiBase = 'https://openrouter.ai/api/v1';
  apiKey: string;
  private client: OpenAI;

  constructor(apiKey: string, apiBase = 'https://openrouter.ai/api/v1') {
    super();
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.apiBase,
      dangerouslyAllowBrowser: true,
    });
  }

  async *chatStream(
    messages: Message[],
    options: StreamOptions = {}
  ): AsyncGenerator<ProviderStreamEvent, EndData> {
    const { maxTokens = 8192, temperature = 0.7, tools } = options;

    const stream = await this.client.chat.completions.create({
      model: 'anthropic/claude-opus-4-5',
      messages: this.toProviderMessages(messages),
      max_tokens: maxTokens,
      temperature,
      tools: tools?.length ? tools as any : undefined,
      stream: true,
    });

    let finishReason = 'stop';
    let usage: any = undefined;
    let rawResponse: any = undefined;

    // 工具调用累积
    const accumulatedToolCalls = new Map<number, {
      id: string;
      name: string;
      arguments: string;
      complete: boolean;
    }>();

    for await (const chunk of stream) {
      rawResponse = chunk;
      const delta = chunk.choices[0]?.delta;

      // 处理普通文本内容
      if (delta?.content) {
        yield {
          type: 'content',
          data: delta.content,
        };
      }

      // 处理工具调用（需要累积构建）
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index;
          if (!accumulatedToolCalls.has(index)) {
            accumulatedToolCalls.set(index, {
              id: '',
              name: '',
              arguments: '',
              complete: false,
            });
          }
          const existing = accumulatedToolCalls.get(index)!;

          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;

          // 检查工具调用是否完整
          if (existing.name && existing.arguments) {
            try {
              JSON.parse(existing.arguments);
              existing.complete = true;

              // Yield 工具调用事件
              yield {
                type: 'tool_call',
                data: {
                  id: existing.id,
                  name: existing.name,
                  arguments: this.parseToolCallArguments(existing.arguments),
                },
              };
            } catch {
              // JSON 不完整，等待更多数据
            }
          }
        }
      }

      // 处理结束原因
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }

      // 处理 usage
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    return {
      finishReason: finishReason as any,
      model: 'anthropic/claude-opus-4-5',
      usage: usage ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : undefined,
      rawResponse,
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.apiBase}/models`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const data: any = await response.json();
    return data.data?.map((m: any) => m.id) || [];
  }
}
