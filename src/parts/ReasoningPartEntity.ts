/**
 * ReasoningPart Entity - 推理内容实体
 *
 * 管理模型的思考过程（如 Claude 3.7、DeepSeek-R1 的 reasoning）
 */

import { PartEntity } from './PartEntity';
import type { ReasoningPart } from '../types/parts';

export class ReasoningPartEntity extends PartEntity<ReasoningPart> {
  /**
   * 创建新的 ReasoningPart
   */
  static create(params: {
    messageId: string;
    sessionId: string;
  }): ReasoningPartEntity {
    const part: ReasoningPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'reasoning',
      text: '',
      createdAt: Date.now(),
      time: {
        start: Date.now(),
      },
    };

    const entity = new ReasoningPartEntity(part);
    entity.emitCreated();
    return entity;
  }

  /**
   * 追加推理内容
   */
  appendDelta(delta: string): void {
    this.part.text += delta;
    this.emitUpdated();
  }

  /**
   * 设置推理内容
   */
  setText(text: string): void {
    this.part.text = text;
    this.emitUpdated();
  }

  /**
   * 设置 reasoning tokens
   */
  setReasoningTokens(tokens: number): void {
    if (!this.part.metadata) {
      this.part.metadata = {};
    }
    this.part.metadata.reasoningTokens = tokens;
    this.emitUpdated();
  }

  /**
   * 切换展开状态（UI 使用）
   */
  toggleExpanded(): void {
    (this.part as any).expanded = !(this.part as any).expanded;
    this.emitUpdated();
  }

  /**
   * 完成推理 Part
   */
  complete(): void {
    this.part.time.end = Date.now();
    this.emitCompleted();
  }
}
