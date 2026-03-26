// packages/core/src/index.ts
// 从 src/core 迁移的核心层代码

export * from './agent';
export * from './application';
export * from './events';
export * from './parts';
// Providers removed - using Vercel AI SDK instead
// export * from './providers';
export { VercelAIManager, vercelAIManager } from './vercelai';
export type { ProviderConfig } from './vercelai';
export * from './storage';
export * from './tools';
export * from './types';
export * from './utils';

// SDK 统一入口
export { PrismAgentSDK } from './PrismAgentSDK';
export * from './sdk';
