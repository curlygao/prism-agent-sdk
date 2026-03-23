/**
 * Core 配置相关类型定义
 *
 * 重新导出 lib/types 中的配置类型，保持向后兼容
 */
import type {
  AgentDefaultsConfig,
  ProviderConfig,
  ProvidersConfig,
  FilesystemToolConfig,
  TerminalToolConfig,
  WebToolConfig,
  ToolsConfig,
  MCPServerConfig,
  MCPConfig,
} from '../lib/types';

/**
 * Core 配置
 * 不包含 ui 配置（由 Electron 层管理）
 */
export interface CoreConfig {
  agents: {
    defaults: AgentDefaultsConfig;
  };
  providers: ProvidersConfig;
  tools: ToolsConfig;
  mcp: MCPConfig;
}

// 重新导出配置类型，供外部使用
export type {
  AgentDefaultsConfig,
  ProviderConfig,
  ProvidersConfig,
  FilesystemToolConfig,
  TerminalToolConfig,
  WebToolConfig,
  ToolsConfig,
  MCPServerConfig,
  MCPConfig,
} from '../lib/types';
