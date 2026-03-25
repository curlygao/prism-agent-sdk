import { PartEntity } from './PartEntity';
import type { TextPart } from '../types/parts';

export class TextPartEntity extends PartEntity<TextPart> {
  static create(params: {
    messageId: string;
    sessionId: string;
    text?: string;
  }): TextPartEntity {
    const part: TextPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'text',
      text: params.text || '',
      createdAt: Date.now(),
      time: {
        start: Date.now(),
      },
    };

    return new TextPartEntity(part);
  }

  appendDelta(delta: string): void {
    this.part.text += delta;
    (this.part as any).delta = delta;
  }

  setText(text: string): void {
    this.part.text = text;
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
  }

  setSynthetic(value: boolean = true): void {
    this.part.synthetic = value;
  }

  setIgnored(value: boolean = true): void {
    this.part.ignored = value;
  }

  complete(): void {
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
  }
}
