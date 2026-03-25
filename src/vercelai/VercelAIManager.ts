// src/vercelai/VercelAIManager.ts

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModelV1 } from 'ai';
import type { AI } from 'ai';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class VercelAIManager {
  private providerCache = new Map<string, AI>();
  private modelCache = new Map<string, LanguageModelV1>();

  /**
   * 获取 LanguageModel 实例
   */
  getModel(provider: string, model: string, config: ProviderConfig): LanguageModelV1 {
    // 1. 获取或创建 Provider 实例
    let aiProvider = this.providerCache.get(provider);
    if (!aiProvider) {
      aiProvider = this.createProvider(provider, config);
      this.providerCache.set(provider, aiProvider);
    }

    // 2. 获取或创建 Model 实例
    const modelKey = `${provider}:${model}`;
    let languageModel = this.modelCache.get(modelKey);
    if (!languageModel) {
      languageModel = aiProvider.languageModel(model);
      this.modelCache.set(modelKey, languageModel);
    }

    return languageModel;
  }

  /**
   * 创建 Provider 实例
   */
  private createProvider(provider: string, config: ProviderConfig): AI {
    switch (provider) {
      case 'openai':
        return createOpenAI({
          apiKey: config.apiKey || process.env.OPENAI_API_KEY,
          baseURL: config.baseUrl,
        });
      case 'anthropic':
        return createAnthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          baseURL: config.baseUrl,
        });
      case 'google':
        return createGoogleGenerativeAI({
          apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
        });
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * 解析 model 字符串，提取 provider 和 model name
   * 例如: "anthropic/claude-3-5-sonnet" -> { provider: "anthropic", model: "claude-3-5-sonnet" }
   */
  parseModel(model: string): { provider: string; model: string } {
    const [provider, ...rest] = model.split('/');
    return {
      provider,
      model: rest.join('/'),
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.providerCache.clear();
    this.modelCache.clear();
  }
}

// Singleton instance
export const vercelAIManager = new VercelAIManager();