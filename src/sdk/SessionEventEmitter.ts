import type { SDKEventBus } from './SDKEventBus';

interface EventHandler {
  once: boolean;
  handler: (data: any) => void;
}

export class SessionEventEmitter {
  private listeners = new Map<string, EventHandler[]>();

  constructor(
    private readonly sessionId: string,
    private readonly globalBus: SDKEventBus | null
  ) {}

  on(event: string, handler: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ once: false, handler });
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.handler === handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  once(event: string, handler: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ once: true, handler });
  }

  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const toRemove: number[] = [];
      handlers.forEach((h, index) => {
        h.handler(data);
        if (h.once) {
          toRemove.push(index);
        }
      });
      // 移除 once 监听器（从后往前）
      for (let i = toRemove.length - 1; i >= 0; i--) {
        handlers.splice(toRemove[i], 1);
      }
    }

    // 委托到全局总线
    if (this.globalBus) {
      // 为所有事件添加 agent: 前缀以匹配 IPC 层面的监听
      // 前端 API 监听的事件名称都是 agent:xxx 格式
      const eventName = `agent:${event}`;
      this.globalBus.internalEmit(eventName as any, {
        sessionId: this.sessionId,
        ...data,
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
