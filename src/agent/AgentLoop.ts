/**
 * Agent 循环引擎
 *
 * 负责处理用户消息、调用 LLM、执行工具、管理对话状态
 * 基于 Part 架构重构
 */

import { EventEmitter } from 'eventemitter3';
import type { Message, AgentContext, AgentResponse, AgentOptions, ToolCall } from '../types';
import type { Part } from '../types/parts';
import type { IStorageAPI } from '../storage/types';
import { ToolRegistry } from '../tools/ToolRegistry';
import { BaseProvider } from '../providers/BaseProvider';
import { StreamProcessor, StreamEvent } from './StreamProcessor';
import { PartFactory } from '../utils/PartFactory';

export interface AgentLoopEvents {
  // 文本事件
  'text:start': (data: { sessionId: string; messageId: string }) => void;
  'text:delta': (data: { sessionId: string; messageId: string; text: string }) => void;
  'text:done': (data: { sessionId: string; messageId: string }) => void;

  // 思考事件
  'reasoning:start': (data: { sessionId: string; messageId: string }) => void;
  'reasoning:delta': (data: { sessionId: string; messageId: string; text: string }) => void;
  'reasoning:done': (data: { sessionId: string; messageId: string }) => void;

  // 工具调用 - 生成阶段
  'tool:call:start': (data: { sessionId: string; messageId: string }) => void;
  'tool:call:done': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:call:interrupt': (data: { sessionId: string; messageId: string }) => void;

  // 工具调用 - 执行阶段
  'tool:execute:start': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:execute:done': (data: { sessionId: string; messageId: string; callId: string; toolName: string; result: any; duration: number }) => void;
  'tool:execute:error': (data: { sessionId: string; messageId: string; callId: string; toolName: string; error: string }) => void;

  // 完成和错误
  'done': () => void;
  'error': (error: Error) => void;
}

export class AgentLoop extends EventEmitter<AgentLoopEvents> {
  private maxIterations: number;
  private toolRegistry: ToolRegistry;
  private provider: BaseProvider;
  private storage: IStorageAPI;

  constructor(
    toolRegistry: ToolRegistry,
    provider: BaseProvider,
    storage: IStorageAPI,
    options: AgentOptions = {}
  ) {
    super();
    this.toolRegistry = toolRegistry;
    this.provider = provider;
    this.storage = storage;
    this.maxIterations = options.maxIterations ?? 20;
  }

  /**
   * 处理用户消息（只支持流式）
   */
  async processMessage(
    context: AgentContext
  ): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const userMessage = messages[messages.length - 1];
    // 记录历史消息数量（不包含当前用户消息），用于后续提取新增消息
    const historyCount = context.history.length;

    // Agent 循环
    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[AgentLoop] 循环 ${i + 1}/${this.maxIterations}, 当前消息数: ${messages.length}`);

      try {
        // 流式响应（使用新架构）
        const response = await this.processStreamWithParts(messages, context);

        console.log(`[AgentLoop] 第 ${i + 1} 轮结果: finishReason=${response.finishReason}, model=${response.model || 'unknown'}`);

        // 检查是否有工具调用
        const hasToolCalls = response.finishReason === 'tool_calls' &&
                            response.message.parts &&
                            response.message.parts.some(p => p.type === 'tool');

        if (!hasToolCalls) {
          this.emit('done');
          // 更新 context.history，包含所有新增消息（用户消息 + 助手消息）
          context.history = messages.slice(historyCount);
          return response;
        }

        // 有工具调用，工具已在 StreamProcessor 中执行完成
        // 只需处理工具结果并添加到消息历史，然后继续循环
        await this.addToolResultsToMessages(response.message.parts, messages, context);

        console.log(`[AgentLoop] 工具结果已添加，当前消息数: ${messages.length}`);
        // 继续下一轮循环，将工具结果发送给 LLM
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        throw err;
      }
    }

    // 更新 context.history，包含所有新增消息（超过最大迭代次数的情况）
    context.history = messages.slice(historyCount);
    throw new Error('超过最大迭代次数');
  }

  /**
   * 流式模式处理（使用 Part 架构）
   */
  private async processStreamWithParts(
    messages: Message[],
    context: AgentContext
  ): Promise<AgentResponse> {
    // 创建 StreamProcessor
    const processor = new StreamProcessor(
      this.provider,
      this.toolRegistry,
      this.storage
    );

    // 生成消息 ID
    const messageId = this.generateId('msg');

    // 处理流式响应
    const result = await processor.process({
      messages,
      sessionId: context.sessionId,
      messageId,
      abortSignal: undefined,
      workspace: context.workspace,
      onEvent: (event) => {
        console.log('[AgentLoop] onEvent:', event.type);
        // 转发事件到 AgentLoop 的事件系统
        this.forwardEvent(event, context.sessionId, messageId);
      },
    });

    // 添加助手消息到历史（包含 ToolPart）
    if (result.message.parts && result.message.parts.length > 0) {
      messages.push(result.message);
    }

    // 构建响应（新架构：只返回 message 和元数据）
    const response: AgentResponse = {
      message: result.message,
      finishReason: result.finishReason,
      usage: result.usage,
      model: result.model,
    };

    return response;
  }

  /**
   * 转发 StreamProcessor 事件到 AgentLoop 事件系统
   */
  private forwardEvent(event: StreamEvent, sessionId: string, messageId: string): void {
    const baseData = { sessionId, messageId };

    switch (event.type) {
      // 文本事件
      case 'text:start':
        this.emit('text:start', baseData);
        break;
      case 'text:delta':
        this.emit('text:delta', { ...baseData, text: event.data.text });
        break;
      case 'text:done':
        this.emit('text:done', baseData);
        break;

      // 思考事件
      case 'reasoning:start':
        this.emit('reasoning:start', baseData);
        break;
      case 'reasoning:delta':
        this.emit('reasoning:delta', { ...baseData, delta: event.data.text });
        break;
      case 'reasoning:done':
        this.emit('reasoning:done', baseData);
        break;

      // 工具调用 - 生成阶段
      case 'tool:call:start':
        this.emit('tool:call:start', {
          ...baseData,
          toolName: event.data.toolName,
          callId: event.data.callId,
          arguments: event.data.arguments,
        });
        break;
      case 'tool:call:done':
        this.emit('tool:call:done', {
          ...baseData,
          callId: event.data.callId,
          toolName: event.data.toolName,
          arguments: event.data.arguments,
        });
        break;
      case 'tool:call:interrupt':
        this.emit('tool:call:interrupt', baseData);
        break;

      // 工具调用 - 执行阶段
      case 'tool:execute:start':
        this.emit('tool:execute:start', {
          ...baseData,
          callId: event.data.callId,
          toolName: event.data.toolName,
          arguments: event.data.arguments,
        });
        break;
      case 'tool:execute:done':
        this.emit('tool:execute:done', {
          ...baseData,
          callId: event.data.callId,
          toolName: event.data.toolName,
          result: event.data.result,
          duration: event.data.duration,
        });
        break;
      case 'tool:execute:error':
        this.emit('tool:execute:error', {
          ...baseData,
          callId: event.data.callId,
          toolName: event.data.toolName,
          error: event.data.error,
        });
        break;
    }
  }

  /**
   * 将流式模式中已执行的工具结果添加到消息历史
   * （流式模式下工具已在 StreamProcessor 中执行完成）
   */
  private async addToolResultsToMessages(
    parts: Part[] | undefined,
    messages: Message[],
    context: AgentContext
  ): Promise<void> {
    if (!parts) return;

    // 找到所有 ToolPart
    const toolParts = parts.filter(p => p.type === 'tool') as any[];

    for (const toolPart of toolParts) {
      const messageId = this.generateId('msg');

      // 创建工具结果消息（复用已有的 ToolPart）
      messages.push({
        id: messageId,
        role: 'tool',
        parts: [toolPart],
        timestamp: Date.now(),
        createdAt: Date.now(),
      });
    }
  }

  /**
   * 构建消息列表
   */
  private buildMessages(context: AgentContext): Message[] {
    // 为当前用户消息创建 TextPart
    const userMessageId = this.generateId('msg');
    const textPart = PartFactory.createTextPart(context.currentMessage, {
      sessionId: context.sessionId,
      messageId: userMessageId,
      emitEvent: false,
    });

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

  /**
   * 生成唯一 ID
   */
  private generateId(prefix = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新最大迭代次数
   */
  setMaxIterations(max: number): void {
    this.maxIterations = max;
  }
}
