/**
 * Agent 循环引擎
 *
 * 负责处理用户消息、调用 LLM、执行工具、管理对话状态
 * 基于 Vercel AI SDK streamText() 重构
 */

import { EventEmitter } from 'eventemitter3';
import { streamText, type CoreMessage } from 'ai';
import type { Message, AgentContext, AgentResponse, AgentOptions } from '../types';
import type { IStorageAPI } from '../storage/types';
import { ToolRegistry } from '../tools/ToolRegistry';
import { vercelAIManager, VercelAIManager, type ProviderConfig } from '../vercelai';
import { TextPartEntity } from '../parts/TextPartEntity';
import { ReasoningPartEntity } from '../parts/ReasoningPartEntity';
import { ToolPartEntity } from '../parts/ToolPartEntity';

export interface AgentLoopEvents {
  'text:start': (data: { sessionId: string; messageId: string }) => void;
  'text:delta': (data: { sessionId: string; messageId: string; text: string }) => void;
  'text:done': (data: { sessionId: string; messageId: string }) => void;
  'reasoning:start': (data: { sessionId: string; messageId: string }) => void;
  'reasoning:delta': (data: { sessionId: string; messageId: string; text: string }) => void;
  'reasoning:done': (data: { sessionId: string; messageId: string }) => void;
  'tool:call:start': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:call:done': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:execute:start': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:execute:done': (data: { sessionId: string; messageId: string; callId: string; toolName: string; result: any; duration: number }) => void;
  'tool:execute:error': (data: { sessionId: string; messageId: string; callId: string; toolName: string; error: string }) => void;
  'done': () => void;
  'error': (error: Error) => void;
}

export class AgentLoop extends EventEmitter<AgentLoopEvents> {
  private maxIterations: number;
  private toolRegistry: ToolRegistry;
  private vercelAIManager: VercelAIManager;
  private storage: IStorageAPI;

  constructor(
    toolRegistry: ToolRegistry,
    vercelAIManager: VercelAIManager,
    storage: IStorageAPI,
    options: AgentOptions = {}
  ) {
    super();
    this.toolRegistry = toolRegistry;
    this.vercelAIManager = vercelAIManager;
    this.storage = storage;
    this.maxIterations = options.maxIterations ?? 20;
  }

  async processMessage(
    context: AgentContext
  ): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const historyCount = context.history.length;

    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[AgentLoop] 循环 ${i + 1}/${this.maxIterations}, 当前消息数: ${messages.length}`);

      try {
        const response = await this.processStreamWithParts(messages, context, context.workspace);

        console.log(`[AgentLoop] 第 ${i + 1} 轮结果: finishReason=${response.finishReason}`);

        // 检查是否有工具调用
        const hasToolCalls = response.finishReason === 'tool_calls' &&
                            response.message.parts &&
                            response.message.parts.some(p => p.type === 'tool');

        if (!hasToolCalls) {
          this.emit('done');
          context.history = messages.slice(historyCount);
          return response;
        }

        // 有工具调用，继续循环
        console.log(`[AgentLoop] 工具调用完成，当前消息数: ${messages.length}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        throw err;
      }
    }

    context.history = messages.slice(historyCount);
    throw new Error('超过最大迭代次数');
  }

  private async processStreamWithParts(
    messages: Message[],
    context: AgentContext,
    workspace: string
  ): Promise<AgentResponse> {
    const messageId = this.generateId('msg');
    const sessionId = context.sessionId;

    // 创建 PartEntity 实例
    let textPart: TextPartEntity | undefined;
    let reasoningPart: ReasoningPartEntity | undefined;
    let toolPart: ToolPartEntity | undefined;

    // 转换消息格式
    const vercelMessages = this.convertMessages(messages);

    // 解析 model 并获取 LanguageModel
    const { provider, model: modelName } = this.vercelAIManager.parseModel(context.model || 'openai/gpt-4');
    const providerConfig: ProviderConfig = {};
    const languageModel = this.vercelAIManager.getModel(provider, modelName, providerConfig);

    let finishReason: string | undefined;
    let usage: any;

    const result = await streamText({
      model: languageModel,
      messages: vercelMessages,
      system: context.system,
      tools: this.toolRegistry.toVercelAITools(),
      toolExecution: 'manual',
      maxTokens: 4096,

      onTextDelta: (chunk) => {
        if (!textPart) {
          textPart = TextPartEntity.create({ messageId, sessionId });
          this.emit('text:start', { sessionId, messageId });
        }
        textPart.appendDelta(chunk.text);
        this.emit('text:delta', { sessionId, messageId, text: chunk.text });
      },

      onReasoning: ({ delta }) => {
        if (!reasoningPart) {
          reasoningPart = ReasoningPartEntity.create({ messageId, sessionId });
          this.emit('reasoning:start', { sessionId, messageId });
        }
        reasoningPart.appendDelta(delta);
        this.emit('reasoning:delta', { sessionId, messageId, text: delta });
      },

      onToolCall: async ({ toolCall }) => {
        const { toolName, args, toolCallId } = toolCall;

        // 创建 ToolPartEntity
        toolPart = ToolPartEntity.create({
          messageId,
          sessionId,
          callId: toolCallId,
          tool: toolName,
        });
        toolPart.setPending(args, JSON.stringify(args));

        this.emit('tool:call:start', { sessionId, messageId, callId: toolCallId, toolName, arguments: args });
        this.emit('tool:execute:start', { sessionId, messageId, callId: toolCallId, toolName, arguments: args });

        // 执行工具
        const startTime = Date.now();
        try {
          const toolResult = await this.toolRegistry.execute(toolName, args, { workspace });

          const duration = Date.now() - startTime;

          if (toolResult.success) {
            toolPart.setCompleted(toolResult.output);
            this.emit('tool:execute:done', {
              sessionId,
              messageId,
              callId: toolCallId,
              toolName,
              result: toolResult.output,
              duration,
            });
          } else {
            toolPart.setError(toolResult.error || 'Unknown error');
            this.emit('tool:execute:error', {
              sessionId,
              messageId,
              callId: toolCallId,
              toolName,
              error: toolResult.error || 'Unknown error',
            });
          }

          // 将工具结果添加到 messages
          const toolMessage: CoreMessage = {
            role: 'tool',
            content: toolResult.output || toolResult.error || '',
            toolCallId,
          };
          messages.push(toolMessage as any);

        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolPart.setError(errorMessage);
          this.emit('tool:execute:error', {
            sessionId,
            messageId,
            callId: toolCallId,
            toolName,
            error: errorMessage,
          });

          // 添加错误结果到 messages
          const toolMessage: CoreMessage = {
            role: 'tool',
            content: `Error: ${errorMessage}`,
            toolCallId,
          };
          messages.push(toolMessage as any);
        }

        this.emit('tool:call:done', { sessionId, messageId, callId: toolCallId, toolName, arguments: args });
      },

      onFinish: (params) => {
        finishReason = params.finishReason;
        usage = params.usage;

        if (textPart) {
          textPart.complete();
          this.emit('text:done', { sessionId, messageId });
        }
        if (reasoningPart) {
          reasoningPart.complete();
          this.emit('reasoning:done', { sessionId, messageId });
        }
      },

      onError: (error) => {
        console.error('[AgentLoop] streamText error:', error);
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      },
    });

    // 完成 streamText 等待
    await result.wait();

    // 构建 assistant message
    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      parts: [],
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    if (textPart) {
      assistantMessage.parts!.push(textPart.get());
    }
    if (reasoningPart) {
      assistantMessage.parts!.push(reasoningPart.get());
    }
    if (toolPart) {
      assistantMessage.parts!.push(toolPart.get());
    }

    if (assistantMessage.parts!.length > 0) {
      messages.push(assistantMessage);
    }

    return {
      message: assistantMessage,
      finishReason: finishReason || 'stop',
      usage,
      model: context.model,
    };
  }

  /**
   * 转换 messages 为 Vercel AI 格式
   */
  private convertMessages(messages: Message[]): CoreMessage[] {
    return messages.map(msg => {
      if (msg.role === 'user') {
        const textPart = msg.parts?.find(p => p.type === 'text') as any;
        return {
          role: 'user',
          content: textPart?.text || '',
        };
      }
      if (msg.role === 'assistant') {
        const textPart = msg.parts?.find(p => p.type === 'text') as any;
        return {
          role: 'assistant',
          content: textPart?.text || '',
        };
      }
      if (msg.role === 'tool') {
        const toolPart = msg.parts?.find(p => p.type === 'tool') as any;
        return {
          role: 'tool',
          content: toolPart?.state?.output || '',
          toolCallId: toolPart?.callID,
        };
      }
      return {
        role: msg.role,
        content: JSON.stringify(msg.parts),
      };
    }) as CoreMessage[];
  }

  private buildMessages(context: AgentContext): Message[] {
    const userMessageId = this.generateId('msg');
    const textPart = {
      id: userMessageId,
      messageId: userMessageId,
      sessionId: context.sessionId,
      type: 'text' as const,
      text: context.currentMessage,
      createdAt: Date.now(),
      time: { start: Date.now() },
    };

    const currentUserMessage: Message = {
      id: userMessageId,
      role: 'user',
      parts: [textPart],
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    return [
      ...context.history,
      currentUserMessage,
    ];
  }

  private generateId(prefix = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setMaxIterations(max: number): void {
    this.maxIterations = max;
  }
}
