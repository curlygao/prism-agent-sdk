/**
 * 配置相关类型定义
 * 从 src/lib/types/config.ts 迁移
 */

export interface AgentDefaultsConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  maxIterations: number;
}

export interface ProviderConfig {
  apiKey: string;
  apiBase?: string;
  model?: string;
}

export interface ProvidersConfig {
  openrouter?: ProviderConfig;
  anthropic?: ProviderConfig;
  openai?: ProviderConfig;
  zhipu?: ProviderConfig;
  deepseek?: ProviderConfig;
  gemini?: ProviderConfig;
  dashscope?: ProviderConfig;
  minimax?: ProviderConfig;
}

export interface FilesystemToolConfig {
  enabled: boolean;
  allowedPaths: string[];
}

export interface TerminalToolConfig {
  enabled: boolean;
  timeoutSeconds: number;
}

export interface WebToolConfig {
  enabled: boolean;
}

export interface ToolsConfig {
  filesystem: FilesystemToolConfig;
  terminal: TerminalToolConfig;
  web: WebToolConfig;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}
