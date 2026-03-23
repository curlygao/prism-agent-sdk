// packages/core/src/events/EventBus.ts
import { EventEmitter } from 'eventemitter3';

/**
 * @internal
 * 内部事件总线，仅供 Core 内部模块使用
 * 不对外暴露，外部事件通过 SDKEventBus 统一管理
 */
export class EventBus extends EventEmitter {
  /**
   * @internal
   * 内部事件总线单例，用于 Core 内部模块间通信
   */
  static readonly instance = new EventBus();
}

/**
 * @internal
 * 内部事件总线单例导出
 */
export const eventBus = EventBus.instance;
