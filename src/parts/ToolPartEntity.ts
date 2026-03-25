import { PartEntity } from './PartEntity';
import type { ToolPart, ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError } from '../types/parts';

export class ToolPartEntity extends PartEntity<ToolPart> {
  static create(params: {
    messageId: string;
    sessionId: string;
    callId: string;
    tool: string;
  }): ToolPartEntity {
    const part: ToolPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'tool',
      callID: params.callId,
      tool: params.tool,
      state: {
        status: 'pending',
        input: {},
        raw: '',
      } as ToolStatePending,
    };

    return new ToolPartEntity(part);
  }

  setPending(input: Record<string, any>, raw: string): void {
    this.part.state = {
      status: 'pending',
      input,
      raw,
    };
  }

  setRunning(title?: string): void {
    const state: ToolStateRunning = {
      status: 'running',
      input: this.part.state.status === 'pending' ? this.part.state.input : {},
      title,
      time: {
        start: Date.now(),
      },
    };
    this.part.state = state;
  }

  setCompleted(output: string, title?: string): void {
    const state: ToolStateCompleted = {
      status: 'completed',
      input: this.part.state.status === 'pending' ? this.part.state.input : {},
      output,
      title: title || '',
      time: {
        start: this.part.state.status === 'running' ? this.part.state.time.start : Date.now(),
        end: Date.now(),
      },
    };
    this.part.state = state;
  }

  setError(error: string): void {
    const state: ToolStateError = {
      status: 'error',
      input: this.part.state.status === 'pending' ? this.part.state.input : {},
      error,
      time: {
        start: this.part.state.status === 'running' ? this.part.state.time.start : Date.now(),
        end: Date.now(),
      },
    };
    this.part.state = state;
  }

  getStatus(): string {
    return this.part.state.status;
  }
}
