/**
 * 智谱 AI (Zhipu AI) Provider
 *
 * 支持智谱 AI 的 GLM 系列模型
 * API 文档: https://open.bigmodel.cn/dev/api
 */

import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import type {
  ProviderStreamEvent,
  EndData,
  StreamOptions,
  TokenUsage,
  FinishReason,
} from './types';
import type { Message } from '../types/chat';

/**
 * 智谱 AI 支持的模型列表
 */
export const ZHIPU_MODELS = {
  // 通用系列
  'glm-4-plus': 'GLM-4 Plus (最强通用模型)',
  'glm-4-0520': 'GLM-4 0520版本',
  'glm-4.7': 'GLM-4.7 通用模型',
  'glm-4': 'GLM-4 通用模型',
  'glm-4-air': 'GLM-4 Air (轻量快速)',
  'glm-4-flash': 'GLM-4 Flash (超快速)',

  // 代码系列
  'glm-4-code': 'GLM-4 代码专用模型',
  'codegeex-4': 'CodeGeeX-4 代码模型',

  // 图像系列
  'cogview-3': 'CogView-3 图像生成',
  'cogview-3-plus': 'CogView-3 Plus 图像生成',

  // 长文本系列
  'glm-4-long': 'GLM-4 长文本 (128K)',
} as const;

export class ZhipuProvider extends BaseProvider {
  name = 'zhipu' as const;
  apiBase: string;
  apiKey: string;
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, apiBase = 'https://open.bigmodel.cn/api/paas/v4/', model = 'glm-4') {
    super();
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.defaultModel = model;
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

    try {
      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: this.toProviderMessages(messages),
        max_tokens: maxTokens,
        temperature,
        tools: tools?.length ? tools as any : undefined,
        stream: true,
      });

      let finishReason: FinishReason = 'stop';
      let usage: TokenUsage | undefined;
      let rawResponse: any;

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

        // 处理推理内容（思考过程）- 智谱 GLM-4.x 的 reasoning_content 字段
        if ((delta as any)?.reasoning_content) {
          yield {
            type: 'reasoning',
            data: { text: (delta as any).reasoning_content },
          };
        }

        // 处理普通文本内容（最终输出）
        if (delta?.content) {
          yield { type: 'content', data: delta.content };
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

        // 收集 finish_reason
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason as FinishReason;
        }

        // 收集 usage
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }

      // 返回结束数据
      return {
        finishReason,
        usage,
        model: this.defaultModel,
        rawResponse,
      };
    } catch (error) {
      console.error('智谱 AI 流式调用失败:', error);
      throw new Error(`智谱 AI 流式调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取支持的模型列表
   */
  async listModels(): Promise<string[]> {
    return Object.keys(ZHIPU_MODELS);
  }

  /**
   * 设置默认模型
   */
  setModel(model: string): void {
    if (model in ZHIPU_MODELS) {
      this.defaultModel = model;
    } else {
      console.warn(`未知的智谱模型: ${model}，使用默认模型`);
    }
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.defaultModel;
  }
}
