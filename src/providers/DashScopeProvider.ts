/**
 * 阿里云百炼 Provider
 *
 * 支持通义千问系列模型
 * API 文档: https://help.aliyun.com/zh/model-studio
 *
 * 阿里云百炼完全兼容 OpenAI 接口，只需调整 baseURL 和 API Key 即可
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
 * 阿里云百炼支持的模型列表
 */
export const DASHSCOPE_MODELS = {
  // 通义千问 2.5 系列（最新）
  'qwen-2.5-72b-instruct': 'Qwen 2.5 72B 指令模型（旗舰）',
  'qwen-2.5-32b-instruct': 'Qwen 2.5 32B 指令模型',
  'qwen-2.5-14b-instruct': 'Qwen 2.5 14B 指令模型',
  'qwen-2.5-7b-instruct': 'Qwen 2.5 7B 指令模型',
  'qwen-2.5-3b-instruct': 'Qwen 2.5 3B 指令模型（轻量）',
  'qwen-2.5-1.5b-instruct': 'Qwen 2.5 1.5B 指令模型（超轻量）',

  // 通义千问 2.5 Turbo 系列
  'qwen-2.5-72b-instruct-128k': 'Qwen 2.5 72B 128K 上下文',
  'qwen-2.5-turbo': 'Qwen 2.5 Turbo（快速响应）',
  'qwen-turbo': 'Qwen Turbo（上一代快速模型）',
  'qwen-turbo-latest': 'Qwen Turbo Latest',

  // 通义千问 2.0 系列
  'qwen-72b-chat': 'Qwen 72B Chat（上一代旗舰）',
  'qwen-14b-chat': 'Qwen 14B Chat',
  'qwen-7b-chat': 'Qwen 7B Chat',

  // 通义千问 VL（视觉语言模型）
  'qwen-vl-max': 'Qwen VL Max（最强视觉模型）',
  'qwen-vl-plus': 'Qwen VL Plus',
  'qwen-vl-v1': 'Qwen VL v1',

  // 代码专用模型
  'qwen-coder-plus': 'Qwen Coder Plus（代码增强）',
  'qwen-coder-turbo': 'Qwen Coder Turbo（代码快速）',

  // 数学专用模型
  'qwen-math-plus': 'Qwen Math Plus（数学增强）',
  'qwen-math-turbo': 'Qwen Math Turbo（数学快速）',
} as const;

export type DashScopeModel = keyof typeof DASHSCOPE_MODELS;

/**
 * 阿里云百炼支持的 API 端点
 */
export const DASHSCOPE_ENDPOINTS = {
  'cn-beijing': 'https://dashscope.aliyuncs.com/compatible-mode/v1',     // 华北2（北京）
  'cn-hangzhou': 'https://dashscope.aliyuncs.com/compatible-mode/v1',    // 华东1（杭州）
  'ap-southeast-1': 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 亚太东南1（新加坡）
  'us-east-1': 'https://dashscope.aliyuncs.com/compatible-mode/v1',      // 美国东部1（弗吉尼亚）
} as const;

export type DashScopeEndpoint = keyof typeof DASHSCOPE_ENDPOINTS;

/**
 * 阿里云百炼 Provider
 *
 * 使用 OpenAI SDK（百炼兼容 OpenAI 接口）
 */
export class DashScopeProvider extends BaseProvider {
  name = 'dashscope' as const;
  apiBase = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  apiKey: string;
  private defaultModel: string;
  private client: OpenAI;

  constructor(
    apiKey: string,
    model: DashScopeModel = 'qwen-2.5-72b-instruct',
    apiBase?: string
  ) {
    super();
    this.apiKey = apiKey;
    this.defaultModel = model;
    this.apiBase = apiBase || this.apiBase;
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

      // 工具调用累积
      const accumulatedToolCalls = new Map<number, {
        id: string;
        name: string;
        arguments: string;
        complete: boolean;
      }>();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // 处理普通文本内容
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

      return {
        finishReason,
        usage,
        model: this.defaultModel,
      };
    } catch (error) {
      console.error('阿里云百炼流式调用失败:', error);
      throw new Error(`阿里云百炼流式调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取支持的模型列表
   */
  async listModels(): Promise<string[]> {
    return Object.keys(DASHSCOPE_MODELS);
  }

  /**
   * 设置默认模型
   */
  setModel(model: DashScopeModel): void {
    if (model in DASHSCOPE_MODELS) {
      this.defaultModel = model;
    } else {
      console.warn(`未知的百炼模型: ${model}，使用默认模型`);
    }
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.defaultModel;
  }
}
