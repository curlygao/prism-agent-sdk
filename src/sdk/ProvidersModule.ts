import { ProviderManager } from '../providers/ProviderManager';
import type { BaseProvider } from '../providers/BaseProvider';

/**
 * Providers 模块
 * 负责 LLM 提供商管理
 */
export class ProvidersModule {
  constructor(private manager: ProviderManager) {}

  /**
   * 获取当前 Provider
   */
  getCurrent(): BaseProvider {
    return this.manager.getProvider();
  }

  /**
   * 列出可用 Provider
   */
  list(): string[] {
    return this.manager.listProviders();
  }

  /**
   * 切换 Provider
   */
  switch(name: string): void {
    this.manager.setDefaultProvider(name);
  }
}
