/**
 * SessionHandle - 会话句柄
 *
 * 用户与单个会话交互的接口，每个会话拥有独立的 AgentLoop 实例
 * 支持消息发送、事件监听、并发控制等功能
 */

import { EventEmitter } from 'eventemitter3';
import type { Message } from '../types/chat';
import type { AgentResponse } from '../types/agent';
import type { IStorageAPI } from '../storage/types';
import { vercelAIManager } from '../vercelai';
import type { ToolRegistry } from '../tools/ToolRegistry';
import type { SDKEventBus } from './SDKEventBus';
import type { SessionHandle as SessionHandleInterface, SendOptions, SessionEvent } from './types';
import { SessionState } from './SessionState';
import { SessionEventEmitter } from './SessionEventEmitter';
import { SessionClosedError, SessionBusyError } from './errors';
import { AgentLoop } from '../agent/AgentLoop';
import { ContextManager } from '../agent/ContextManager';

export interface SessionHandleEvents {
  'closed': () => void;
}

export class SessionHandle implements SessionHandleInterface {
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: number;

  private state: SessionState;
  private emitter: SessionEventEmitter;
  private agentLoop: AgentLoop;
  private contextManager: ContextManager;
  private closed = false;

  constructor(
    sessionId: string,
    projectId: string,
    private storage: IStorageAPI,
    private toolRegistry: ToolRegistry,
    private eventBus: SDKEventBus,
    private workspace: string
  ) {
    this.id = sessionId;
    this.projectId = projectId;
    this.createdAt = Date.now();

    this.state = new SessionState(sessionId, projectId);
    this.emitter = new SessionEventEmitter(sessionId, eventBus);
    this.agentLoop = new AgentLoop(
      toolRegistry,
      vercelAIManager,
      storage,
      { maxIterations: 20 }
    );
    this.contextManager = new ContextManager(storage);

    this.setupAgentLoopEvents();
  }

  async sendMessage(content: string, options?: SendOptions): Promise<AgentResponse> {
    if (this.closed) {
      throw new SessionClosedError(this.id);
    }

    if (this.state.isProcessing()) {
      throw new SessionBusyError(this.id);
    }

    this.state.setProcessing(true, 'Processing message');

    try {
      const messageId = this.state.generateMessageId();

      const context = await this.contextManager.buildContext(this.id, content);
      context.workspace = this.workspace;

      const response = await this.agentLoop.processMessage(context);

      await this.saveNewMessages(context.history);

      return response;
    } finally {
      this.state.setProcessing(false);
    }
  }

  on(event: SessionEvent, handler: (data: any) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: SessionEvent, handler: (data: any) => void): void {
    this.emitter.off(event, handler);
  }

  once(event: SessionEvent, handler: (data: any) => void): void {
    this.emitter.once(event, handler);
  }

  setProcessing(isProcessing: boolean, task?: string): void {
    this.state.setProcessing(isProcessing, task);
  }

  abort(): void {
    // TODO: Implement abort logic
  }

  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;
    this.emitter.removeAllListeners();
    (this.emitter as any).emit('closed', undefined);
  }

  getState(): Readonly<SessionState> {
    return this.state;
  }

  private setupAgentLoopEvents(): void {
    const agentEvents = [
      'text:start', 'text:delta', 'text:done',
      'reasoning:start', 'reasoning:delta', 'reasoning:done',
      'tool:call:start', 'tool:call:done',
      'tool:execute:start', 'tool:execute:done', 'tool:execute:error',
      'agent:done', 'agent:error',
    ] as const;

    for (const event of agentEvents) {
      const handler = (data: any) => {
        this.emitter.emit(event, data);
      };
      (this.agentLoop as any).on(event, handler);
    }
  }

  private async saveNewMessages(newMessages: Message[]): Promise<void> {
    for (const message of newMessages) {
      if (!message.id) {
        message.id = this.state.generateMessageId();
      }
      await this.storage.appendMessage(this.id, message);
    }
  }
}
