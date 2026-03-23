// packages/core/src/sdk/ToolsModule.ts

import { ToolRegistry } from '../tools/ToolRegistry';
import { BaseTool } from '../tools/BaseTool';
import type { ToolDefinition } from '../types/tools';

/**
 * Tools 模块
 * 负责工具注册和管理
 */
export class ToolsModule {
  constructor(private registry: ToolRegistry) {}

  /**
   * 注册自定义工具
   * @param tool 工具实例
   */
  register(tool: BaseTool): void {
    this.registry.register(tool);
  }

  /**
   * 批量注册工具
   * @param tools 工具实例数组
   */
  registerAll(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.registry.register(tool);
    }
  }

  /**
   * 获取工具注册表（用于注册自定义工具）
   * @deprecated 使用 register() 方法代替
   */
  get toolRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * 列出所有可用工具
   */
  list(): string[] {
    return this.registry.listTools();
  }

  /**
   * 获取工具详情
   */
  get(name: string): ToolDefinition | undefined {
    const tool = this.registry.getTool(name);
    return tool?.getDefinition();
  }
}
