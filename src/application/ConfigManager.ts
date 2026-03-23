/**
 * 配置管理器
 *
 * 负责加载、保存、访问 Core 配置
 */

import path from 'path';
import os from 'os';
import type { IFileSystem } from '../storage/utils/fs';
import type {
  CoreConfig,
  AgentDefaultsConfig,
  ProviderConfig,
  ProvidersConfig,
  ToolsConfig,
  MCPServerConfig,
  FilesystemToolConfig,
  TerminalToolConfig,
  WebToolConfig,
} from '../types/config';

/**
 * 配置管理器
 */
export class ConfigManager {
  private configPath: string;
  private config: CoreConfig;

  constructor(
    private fs: IFileSystem,
    baseDir: string = '~/.prism-agent'
  ) {
    // 展开 ~ 符号
    const expandedDir = baseDir.startsWith('~')
      ? baseDir.replace('~', os.homedir())
      : baseDir;
    this.configPath = path.join(expandedDir, 'config.json');
    this.config = this.loadConfig();
  }

  // ========== Agent 配置 ==========

  /**
   * 获取 Agent 默认配置
   */
  getAgentDefaults(): AgentDefaultsConfig {
    return this.config.agents.defaults;
  }

  /**
   * 更新 Agent 默认配置
   */
  async updateAgentDefaults(updates: Partial<AgentDefaultsConfig>): Promise<void> {
    Object.assign(this.config.agents.defaults, updates);
    await this.save();
  }

  // ========== Provider 配置 ==========

  /**
   * 获取指定 Provider 配置
   */
  getProvider(name: string): ProviderConfig | undefined {
    return this.config.providers[name as keyof ProvidersConfig];
  }

  /**
   * 获取所有 Provider 配置
   */
  getAllProviders(): ProvidersConfig {
    return this.config.providers;
  }

  /**
   * 更新 Provider 配置
   */
  async updateProvider(name: string, config: ProviderConfig): Promise<void> {
    (this.config.providers as any)[name] = config;
    await this.save();
  }

  // ========== Tools 配置 ==========

  /**
   * 获取工具配置
   */
  getToolConfig<T extends keyof ToolsConfig>(name: T): ToolsConfig[T] {
    return this.config.tools[name];
  }

  /**
   * 获取所有工具配置
   */
  getAllTools(): ToolsConfig {
    return this.config.tools;
  }

  /**
   * 更新工具配置
   */
  async updateToolConfig<T extends keyof ToolsConfig>(
    name: T,
    config: ToolsConfig[T]
  ): Promise<void> {
    this.config.tools[name] = config;
    await this.save();
  }

  // ========== MCP 配置 ==========

  /**
   * 获取 MCP 服务器列表
   */
  getMCPServers(): MCPServerConfig[] {
    return this.config.mcp.servers;
  }

  /**
   * 添加 MCP 服务器
   */
  async addMCPServer(server: MCPServerConfig): Promise<void> {
    this.config.mcp.servers.push(server);
    await this.save();
  }

  /**
   * 删除 MCP 服务器
   */
  async removeMCPServer(name: string): Promise<void> {
    this.config.mcp.servers = this.config.mcp.servers.filter((s: MCPServerConfig) => s.name !== name);
    await this.save();
  }

  /**
   * 更新 MCP 服务器
   */
  async updateMCPServer(name: string, updates: Partial<MCPServerConfig>): Promise<void> {
    const index = this.config.mcp.servers.findIndex((s: MCPServerConfig) => s.name === name);
    if (index !== -1) {
      Object.assign(this.config.mcp.servers[index], updates);
      await this.save();
    }
  }

  // ========== 持久化 ==========

  /**
   * 保存配置到文件
   */
  async save(): Promise<void> {
    const content = JSON.stringify(this.config, null, 2);
    await this.fs.writeFile(this.configPath, content);
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.config = this.loadConfig();
  }

  /**
   * 获取原始配置（兼容现有代码）
   */
  getRawConfig(): CoreConfig {
    return this.config;
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  // ========== 私有方法 ==========

  /**
   * 加载配置（带默认值合并）
   */
  private loadConfig(): CoreConfig {
    const defaultConfig: CoreConfig = {
      agents: {
        defaults: {
          model: 'zhipu/glm-4',
          maxTokens: 8192,
          temperature: 0.7,
          maxIterations: 20,
        },
      },
      providers: {},
      tools: {
        filesystem: { enabled: true, allowedPaths: ['~'] },
        terminal: { enabled: true, timeoutSeconds: 60 },
        web: { enabled: true },
      },
      mcp: { servers: [] },
    };

    try {
      if (this.fs.existsSync(this.configPath)) {
        const content = this.fs.readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(content) as Partial<CoreConfig>;
        return this.mergeConfig(defaultConfig, saved);
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
    }

    // 首次运行，使用默认配置（不自动保存，将在首次更新时写入文件）
    this.config = defaultConfig;
    return defaultConfig;
  }

  /**
   * 深度合并配置
   */
  private mergeConfig(defaults: CoreConfig, saved: Partial<CoreConfig>): CoreConfig {
    const result = { ...defaults };

    for (const key in saved) {
      const savedValue = (saved as any)[key];
      if (savedValue && typeof savedValue === 'object' && !Array.isArray(savedValue)) {
        result[key as keyof CoreConfig] = this.mergeConfig(
          (defaults[key as keyof CoreConfig] as any) || {},
          savedValue
        ) as any;
      } else if (savedValue !== undefined) {
        (result as any)[key] = savedValue;
      }
    }

    return result;
  }
}
