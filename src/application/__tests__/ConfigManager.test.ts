/**
 * ConfigManager 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import { ConfigManager } from '../ConfigManager';
import type { IFileSystem } from '../../storage/utils/fs';
import type {
  CoreConfig,
  FilesystemToolConfig,
  TerminalToolConfig,
  WebToolConfig,
} from '../../types/config';

// 获取跨平台兼容的路径
const getConfigPath = (baseDir: string) => path.join(baseDir, 'config.json');

// Mock FileSystem
const mockFileSystem: IFileSystem = {
  writeFile: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  exists: vi.fn(),
  readdir: vi.fn(),
} as any;

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('配置加载', () => {
    it('首次加载时应该使用默认配置（不自动保存）', () => {
      (mockFileSystem.existsSync as any).mockReturnValue(false);

      configManager = new ConfigManager(mockFileSystem, '/test/config');

      // 首次加载不自动写入文件，只使用默认配置
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();

      // 验证默认配置已加载
      const defaults = configManager.getAgentDefaults();
      expect(defaults.workspace).toBeUndefined();
      expect(defaults.model).toBe('zhipu/glm-4');
    });

    it('应该从文件加载现有配置', () => {
      const existingConfig: CoreConfig = {
        agents: {
          defaults: {
            workspace: '/custom/workspace',
            model: 'custom-model',
            maxTokens: 4096,
            temperature: 0.5,
            maxIterations: 10,
          },
        },
        providers: {
          anthropic: { apiKey: 'test-key' },
        },
        tools: {
          filesystem: { enabled: false, allowedPaths: ['/tmp'] },
          terminal: { enabled: true, timeoutSeconds: 30 },
          web: { enabled: false },
        },
        mcp: { servers: [] },
      };

      (mockFileSystem.existsSync as any).mockReturnValue(true);
      (mockFileSystem.readFileSync as any).mockReturnValue(JSON.stringify(existingConfig));

      configManager = new ConfigManager(mockFileSystem, '/test/config');

      const config = configManager.getRawConfig();
      expect(config.agents.defaults.workspace).toBe('/custom/workspace');
      expect(config.agents.defaults.model).toBe('custom-model');
      expect(config.providers.anthropic?.apiKey).toBe('test-key');
    });

    it('应该合并默认配置和用户配置', () => {
      const partialConfig: Partial<CoreConfig> = {
        agents: {
          defaults: {
            workspace: '/custom/workspace',
            model: 'custom-model',
            maxTokens: 4096,
            temperature: 0.5,
            maxIterations: 10,
          },
        },
        // providers 缺失，应该使用默认空对象
      };

      (mockFileSystem.existsSync as any).mockReturnValue(true);
      (mockFileSystem.readFileSync as any).mockReturnValue(JSON.stringify(partialConfig));

      configManager = new ConfigManager(mockFileSystem, '/test/config');

      const config = configManager.getRawConfig();
      expect(config.agents.defaults.workspace).toBe('/custom/workspace');
      expect(config.providers).toEqual({});
    });
  });

  describe('Agent 配置', () => {
    beforeEach(() => {
      (mockFileSystem.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager(mockFileSystem, '/test/config');
    });

    it('应该获取 Agent 默认配置', () => {
      const agentDefaults = configManager.getAgentDefaults();

      expect(agentDefaults.workspace).toBeUndefined();
      expect(agentDefaults.model).toBe('zhipu/glm-4');
      expect(agentDefaults.maxTokens).toBe(8192);
    });

    it('应该更新 Agent 默认配置', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.updateAgentDefaults({ model: 'new-model' });

      expect(configManager.getAgentDefaults().model).toBe('new-model');
      expect(mockFileSystem.writeFile).toHaveBeenCalled();
    });
  });

  describe('Provider 配置', () => {
    beforeEach(() => {
      (mockFileSystem.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager(mockFileSystem, '/test/config');
    });

    it('应该获取所有 Provider 配置', () => {
      const providers = configManager.getAllProviders();

      expect(providers).toEqual({});
    });

    it('应该获取指定 Provider 配置', () => {
      const provider = configManager.getProvider('anthropic');

      expect(provider).toBeUndefined();
    });

    it('应该更新 Provider 配置', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.updateProvider('anthropic', { apiKey: 'test-key' });

      expect(configManager.getProvider('anthropic')?.apiKey).toBe('test-key');
    });
  });

  describe('Tools 配置', () => {
    beforeEach(() => {
      (mockFileSystem.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager(mockFileSystem, '/test/config');
    });

    it('应该获取所有工具配置', () => {
      const tools = configManager.getAllTools();

      expect(tools.filesystem.enabled).toBe(true);
      expect(tools.terminal.enabled).toBe(true);
      expect(tools.web.enabled).toBe(true);
    });

    it('应该获取指定工具配置', () => {
      const filesystem = configManager.getToolConfig('filesystem');

      expect(filesystem.enabled).toBe(true);
      expect(filesystem.allowedPaths).toEqual(['~']);
    });

    it('应该更新工具配置', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.updateToolConfig('filesystem', {
        enabled: false,
        allowedPaths: ['/tmp'],
      });

      expect(configManager.getToolConfig('filesystem').enabled).toBe(false);
    });
  });

  describe('MCP 配置', () => {
    beforeEach(() => {
      (mockFileSystem.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager(mockFileSystem, '/test/config');
    });

    it('应该获取空的 MCP 服务器列表', () => {
      const servers = configManager.getMCPServers();

      expect(servers).toEqual([]);
    });

    it('应该添加 MCP 服务器', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.addMCPServer({
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        enabled: true,
      });

      const servers = configManager.getMCPServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('test-server');
    });

    it('应该删除 MCP 服务器', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.addMCPServer({
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        enabled: true,
      });

      await configManager.removeMCPServer('test-server');

      const servers = configManager.getMCPServers();
      expect(servers).toHaveLength(0);
    });

    it('应该更新 MCP 服务器', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.addMCPServer({
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        enabled: true,
      });

      await configManager.updateMCPServer('test-server', { enabled: false });

      const servers = configManager.getMCPServers();
      expect(servers[0].enabled).toBe(false);
    });
  });

  describe('配置持久化', () => {
    beforeEach(() => {
      (mockFileSystem.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager(mockFileSystem, '/test/config');
    });

    it('应该保存配置到文件', async () => {
      (mockFileSystem.writeFile as any).mockResolvedValue(undefined);

      await configManager.save();

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        getConfigPath('/test/config'),
        expect.stringContaining('"agents"')
      );
    });

    it('应该重新加载配置', () => {
      const newConfig: CoreConfig = {
        agents: {
          defaults: {
            workspace: '/reloaded',
            model: 'reloaded-model',
            maxTokens: 2048,
            temperature: 0.3,
            maxIterations: 5,
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

      (mockFileSystem.existsSync as any).mockReturnValue(true);
      (mockFileSystem.readFileSync as any).mockReturnValue(JSON.stringify(newConfig));

      configManager.reload();

      expect(configManager.getAgentDefaults().workspace).toBe('/reloaded');
    });

    it('应该获取配置文件路径', () => {
      const configPath = configManager.getConfigPath();

      expect(configPath).toBe(getConfigPath('/test/config'));
    });
  });
});
