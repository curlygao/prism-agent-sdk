// packages/core/src/PrismAgentSDK.ts

import type { PrismAgentOptions } from './types/sdk';
import { SDKEventBus } from './sdk/SDKEventBus';
import { ToolsModule } from './sdk/ToolsModule';
import { StorageModule } from './sdk/StorageModule';
import { ApplicationModule } from './sdk/ApplicationModule';
import { ProvidersModule } from './sdk/ProvidersModule';
import { SessionManager } from './sdk/SessionManager';

// 导入内部实现
import { EventBus } from './events/EventBus';
import { ConfigManager } from './application/ConfigManager';
import { AppStateManager } from './application/AppStateManager';
import { StorageManager } from './storage/StorageManager';
import { ToolRegistry } from './tools/ToolRegistry';
// 导入所有内置工具
import { ReadFileTool, WriteFileTool, ListDirTool } from './tools/FileTool';
import { ExecCommandTool } from './tools/TerminalTool';
import { HttpGetTool } from './tools/WebTool';
import { ProviderManager } from './providers/ProviderManager';
import { NodeFileSystem } from './storage/utils/fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Prism Agent SDK 统一入口
 */
export class PrismAgentSDK {
  private _closed = false;
  private _eventBus: EventBus;
  private _storage: StorageManager;
  private _toolRegistry: ToolRegistry;
  private _workingDir: string;

  // 公共模块
  readonly events: SDKEventBus;
  readonly sessions: SessionManager;
  readonly tools: ToolsModule;
  readonly storage: StorageModule;
  readonly app: ApplicationModule;
  readonly providers: ProvidersModule;

  constructor(options: PrismAgentOptions) {
    const {
      workingDir,
      configDir = '~/.prism-agent',
      logLevel = 'info',
    } = options;

    // 创建基础设施
    const fs = new NodeFileSystem();
    this._eventBus = new EventBus();

    // 展开 ~ 符号
    const expandedConfigDir = configDir.startsWith('~')
      ? configDir.replace('~', os.homedir())
      : configDir;

    // 创建存储层
    this._storage = new StorageManager(fs, path.join(expandedConfigDir, 'projects'));

    // 创建应用层
    const configManager = new ConfigManager(fs, expandedConfigDir);
    const stateManager = new AppStateManager(this._eventBus);
    const applicationModule = new ApplicationModule(configManager, stateManager, this._eventBus);

    // 创建工具注册表并注册所有内置工具
    const toolRegistry = new ToolRegistry();

    // 保存引用供后续使用
    this._toolRegistry = toolRegistry;
    this._workingDir = workingDir;

    // 注册所有内置工具
    toolRegistry.register(new ReadFileTool() as any);
    toolRegistry.register(new WriteFileTool() as any);
    toolRegistry.register(new ListDirTool() as any);
    toolRegistry.register(new ExecCommandTool() as any);
    toolRegistry.register(new HttpGetTool() as any);

    // 创建 Provider 管理
    const providerManager = new ProviderManager();
    providerManager.initFromConfigManager(configManager);

    // 创建事件总线
    const sdkEvents = new SDKEventBus();

    // 获取默认 provider，根据 agents.defaults.model 中的 provider 前缀选择
    const agentDefaults = configManager.getAgentDefaults();
    let defaultProviderName: string | undefined;
    if (agentDefaults.model && agentDefaults.model.includes('/')) {
      // model 格式为 "provider/model"，提取 provider 名称
      defaultProviderName = agentDefaults.model.split('/')[0];
    }
    const provider = providerManager.getProvider(defaultProviderName);

    // 创建各模块
    this.events = sdkEvents;
    this.storage = new StorageModule(this._storage);
    this.app = applicationModule;
    this.tools = new ToolsModule(toolRegistry);
    this.providers = new ProvidersModule(providerManager);

    // 创建 SessionManager，传入共享的事件总线
    this.sessions = new SessionManager(
      this._storage,
      provider,  // 使用获取的 provider
      toolRegistry,
      sdkEvents,  // 传入共享的事件总线
      workingDir
    );
  }

  /**
   * 关闭 SDK，释放资源
   */
  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    // 关闭所有会话
    await this.sessions.closeAll();
    // 释放资源
  }

  /**
   * 检查是否已关闭
   */
  isClosed(): boolean {
    return this._closed;
  }
}
