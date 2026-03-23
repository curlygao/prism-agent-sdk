// packages/core/src/sdk/ApplicationModule.ts

import type { EventBus } from '../events/EventBus';
import type { ConfigManager } from '../application/ConfigManager';
import type { AppStateManager } from '../application/AppStateManager';
import type { ProjectMeta } from '../storage/types';
import type { ProcessingState } from '../application/AppStateManager';

/**
 * Application 模块
 * 负责配置管理和运行时状态
 */
export class ApplicationModule {
  constructor(
    private configManager: ConfigManager,
    private stateManager: AppStateManager,
    private eventBus: EventBus
  ) {}

  /**
   * 获取配置管理器
   */
  get config(): ConfigManager {
    return this.configManager;
  }

  /**
   * 获取状态管理器
   */
  get state(): AppStateManager {
    return this.stateManager;
  }

  /**
   * 事件订阅快捷方式
   */
  on(event: 'project:changed', handler: (project: ProjectMeta | null) => void): void;
  on(event: 'processing:changed', handler: (state: ProcessingState) => void): void;
  on(event: string, handler: (...args: any[]) => void): void {
    // 映射到内部事件
    if (event === 'project:changed' || event === 'processing:changed') {
      this.eventBus.on(event, handler);
    }
  }
}
