import { EventEmitter } from 'eventemitter3';

/**
 * SDK 事件总线
 * 对外统一的事件接口，内部模块通过 internalEmit 桥接事件
 */
export class SDKEventBus {
  private bus: EventEmitter;

  constructor() {
    this.bus = new EventEmitter();
  }

  /**
   * 订阅事件
   */
  on<T = any>(event: string, handler: (data: T) => void): void {
    this.bus.on(event, handler);
  }

  /**
   * 取消订阅
   */
  off<T = any>(event: string, handler: (data: T) => void): void {
    this.bus.off(event, handler);
  }

  /**
   * 一次性订阅
   */
  once<T = any>(event: string, handler: (data: T) => void): void {
    this.bus.once(event, handler);
  }

  /**
   * 内部方法：由各模块调用，桥接内部事件到外部
   * 不直接对外暴露
   */
  internalEmit<T = any>(event: string, data: T): void {
    this.bus.emit(event, data);
  }
}
