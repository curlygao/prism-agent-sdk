/**
 * 流处理器
 *
 * 处理 LLM 的流式响应，将 Provider 的 StreamEvent 转换为 Part
 * 支持文本、推理和工具调用事件
 *
 * 架构：Provider 层 → StreamProcessor → Part（核心层）
 *
 * 状态机：使用 First-Chunk Detection 模式自动管理内容生命周期
 */

import type { Message } from '../types/chat';
import type { ToolContext } from '../types/tools';

import type {
  Part,
  FinishReason,
  TokenUsage,
} from '../types/parts';
import type { IStorageAPI } from '../storage/types';
import { BaseProvider } from '../providers/BaseProvider';
import type { ProviderStreamEvent, EndData } from '../providers/types';
import { ToolRegistry } from '../tools/ToolRegistry';
import { TextPartEntity } from '../parts/TextPartEntity';
import { ReasoningPartEntity } from '../parts/ReasoningPartEntity';
import { ToolPartEntity } from '../parts/ToolPartEntity';

/**
 * 内容生成状态
 */
enum ContentState {
  IDLE = 'idle',              // 初始状态
  REASONING = 'reasoning',    // 正在思考
  TEXTING = 'texting',        // 正在生成文本
  TOOL_CALLING = 'tool_calling', // 正在生成工具参数
}

/**
 * 流事件类型（内部事件，传递给 onEvent 回调）
 */
export interface StreamEvent {
  type: 'text:start' | 'text:delta' | 'text:done' |
        'reasoning:start' | 'reasoning:delta' | 'reasoning:done' |
        'tool:call:start' | 'tool:call:done' | 'tool:call:interrupt' |
        'tool:execute:start' | 'tool:execute:done' | 'tool:execute:error';
  data?: any;
}

/**
 * 处理参数
 */
export interface ProcessParams {
  /** 消息历史 */
  messages: Message[];
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 中止信号 */
  abortSignal?: AbortSignal;
  /** 事件回调 */
  onEvent?: (event: StreamEvent) => void;
  /** 工作区路径 */
  workspace?: string;
}

/**
 * 处理结果
 */
export interface ProcessResult {
  /** 助手消息 */
  message: Message;
  /** Finish 原因 */
  finishReason?: FinishReason;
  /** Token 使用 */
  usage?: TokenUsage;
  /** 模型名称 */
  model: string;
}

/**
 * 流处理器
 */
export class StreamProcessor {
  constructor(
    private provider: BaseProvider,
    private toolRegistry: ToolRegistry,
    private storage: IStorageAPI
  ) {}

  /**
   * 处理流式响应
   */
  async process(params: ProcessParams): Promise<ProcessResult> {
    const { messages, sessionId, messageId, abortSignal, onEvent, workspace } = params;

    // 准备工具定义
    const tools = this.toolRegistry.getOpenAIFunctions();

    // 调用 Provider 获取流式响应
    const stream = this.provider.chatStream(messages, { tools });

    // 创建新的助手消息
    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      parentId: this.findLastUser(messages)?.id,
      parts: [],
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    // 状态追踪
    const state = {
      contentState: ContentState.IDLE,
      currentTextPart: null as TextPartEntity | null,
      reasoningMap: new Map<string, ReasoningPartEntity>(),
      activeToolCalls: new Map<string, ToolPartEntity>(),
      toolCallBuffer: null as any,  // 缓冲工具调用，等待参数完整
      finishReason: null as FinishReason | null,
      usage: null as TokenUsage | null,
      model: '' as string,
    };

    try {
      // 处理流式事件
      let result = await stream.next();
      while (!result.done) {
        abortSignal?.throwIfAborted();

        const providerEvent = result.value;

        // 根据 Provider 事件类型处理
        switch (providerEvent.type) {
          case 'content':
            await this.handleContentDelta(providerEvent.data, state, assistantMessage, params, onEvent);
            break;

          case 'reasoning':
            await this.handleReasoningDelta(providerEvent.data, state, assistantMessage, params, onEvent);
            break;

          case 'tool_call':
            await this.handleToolCall(providerEvent.data, state, assistantMessage, params, onEvent);
            break;
        }

        result = await stream.next();
      }

      // 获取最终返回值（EndData）
      const endData = result.value;
      state.finishReason = endData.finishReason;
      state.usage = endData.usage || null;
      state.model = endData.model;

      // 完成所有未完成的 Part
      this.completeAllParts(state);

      // 发送当前状态的 done 事件
      this.emitStateDoneEvent(state, params, onEvent);

      // 执行工具并等待完成
      await this.executeTools(state.activeToolCalls, params, onEvent);

      // 返回结果
      return {
        message: assistantMessage,
        finishReason: state.finishReason ?? undefined,
        usage: state.usage ?? undefined,
        model: state.model,
      };
    } catch (error) {
      // 清理未完成的 Part
      this.completeAllParts(state);
      // 发送中断事件
      if (state.contentState === ContentState.TOOL_CALLING && state.toolCallBuffer) {
        onEvent?.({ type: 'tool:call:interrupt', data: { sessionId: params.sessionId, messageId: params.messageId } });
      }
      throw error;
    }
  }

  /**
   * 处理内容增量
   */
  private async handleContentDelta(
    text: string,
    state: any,
    message: Message,
    params: ProcessParams,
    onEvent?: (event: StreamEvent) => void
  ): Promise<void> {
    console.log('[StreamProcessor] handleContentDelta:', text);

    // 状态切换：从 REASONING 或 TOOL_CALLING 切换到 TEXTING
    if (state.contentState === ContentState.REASONING) {
      this.emitStateDoneEvent(state, params, onEvent);
    } else if (state.contentState === ContentState.TOOL_CALLING) {
      // 工具调用未完成就被中断
      onEvent?.({ type: 'tool:call:interrupt', data: { sessionId: params.sessionId, messageId: params.messageId } });
      this.emitStateDoneEvent(state, params, onEvent);
    }

    // 进入 TEXTING 状态
    if (state.contentState !== ContentState.TEXTING) {
      state.contentState = ContentState.TEXTING;
      onEvent?.({ type: 'text:start', data: { sessionId: params.sessionId, messageId: params.messageId } });
    }

    // 创建或更新 TextPart
    if (!state.currentTextPart) {
      state.currentTextPart = TextPartEntity.create({
        sessionId: params.sessionId,
        messageId: params.messageId,
        text: text,
      });
      if (message.parts) {
        message.parts.push(state.currentTextPart.get());
      }
    } else {
      state.currentTextPart.appendDelta(text);
    }

    onEvent?.({ type: 'text:delta', data: { sessionId: params.sessionId, messageId: params.messageId, text } });
  }

  /**
   * 处理推理增量
   */
  private async handleReasoningDelta(
    reasoningData: { text: string; id?: string },
    state: any,
    message: Message,
    params: ProcessParams,
    onEvent?: (event: StreamEvent) => void
  ): Promise<void> {
    console.log('[StreamProcessor] handleReasoningDelta:', reasoningData);

    // 状态切换：从 TEXTING 或 TOOL_CALLING 切换到 REASONING
    if (state.contentState === ContentState.TEXTING) {
      this.emitStateDoneEvent(state, params, onEvent);
    } else if (state.contentState === ContentState.TOOL_CALLING) {
      // 工具调用未完成就被中断
      onEvent?.({ type: 'tool:call:interrupt', data: { sessionId: params.sessionId, messageId: params.messageId } });
      this.emitStateDoneEvent(state, params, onEvent);
    }

    // 进入 REASONING 状态
    if (state.contentState !== ContentState.REASONING) {
      state.contentState = ContentState.REASONING;
      onEvent?.({ type: 'reasoning:start', data: { sessionId: params.sessionId, messageId: params.messageId } });
    }

    const reasoningId = reasoningData.id || 'default';

    // 创建或获取 ReasoningPart
    if (!state.reasoningMap.has(reasoningId)) {
      const entity = ReasoningPartEntity.create({
        sessionId: params.sessionId,
        messageId: params.messageId,
      });
      state.reasoningMap.set(reasoningId, entity);
      if (message.parts) {
        message.parts.push(entity.get());
      }
    }

    // 追加文本
    const entity = state.reasoningMap.get(reasoningId);
    entity.appendDelta(reasoningData.text);

    onEvent?.({ type: 'reasoning:delta', data: { sessionId: params.sessionId, messageId: params.messageId, text: reasoningData.text } });
  }

  /**
   * 处理工具调用
   */
  private async handleToolCall(
    toolCallData: { id: string; name: string; arguments: Record<string, any> },
    state: any,
    message: Message,
    params: ProcessParams,
    onEvent?: (event: StreamEvent) => void
  ): Promise<void> {
    console.log('[StreamProcessor] handleToolCall:', toolCallData);

    // 状态切换：从 REASONING 或 TEXTING 切换到 TOOL_CALLING
    if (state.contentState === ContentState.REASONING || state.contentState === ContentState.TEXTING) {
      this.emitStateDoneEvent(state, params, onEvent);
    }

    // 进入 TOOL_CALLING 状态
    if (state.contentState !== ContentState.TOOL_CALLING) {
      state.contentState = ContentState.TOOL_CALLING;
      onEvent?.({
        type: 'tool:call:start',
        data: {
          sessionId: params.sessionId,
          messageId: params.messageId,
          toolName: toolCallData.name,
          callId: toolCallData.id,
          arguments: toolCallData.arguments,
        }
      });
    }

    // 缓冲工具调用，等待参数完整
    state.toolCallBuffer = toolCallData;

    // 创建 ToolPart（此时参数已完整）
    const entity = ToolPartEntity.create({
      sessionId: params.sessionId,
      messageId: params.messageId,
      tool: toolCallData.name,
      callID: toolCallData.id,
      input: toolCallData.arguments,
      raw: JSON.stringify(toolCallData.arguments),
    });

    state.activeToolCalls.set(toolCallData.id, entity);
    if (message.parts) {
      message.parts.push(entity.get());
    }

    // 工具调用参数完整
    onEvent?.({
      type: 'tool:call:done',
      data: {
        sessionId: params.sessionId,
        messageId: params.messageId,
        callId: toolCallData.id,
        toolName: toolCallData.name,
        arguments: toolCallData.arguments,
      }
    });
  }

  /**
   * 发送当前状态的 done 事件
   */
  private emitStateDoneEvent(state: any, params: ProcessParams, onEvent?: (event: StreamEvent) => void): void {
    switch (state.contentState) {
      case ContentState.REASONING:
        onEvent?.({ type: 'reasoning:done', data: { sessionId: params.sessionId, messageId: params.messageId } });
        break;
      case ContentState.TEXTING:
        onEvent?.({ type: 'text:done', data: { sessionId: params.sessionId, messageId: params.messageId } });
        break;
      case ContentState.TOOL_CALLING:
        // tool:call:done 在 handleToolCall 中已发送
        break;
    }
  }

  /**
   * 完成所有未完成的 Part
   */
  private completeAllParts(state: any): void {
    // 完成 TextPart
    if (state.currentTextPart) {
      state.currentTextPart.complete();
      state.currentTextPart = null;
    }

    // 完成所有 ReasoningPart
    for (const [id, entity] of state.reasoningMap) {
      entity.complete();
    }
  }

  /**
   * 执行所有工具并等待完成
   */
  private async executeTools(
    activeToolCalls: Map<string, ToolPartEntity>,
    params: ProcessParams,
    onEvent?: (event: StreamEvent) => void
  ): Promise<void> {
    if (activeToolCalls.size === 0) return;

    const toolContext: ToolContext = {
      sessionId: params.sessionId,
      workspace: params.workspace,
    };

    // 并行执行所有工具
    const promises = Array.from(activeToolCalls.values()).map(async (entity) => {
      const part = entity.get();
      const startTime = Date.now();

      try {
        // 发送工具执行开始事件
        onEvent?.({
          type: 'tool:execute:start',
          data: {
            sessionId: params.sessionId,
            messageId: params.messageId,
            callId: part.callID,
            toolName: part.tool,
            arguments: part.state.input,
          }
        });

        // 更新为 running 状态
        entity.startRunning(`${part.tool}(${JSON.stringify(part.state.input)})`);

        // 执行工具
        const result = await this.toolRegistry.execute(
          part.tool,
          part.state.input,
          toolContext
        );

        // 更新状态
        if (result.success) {
          entity.complete(result.output);
        } else {
          entity.fail(result.error || '执行失败');
        }

        const duration = Date.now() - startTime;

        // 发送工具执行完成事件
        if (result.success) {
          onEvent?.({
            type: 'tool:execute:done',
            data: {
              sessionId: params.sessionId,
              messageId: params.messageId,
              callId: part.callID,
              toolName: part.tool,
              result: result.output,
              duration,
            }
          });
        } else {
          onEvent?.({
            type: 'tool:execute:error',
            data: {
              sessionId: params.sessionId,
              messageId: params.messageId,
              callId: part.callID,
              toolName: part.tool,
              error: result.error || '执行失败',
            }
          });
        }
      } catch (error) {
        entity.fail(error instanceof Error ? error.message : String(error));
        const duration = Date.now() - startTime;

        onEvent?.({
          type: 'tool:execute:error',
          data: {
            sessionId: params.sessionId,
            messageId: params.messageId,
            callId: part.callID,
            toolName: part.tool,
            error: error instanceof Error ? error.message : String(error),
          }
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * 查找最后一条用户消息
   */
  private findLastUser(messages: Message[]): Message | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i];
      }
    }
    return undefined;
  }
}
