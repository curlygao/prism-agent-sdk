/**
 * BaseTool 单元测试
 *
 * 测试工具基类的功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseTool } from '../BaseTool';
import { z } from 'zod';

// 创建一个测试用的工具实现
class TestTool extends BaseTool<
  { input: string; count?: number },
  { result: string }
> {
  name = 'test_tool';
  description = 'A test tool for testing';
  summaryTemplate = '处理 {{input}}';

  inputSchema = z.object({
    input: z.string().describe('输入参数'),
    count: z.number().optional().describe('可选计数'),
  });

  async execute(input: { input: string; count?: number }): Promise<{ result: string }> {
    if (input.count) {
      return { result: input.input.repeat(input.count) };
    }
    return { result: input.input };
  }
}

describe('BaseTool', () => {
  let tool: TestTool;

  beforeEach(() => {
    tool = new TestTool();
  });

  // ============================================================================
  // 基础属性
  // ============================================================================

  describe('基础属性', () => {
    it('应该有工具名称', () => {
      expect(tool.name).toBe('test_tool');
    });

    it('应该有工具描述', () => {
      expect(tool.description).toBe('A test tool for testing');
    });

    it('应该有输入 Schema', () => {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
    });

    it('应该有摘要模板', () => {
      expect(tool.summaryTemplate).toBe('处理 {{input}}');
    });
  });

  // ============================================================================
  // 工具定义
  // ============================================================================

  describe('getDefinition', () => {
    it('应该返回正确的工具定义', () => {
      const definition = tool.getDefinition();

      expect(definition).toMatchObject({
        name: 'test_tool',
        description: 'A test tool for testing',
      });
      expect(definition.inputSchema).toBe(tool.inputSchema);
    });
  });

  // ============================================================================
  // OpenAI 函数格式
  // ============================================================================

  describe('getOpenAIFunction', () => {
    it('应该返回正确的 OpenAI 函数格式', () => {
      const openaiFn = tool.getOpenAIFunction();

      expect(openaiFn).toMatchObject({
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool for testing',
        },
      });
      expect(openaiFn.function.parameters).toBeDefined();
    });

    it('应该正确转换 Zod Schema 为 JSON Schema', () => {
      const openaiFn = tool.getOpenAIFunction();
      const params = openaiFn.function.parameters;

      expect(params.type).toBe('object');
      expect(params.properties).toBeDefined();
      expect(params.properties.input).toBeDefined();
      expect(params.properties.input.type).toBe('string');
      expect(params.properties.count).toBeDefined();
      expect(params.properties.count.type).toBe('number');
    });

    it('应该标记必填字段', () => {
      const openaiFn = tool.getOpenAIFunction();
      const params = openaiFn.function.parameters;

      expect(params.required).toContain('input');
      expect(params.required).not.toContain('count');
    });

    it('应该处理嵌套对象 Schema', () => {
      class NestedTool extends BaseTool<{ nested: { field: string } }, {}> {
        name = 'nested_tool';
        description = 'Tool with nested schema';
        summaryTemplate = 'Nested';

        inputSchema = z.object({
          nested: z.object({
            field: z.string(),
          }),
        });

        async execute() {
          return {};
        }
      }

      const nestedTool = new NestedTool();
      const openaiFn = nestedTool.getOpenAIFunction();
      const params = openaiFn.function.parameters;

      expect(params.properties.nested).toBeDefined();
      expect(params.properties.nested.type).toBe('object');
      expect(params.properties.nested.properties).toBeDefined();
      expect(params.properties.nested.properties.field).toBeDefined();
    });

    it('应该处理数组 Schema', () => {
      class ArrayTool extends BaseTool<{ items: string[] }, {}> {
        name = 'array_tool';
        description = 'Tool with array schema';
        summaryTemplate = 'Array';

        inputSchema = z.object({
          items: z.array(z.string()),
        });

        async execute() {
          return {};
        }
      }

      const arrayTool = new ArrayTool();
      const openaiFn = arrayTool.getOpenAIFunction();
      const params = openaiFn.function.parameters;

      expect(params.properties.items).toBeDefined();
      expect(params.properties.items.type).toBe('array');
    });

    it('应该处理布尔值 Schema', () => {
      class BooleanTool extends BaseTool<{ flag: boolean }, {}> {
        name = 'boolean_tool';
        description = 'Tool with boolean schema';
        summaryTemplate = 'Boolean';

        inputSchema = z.object({
          flag: z.boolean(),
        });

        async execute() {
          return {};
        }
      }

      const booleanTool = new BooleanTool();
      const openaiFn = booleanTool.getOpenAIFunction();
      const params = openaiFn.function.parameters;

      expect(params.properties.flag).toBeDefined();
      expect(params.properties.flag.type).toBe('boolean');
    });
  });

  // ============================================================================
  // 摘要生成
  // ============================================================================

  describe('getSummary', () => {
    it('应该使用模板生成摘要', () => {
      const summary = tool.getSummary({ input: 'test data' });

      expect(summary).toBe('处理 test data');
    });

    it('应该替换多个占位符', () => {
      class MultiParamTool extends BaseTool<
        { name: string; value: number },
        {}
      > {
        name = 'multi_tool';
        description = 'Multi param tool';
        summaryTemplate = '设置 {{name}} 为 {{value}}';

        inputSchema = z.object({
          name: z.string(),
          value: z.number(),
        });

        async execute() {
          return {};
        }
      }

      const multiTool = new MultiParamTool();
      const summary = multiTool.getSummary({ name: 'timeout', value: 30 });

      expect(summary).toBe('设置 timeout 为 30');
    });

    it('应该截断过长的值', () => {
      const longInput = 'a'.repeat(100);
      const summary = tool.getSummary({ input: longInput });

      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(longInput.length + 10);
    });

    it('应该处理缺失的参数（使用占位符）', () => {
      const summary = tool.getSummary({ input: 'test' } as any);

      expect(summary).toBe('处理 test');
    });

    it('应该处理 null 值', () => {
      const summary = tool.getSummary({ input: null as any });

      expect(summary).toBe('处理 ...');
    });

    it('应该处理 undefined 值', () => {
      const summary = tool.getSummary({ input: undefined as any });

      expect(summary).toBe('处理 ...');
    });

    it('应该转换数字为字符串', () => {
      class NumberTool extends BaseTool<{ count: number }, {}> {
        name = 'number_tool';
        description = 'Number tool';
        summaryTemplate = '计数 {{count}}';

        inputSchema = z.object({
          count: z.number(),
        });

        async execute() {
          return {};
        }
      }

      const numberTool = new NumberTool();
      const summary = numberTool.getSummary({ count: 42 });

      expect(summary).toBe('计数 42');
    });
  });

  // ============================================================================
  // 工具执行
  // ============================================================================

  describe('execute', () => {
    it('应该执行工具逻辑', async () => {
      const result = await tool.execute({ input: 'hello' });

      expect(result).toEqual({ result: 'hello' });
    });

    it('应该支持可选参数', async () => {
      const result = await tool.execute({ input: 'test', count: 3 });

      expect(result).toEqual({ result: 'testtesttest' });
    });

    it('应该处理执行上下文', async () => {
      class ContextTool extends BaseTool<{ input: string }, { context: string }> {
        name = 'context_tool';
        description = 'Context aware tool';
        summaryTemplate = 'Context';

        inputSchema = z.object({ input: z.string() });

        async execute(input: { input: string }, context?: any): Promise<{ context: string }> {
          return {
            context: context?.sessionId || 'no-context',
          };
        }
      }

      const contextTool = new ContextTool();
      const result = await contextTool.execute(
        { input: 'test' },
        { sessionId: 'sess-123' }
      );

      expect(result.context).toBe('sess-123');
    });
  });

  // ============================================================================
  // 边界情况
  // ============================================================================

  describe('边界情况', () => {
    it('应该处理空字符串输入', async () => {
      const result = await tool.execute({ input: '' });

      expect(result).toEqual({ result: '' });
    });

    it('应该处理特殊字符输入', async () => {
      const specialInput = '特殊字符 && "quotes" \'apostrophes\'';
      const result = await tool.execute({ input: specialInput });

      expect(result.result).toBe(specialInput);
    });

    it('应该处理 Unicode 输入', async () => {
      const unicodeInput = '你好世界 🌍';
      const result = await tool.execute({ input: unicodeInput });

      expect(result.result).toBe(unicodeInput);
    });

    it('应该处理大数字输入', async () => {
      const result = await tool.execute({
        input: 'x',
        count: 999999,
      });

      expect(result.result.length).toBe(999999);
    });
  });

  // ============================================================================
  // Schema 验证
  // ============================================================================

  describe('Schema 验证', () => {
    it('应该验证必填字段', async () => {
      // 尝试不传必填字段
      await expect((tool.execute as any)({})).rejects.toThrow();
    });

    it('应该拒绝类型错误的输入', async () => {
      await expect(
        (tool.execute as any)({ input: 123 })
      ).rejects.toThrow();
    });

    it('应该接受有效的输入', async () => {
      await expect(
        tool.execute({ input: 'valid input' })
      ).resolves.toBeDefined();
    });

    it('应该支持默认值', () => {
      class DefaultTool extends BaseTool<
        { value: string; optional?: string },
        {}
      > {
        name = 'default_tool';
        description = 'Tool with defaults';
        summaryTemplate = 'Default';

        inputSchema = z.object({
          value: z.string(),
          optional: z.string().default('default-value'),
        });

        async execute() {
          return {};
        }
      }

      const defaultTool = new DefaultTool();
      const openaiFn = defaultTool.getOpenAIFunction();
      const params = openaiFn.function.parameters;

      // 默认值字段不应该在 required 中
      expect(params.required).not.toContain('optional');
    });
  });

  // ============================================================================
  // 模板插值
  // ============================================================================

  describe('模板插值', () => {
    it('应该正确插值字符串类型', () => {
      class TemplateTool extends BaseTool<{ name: string }, {}> {
        name = 'template_tool';
        description = 'Template tool';
        summaryTemplate = 'Name: {{name}}';

        inputSchema = z.object({ name: z.string() });

        async execute() {
          return {};
        }
      }

      const templateTool = new TemplateTool();
      const summary = templateTool.getSummary({ name: 'Alice' });

      expect(summary).toBe('Name: Alice');
    });

    it('应该处理模板中的多个相同占位符', () => {
      class RepeatTemplateTool extends BaseTool<{ value: string }, {}> {
        name = 'repeat_template_tool';
        description = 'Repeat template tool';
        summaryTemplate = '{{value}} - {{value}} - {{value}}';

        inputSchema = z.object({ value: z.string() });

        async execute() {
          return {};
        }
      }

      const repeatTool = new RepeatTemplateTool();
      const summary = repeatTool.getSummary({ value: 'X' });

      expect(summary).toBe('X - X - X');
    });

    it('应该处理模板中没有的占位符', () => {
      const summary = tool.getSummary({ input: 'test' });
      // 如果模板中有占位符但输入中没有，应该显示 '...'
      expect(summary).toBeDefined();
    });
  });
});
