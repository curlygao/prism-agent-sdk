/**
 * TextPart Entity - 文本内容实体
 *
 * 管理文本 Part 的创建、追加和完成
 */

import { PartEntity } from './PartEntity';
import type { TextPart } from '../types/parts';

export class TextPartEntity extends PartEntity<TextPart> {
  /**
   * 创建新的 TextPart
   */
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

    const entity = new TextPartEntity(part);
    entity.emitCreated();
    return entity;
  }

  /**
   * 追加文本（流式更新）
   */
  appendDelta(delta: string): void {
    this.part.text += delta;
    (this.part as any).delta = delta;
    this.emitUpdated();
  }

  /**
   * 设置最终文本
   */
  setText(text: string): void {
    this.part.text = text;
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
    this.emitCompleted();
  }

  /**
   * 标记为合成内容
   */
  setSynthetic(value: boolean = true): void {
    this.part.synthetic = value;
    this.emitUpdated();
  }

  /**
   * 标记为忽略
   */
  setIgnored(value: boolean = true): void {
    this.part.ignored = value;
    this.emitUpdated();
  }

  /**
   * 完成文本 Part
   */
  complete(): void {
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
    this.emitCompleted();
  }
}
