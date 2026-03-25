import { PartEntity } from './PartEntity';
import type { ReasoningPart } from '../types/parts';

export class ReasoningPartEntity extends PartEntity<ReasoningPart> {
  static create(params: {
    messageId: string;
    sessionId: string;
    text?: string;
  }): ReasoningPartEntity {
    const part: ReasoningPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'reasoning',
      text: params.text || '',
      createdAt: Date.now(),
      time: {
        start: Date.now(),
      },
    };

    return new ReasoningPartEntity(part);
  }

  appendDelta(delta: string): void {
    this.part.text += delta;
    (this.part as any).delta = delta;
  }

  complete(): void {
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
  }
}
