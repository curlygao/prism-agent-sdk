/**
 * Tool 抽象基类
 *
 * 所有工具都应该继承此类并实现 execute 方法
 */

import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/tools';

export abstract class BaseTool<TInput = any, TOutput = any> {
  /**
   * 工具名称
   */
  abstract name: string;

  /**
   * 工具描述
   */
  abstract description: string;

  /**
   * 输入参数 Schema (Zod)
   */
  abstract inputSchema: z.ZodType<TInput>;

  /**
   * 执行工具
   */
  abstract execute(input: TInput, context?: ToolContext): Promise<TOutput>;

  /**
   * 摘要模板（用于生成用户友好的操作描述）
   * 支持使用 {{paramName}} 占位符，例如：'读取 {{path}}'
   */
  abstract summaryTemplate: string;

  /**
   * 生成智能摘要
   * 根据输入参数和模板生成用户友好的操作描述
   */
  getSummary(input: TInput): string {
    return this.interpolateTemplate(this.summaryTemplate, input);
  }

  /**
   * 模板插值：将 {{param}} 替换为实际值
   */
  private interpolateTemplate(template: string, input: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = input[key];
      if (value === undefined || value === null) return '...';
      // 截断过长的值
      if (typeof value === 'string' && value.length > 30) {
        return value.slice(0, 30) + '...';
      }
      return String(value);
    });
  }

  /**
   * 获取工具定义
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
    };
  }

  /**
   * 获取工具的 OpenAI 函数调用格式
   */
  getOpenAIFunction() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.zodToJsonSchema(this.inputSchema),
      },
    };
  }

  /**
   * 将 Zod Schema 转换为 JSON Schema
   */
  private zodToJsonSchema(schema: z.ZodType<any>): any {
    // 简化版本，实际项目中可以使用 zod-to-json-schema
    const zodSchema = schema as z.ZodObject<any>;
    const shape = zodSchema.shape;

    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodTypeAny;
      properties[key] = this.getZodTypeDescription(zodValue);

      if (!zodValue.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  private getZodTypeDescription(zodValue: z.ZodTypeAny): any {
    if (zodValue instanceof z.ZodString) {
      return { type: 'string' };
    }
    if (zodValue instanceof z.ZodNumber) {
      return { type: 'number' };
    }
    if (zodValue instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }
    if (zodValue instanceof z.ZodArray) {
      return { type: 'array', items: {} };
    }
    if (zodValue instanceof z.ZodObject) {
      return this.zodToJsonSchema(zodValue);
    }
    return { type: 'string' };
  }
}
