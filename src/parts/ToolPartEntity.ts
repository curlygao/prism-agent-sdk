/**
 * ToolPart Entity - 工具调用实体
 *
 * 管理工具调用的完整生命周期：pending → running → completed/error
 */

import { PartEntity } from './PartEntity';
import type { ToolPart, ToolState, FilePart } from '../types/parts';

export class ToolPartEntity extends PartEntity<ToolPart> {
  /**
   * 创建新的 ToolPart（初始状态：pending）
   */
  static create(params: {
    messageId: string;
    sessionId: string;
    tool: string;
    callID: string;
    input: Record<string, any>;
    raw: string;
  }): ToolPartEntity {
    const part: ToolPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'tool',
      callID: params.callID,
      tool: params.tool,
      createdAt: Date.now(),
      state: {
        status: 'pending',
        input: params.input,
        raw: params.raw,
      },
    };

    const entity = new ToolPartEntity(part);
    entity.emitCreated();
    return entity;
  }

  /**
   * 开始执行（pending → running）
   */
  startRunning(title?: string, metadata?: Record<string, any>): void {
    if (this.part.state.status !== 'pending') {
      throw new Error(`ToolPart is not pending, current status: ${this.part.state.status}`);
    }

    this.part.state = {
      status: 'running',
      input: this.part.state.input,
      title: title || this.part.tool,
      metadata: metadata || {},
      time: {
        start: Date.now(),
      },
    };
    this.emitUpdated();
  }

  /**
   * 完成执行（running → completed）
   */
  complete(output: string, metadata?: Record<string, any>): void {
    if (this.part.state.status !== 'running') {
      throw new Error(`ToolPart is not running, current status: ${this.part.state.status}`);
    }

    const startTime = this.part.state.time.start;

    this.part.state = {
      status: 'completed',
      input: this.part.state.input,
      output,
      title: this.part.state.title || this.part.tool,
      metadata: metadata || this.part.state.metadata || {},
      time: {
        start: startTime,
        end: Date.now(),
      },
    };
    this.emitCompleted();
  }

  /**
   * 执行失败（pending/running → error）
   */
  fail(error: string): void {
    if (this.part.state.status === 'completed') {
      throw new Error('Cannot fail a completed ToolPart');
    }

    const startTime =
      this.part.state.status === 'running' ? this.part.state.time.start : Date.now();

    this.part.state = {
      status: 'error',
      input: this.part.state.input,
      error,
      metadata: this.part.state.status === 'running' ? this.part.state.metadata : undefined,
      time: {
        start: startTime,
        end: Date.now(),
      },
    };
    this.emitUpdated();
  }

  /**
   * 添加附件（仅 completed 状态）
   */
  addAttachments(attachments: FilePart[]): void {
    if (this.part.state.status !== 'completed') {
      throw new Error('Cannot add attachments to non-completed ToolPart');
    }

    this.part.state.attachments = [
      ...(this.part.state.attachments || []),
      ...attachments,
    ];
    this.emitUpdated();
  }

  /**
   * 获取当前状态
   */
  getStatus(): ToolState['status'] {
    return this.part.state.status;
  }
}
