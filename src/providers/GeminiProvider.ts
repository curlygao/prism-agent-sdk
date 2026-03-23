/**
 * Google Gemini Provider
 *
 * 支持 Google Gemini 系列 API
 * 使用延迟加载：仅在用户配置并首次使用时才加载 @google/generative-ai 依赖
 * API 文档: https://ai.google.dev/docs
 */

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
 * Google Gemini 支持的模型列表
 */
export const GEMINI_MODELS = {
  // Gemini 2.0 系列（最新）
  'gemini-2.0-flash-exp': 'Gemini 2.0 Flash Experimental (超快速)',
  'gemini-2.0-flash-thinking-exp': 'Gemini 2.0 Flash Thinking (原生推理)',

  // Gemini 1.5 系列
  'gemini-1.5-pro': 'Gemini 1.5 Pro (旗舰模型)',
  'gemini-1.5-flash': 'Gemini 1.5 Flash (快速响应)',
  'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B (轻量级)',

  // Gemini 1.0 系列（旧版）
  'gemini-pro': 'Gemini 1.0 Pro (旧版)',
  'gemini-1.5-pro-latest': 'Gemini 1.5 Pro Latest',
  'gemini-1.5-flash-latest': 'Gemini 1.5 Flash Latest',
} as const;

export type GeminiModel = keyof typeof GEMINI_MODELS;

/**
 * Gemini 动态导入的类型定义
 */
interface GoogleGenerativeAI {
  (apiKey: string): {
    getGenerativeModel: (config: { model: string; systemInstruction?: string }) => any;
  };
}

interface GenerativeModel {
  generateContentStream: (prompt: any) => AsyncGenerator<any>;
}

/**
 * Google Gemini Provider
 *
 * 使用动态 import 延迟加载 @google/generative-ai 依赖
 */
export class GeminiProvider extends BaseProvider {
  name = 'gemini' as const;
  apiBase = 'https://generativelanguage.googleapis.com';
  apiKey: string;
  private defaultModel: string;
  private genAI: any = null;
  private GoogleAIConstructor: any = null;

  constructor(apiKey: string, model: GeminiModel = 'gemini-1.5-pro') {
    super();
    this.apiKey = apiKey;
    this.defaultModel = model;
  }

  /**
   * 延迟初始化 Google Generative AI 客户端
   * 只在首次调用时加载依赖
   */
  private async initClient(): Promise<any> {
    if (this.genAI) return this.genAI;

    try {
      // 动态导入 Google Generative AI
      const module = await import('@google/generative-ai');
      this.GoogleAIConstructor = module.GoogleGenerativeAI;
      this.genAI = new this.GoogleAIConstructor(this.apiKey);
      return this.genAI;
    } catch (error) {
      if ((error as any).code === 'MODULE_NOT_FOUND' || (error as any).message?.includes('Cannot find package')) {
        throw new Error(
          'Google Gemini 依赖未安装。\n' +
          '请运行以下命令安装:\n' +
          '  npm install @google/generative-ai\n' +
          '或者禁用 Gemini 配置。'
        );
      }
      throw error;
    }
  }

  /**
   * 将核心层 Message 转换为 Gemini API 格式
   */
  protected toProviderMessages(messages: Message[]): any {
    // Gemini 使用 contents 数组，每个 content 包含 role 和 parts
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // 系统指令在 Gemini 中通过 systemInstruction 处理
        continue;
      }

      const parts: any[] = [];

      if (!msg.parts || !Array.isArray(msg.parts)) {
        contents.push({ role: this.toGeminiRole(msg.role), parts: [{ text: '' }] });
        continue;
      }

      // 提取文本内容
      const textParts = msg.parts.filter((p) => p.type === 'text');
      if (textParts.length > 0) {
        const text = textParts.map((p) => (p as any).text).join('');
        parts.push({ text });
      }

      // 提取工具调用（assistant 消息）
      const toolParts = msg.parts.filter((p) => p.type === 'tool') as any[];
      if (toolParts.length > 0 && msg.role === 'assistant') {
        for (const toolPart of toolParts) {
          parts.push({
            functionCall: {
              name: toolPart.tool,
              args: toolPart.state?.input || {},
            },
          });
        }
      }

      // 工具结果消息（user 角色携带 functionResponse）
      if (msg.role === 'tool' && toolParts.length > 0) {
        for (const toolPart of toolParts) {
          parts.push({
            functionResponse: {
              name: toolPart.tool,
              response: toolPart.state?.output || toolPart.state?.error || {},
            },
          });
        }
      }

      if (parts.length > 0) {
        contents.push({ role: this.toGeminiRole(msg.role), parts });
      }
    }

    return contents;
  }

  /**
   * 将核心层角色转换为 Gemini 角色格式
   */
  private toGeminiRole(role: string): string {
    switch (role) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'model';
      case 'tool':
        return 'user'; // Gemini 的 functionResponse 放在 user 消息中
      default:
        return 'user';
    }
  }

  /**
   * 提取系统指令
   */
  private extractSystemInstruction(messages: Message[]): string | undefined {
    const systemMsg = messages.find((msg) => msg.role === 'system');
    if (!systemMsg || !systemMsg.parts) return undefined;

    const textParts = systemMsg.parts.filter((p) => p.type === 'text');
    if (textParts.length === 0) return undefined;

    return textParts.map((p) => (p as any).text).join('\n');
  }

  /**
   * 将工具定义转换为 Gemini 格式
   */
  private toGeminiTools(tools?: any[]): any {
    if (!tools || tools.length === 0) return undefined;

    const functionDeclarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
      },
    }));

    return { functionDeclarations };
  }

  async *chatStream(
    messages: Message[],
    options: StreamOptions = {}
  ): AsyncGenerator<ProviderStreamEvent, EndData> {
    const { maxTokens = 8192, temperature = 0.7, tools } = options;

    try {
      const genAI = await this.initClient();
      const systemInstruction = this.extractSystemInstruction(messages);

      const modelConfig: any = { model: this.defaultModel };
      if (systemInstruction) {
        modelConfig.systemInstruction = systemInstruction;
      }

      const model = genAI.getGenerativeModel(modelConfig);
      const contents = this.toProviderMessages(messages);
      const geminiTools = this.toGeminiTools(tools);

      const generationConfig = {
        maxOutputTokens: maxTokens,
        temperature,
      };

      const requestConfig: any = {
        contents,
        generationConfig,
      };

      if (geminiTools) {
        requestConfig.tools = geminiTools;
      }

      const result = await model.generateContentStream(requestConfig);

      let finishReason: FinishReason = 'stop';
      let usage: TokenUsage | undefined;
      let fullContent = '';

      for await (const chunk of result.stream) {
        const candidates = chunk.candidates;
        if (!candidates || candidates.length === 0) continue;

        const candidate = candidates[0];
        const parts = candidate.content?.parts || [];

        for (const part of parts) {
          // 处理普通文本内容
          if (part.text) {
            fullContent += part.text;
            yield { type: 'content', data: part.text };
          }

          // 处理思考内容（Gemini 2.0 Thinking）
          if (part.thought) {
            yield { type: 'reasoning', data: { text: part.thought } };
          }

          // 处理工具调用
          if (part.functionCall) {
            yield {
              type: 'tool_call',
              data: {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args || {},
              },
            };
          }
        }

        // 收集 finishReason
        if (candidate.finishReason) {
          finishReason = this.mapFinishReason(candidate.finishReason);
        }

        // 收集 usage（Gemini 在最后的 chunk 中提供）
        if (candidate.usageMetadata) {
          usage = {
            promptTokens: candidate.usageMetadata.promptTokenCount || 0,
            completionTokens: candidate.usageMetadata.candidatesTokenCount || 0,
            totalTokens: candidate.usageMetadata.totalTokenCount || 0,
          };
        }
      }

      return {
        finishReason,
        usage,
        model: this.defaultModel,
        rawResponse: { fullContent },
      };
    } catch (error) {
      console.error('Google Gemini 流式调用失败:', error);
      throw new Error(`Google Gemini 流式调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 映射 Gemini finishReason 到标准格式
   */
  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      case 'OTHER':
        return 'stop';
      default:
        return 'stop';
    }
  }

  /**
   * 获取支持的模型列表
   */
  async listModels(): Promise<string[]> {
    return Object.keys(GEMINI_MODELS);
  }

  /**
   * 设置默认模型
   */
  setModel(model: GeminiModel): void {
    if (model in GEMINI_MODELS) {
      this.defaultModel = model;
    } else {
      console.warn(`未知的 Gemini 模型: ${model}，使用默认模型`);
    }
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.defaultModel;
  }
}
