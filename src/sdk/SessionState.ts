import type { SessionState as SessionStateInterface } from './types';

export class SessionState implements SessionStateInterface {
  readonly sessionId: string;
  readonly projectId: string;
  readonly createdAt: number;

  processingState = {
    isProcessing: false,
    currentTask: null as string | null,
  };

  currentMessageId?: string;

  constructor(sessionId: string, projectId: string) {
    this.sessionId = sessionId;
    this.projectId = projectId;
    this.createdAt = Date.now();
  }

  setProcessing(isProcessing: boolean, task?: string): void {
    this.processingState.isProcessing = isProcessing;
    this.processingState.currentTask = task || null;
  }

  generateMessageId(): string {
    this.currentMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.currentMessageId;
  }

  isProcessing(): boolean {
    return this.processingState.isProcessing;
  }

  getCurrentTask(): string | null {
    return this.processingState.currentTask;
  }
}
