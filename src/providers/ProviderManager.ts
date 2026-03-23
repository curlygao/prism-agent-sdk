/**
 * Provider 管理器
 *
 * 管理多个 LLM 提供商
 */

import { BaseProvider } from './BaseProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { ZhipuProvider } from './ZhipuProvider';
import { GeminiProvider } from './GeminiProvider';
import { DashScopeProvider } from './DashScopeProvider';
import type { ProviderConfig } from '../types/config';
import type { ConfigManager } from '../application';

export class ProviderManager {
  private providers = new Map<string, BaseProvider>();
  private defaultProvider?: string;

  /**
   * 从 ConfigManager 初始化提供商
   */
  initFromConfigManager(configManager: ConfigManager): void {
    const config = configManager.getAllProviders();
    this.initFromConfig(config);
  }

  /**
   * 从配置初始化提供商
   */
  initFromConfig(config: { openrouter?: ProviderConfig; anthropic?: ProviderConfig; openai?: ProviderConfig; zhipu?: ProviderConfig; deepseek?: ProviderConfig; gemini?: ProviderConfig; dashscope?: ProviderConfig }): void {
    // OpenRouter
    if (config.openrouter?.apiKey) {
      this.register(
        new OpenRouterProvider(
          config.openrouter.apiKey,
          config.openrouter.apiBase
        )
      );
    }

    // Anthropic
    if (config.anthropic?.apiKey) {
      this.register(
        new AnthropicProvider(config.anthropic.apiKey, {
          apiBase: config.anthropic.apiBase,
          model: config.anthropic.model,
        })
      );
    }

    // OpenAI
    if (config.openai?.apiKey) {
      this.register(
        new OpenAIProvider(config.openai.apiKey, { apiBase: config.openai.apiBase })
      );
    }

    // 智谱 AI
    if (config.zhipu?.apiKey) {
      this.register(
        new ZhipuProvider(
          config.zhipu.apiKey,
          config.zhipu.apiBase,
          config.zhipu.model
        )
      );
    }

    // DeepSeek
    if (config.deepseek?.apiKey) {
      this.register(
        new OpenAIProvider(
          config.deepseek.apiKey,
          { apiBase: config.deepseek.apiBase || 'https://api.deepseek.com/v1' }
        )
      );
    }

    // Google Gemini
    if (config.gemini?.apiKey) {
      this.register(
        new GeminiProvider(
          config.gemini.apiKey,
          (config.gemini.model || 'gemini-1.5-pro') as any
        )
      );
    }

    // 阿里云百炼
    if (config.dashscope?.apiKey) {
      this.register(
        new DashScopeProvider(
          config.dashscope.apiKey,
          (config.dashscope.model || 'qwen-2.5-72b-instruct') as any,
          config.dashscope.apiBase
        )
      );
    }

    // 设置默认提供商
    if (this.providers.size > 0) {
      this.defaultProvider = Array.from(this.providers.keys())[0];
    }
  }

  /**
   * 注册提供商
   */
  private register(provider: BaseProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * 获取提供商
   */
  getProvider(name?: string): BaseProvider {
    const key = name || this.defaultProvider;
    if (!key) {
      throw new Error('没有可用的提供商');
    }
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`提供商未找到: ${key}`);
    }
    return provider;
  }

  /**
   * 设置默认提供商
   */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`提供商未找到: ${name}`);
    }
    this.defaultProvider = name;
  }

  /**
   * 获取所有提供商名称
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 检查提供商是否存在
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }
}
