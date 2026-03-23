/**
 * Part Entity 基类
 *
 * 提供所有 Part Entity 的通用功能
 */

import { randomUUID } from 'crypto';
import { eventBus } from '../events/EventBus';
import type { Part } from '../types/parts';

/**
 * Part Entity 事件类型
 */
interface PartEntityEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

/**
 * Part Entity 基类
 */
export abstract class PartEntity<T extends Part> {
  protected part: T;

  constructor(part: T) {
    this.part = part;
  }

  /**
   * 获取 Part 实例
   */
  get(): T {
    return this.part;
  }

  /**
   * 获取 Part ID
   */
  getId(): string {
    return this.part.id;
  }

  /**
   * 触发创建事件
   */
  protected emitCreated(): void {
    const event: PartEntityEvent = {
      id: randomUUID(),
      type: 'part:created',
      payload: {
        part: this.part,
        messageId: this.part.messageId,
        sessionId: this.part.sessionId,
      },
      timestamp: Date.now(),
    };
    eventBus.emit(event.type, event);
  }

  /**
   * 触发更新事件
   */
  protected emitUpdated(): void {
    (this.part as any).updatedAt = Date.now();
    const event: PartEntityEvent = {
      id: randomUUID(),
      type: 'part:updated',
      payload: {
        part: this.part,
        messageId: this.part.messageId,
      },
      timestamp: Date.now(),
    };
    eventBus.emit(event.type, event);
  }

  /**
   * 触发完成事件
   */
  protected emitCompleted(): void {
    const event: PartEntityEvent = {
      id: randomUUID(),
      type: 'part:completed',
      payload: {
        part: this.part,
        messageId: this.part.messageId,
      },
      timestamp: Date.now(),
    };
    eventBus.emit(event.type, event);
  }

  /**
   * 生成唯一 ID
   */
  static generateId(): string {
    return randomUUID();
  }
}
