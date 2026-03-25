/**
 * 工具注册表
 *
 * 管理所有可用工具，提供工具注册、查询和执行功能
 */

import { BaseTool } from './BaseTool';
import type { ToolDefinition, ToolExecutionResult, ToolContext } from '../types/tools';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  /**
   * 注册工具
   */
  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 注销工具
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * 获取工具
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有工具定义
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.getDefinition());
  }

  /**
   * 获取所有工具的 OpenAI 函数格式
   */
  getOpenAIFunctions(): any[] {
    return Array.from(this.tools.values()).map(t => t.getOpenAIFunction());
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    input: any,
    context?: ToolContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `工具未找到: ${name}`,
      };
    }

    try {
      // 参数验证
      const validated = tool.inputSchema.parse(input);

      // 执行工具
      const result = await tool.execute(validated, context);

      return {
        success: true,
        output: JSON.stringify(result),
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 列出所有工具名称
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 转换为 Vercel AI SDK 工具格式
   */
  toVercelAITools(): Record<string, {
    description: string;
    parameters: any;
  }> {
    const tools = Array.from(this.tools.values());
    const result: Record<string, { description: string; parameters: any }> = {};

    for (const tool of tools) {
      const openAIFunc = tool.getOpenAIFunction();
      result[tool.name] = {
        description: openAIFunc.function.description,
        parameters: openAIFunc.function.parameters,
      };
    }

    return result;
  }
}
