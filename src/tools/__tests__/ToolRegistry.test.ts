/**
 * ToolRegistry 单元测试
 *
 * 测试工具注册表的功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../ToolRegistry';
import { BaseTool } from '../BaseTool';
import { z } from 'zod';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ============================================================================
  // 工具注册管理
  // ============================================================================

  describe('工具注册管理', () => {
    it('应该成功注册单个工具', () => {
      const mockTool = createMockTool('test_tool');
      registry.register(mockTool);

      expect(registry.has('test_tool')).toBe(true);
      expect(registry.getTool('test_tool')).toBe(mockTool);
    });

    it('应该成功批量注册工具', () => {
      const tools = [
        createMockTool('tool1'),
        createMockTool('tool2'),
        createMockTool('tool3'),
      ];

      registry.registerAll(tools);

      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('tool2')).toBe(true);
      expect(registry.has('tool3')).toBe(true);
    });

    it('应该允许注销工具', () => {
      const mockTool = createMockTool('temp_tool');
      registry.register(mockTool);

      expect(registry.has('temp_tool')).toBe(true);

      registry.unregister('temp_tool');

      expect(registry.has('temp_tool')).toBe(false);
    });

    it('注册同名工具应该覆盖', () => {
      const tool1 = createMockTool('same_tool', 'First version');
      const tool2 = createMockTool('same_tool', 'Second version');

      registry.register(tool1);
      registry.register(tool2);

      const retrieved = registry.getTool('same_tool');
      expect(retrieved).toBe(tool2);
      expect(retrieved).not.toBe(tool1);
    });

    it('批量注册应该包含所有工具', () => {
      const tools = [
        createMockTool('tool_a'),
        createMockTool('tool_b'),
        createMockTool('tool_c'),
      ];

      registry.registerAll(tools);

      const toolNames = registry.listTools();
      expect(toolNames).toHaveLength(3);
      expect(toolNames).toContain('tool_a');
      expect(toolNames).toContain('tool_b');
      expect(toolNames).toContain('tool_c');
    });
  });

  // ============================================================================
  // 查询功能
  // ============================================================================

  describe('查询功能', () => {
    it('getTool 应返回正确工具', () => {
      const mockTool = createMockTool('query_tool');
      registry.register(mockTool);

      const retrieved = registry.getTool('query_tool');

      expect(retrieved).toBe(mockTool);
    });

    it('getTool 对不存在的工具应返回 undefined', () => {
      const retrieved = registry.getTool('non_existent_tool');

      expect(retrieved).toBeUndefined();
    });

    it('has 应正确检查工具存在', () => {
      registry.register(createMockTool('existing_tool'));

      expect(registry.has('existing_tool')).toBe(true);
      expect(registry.has('non_existing_tool')).toBe(false);
    });

    it('listTools 应返回所有工具名称', () => {
      registry.register(createMockTool('alpha'));
      registry.register(createMockTool('beta'));
      registry.register(createMockTool('gamma'));

      const toolNames = registry.listTools();

      expect(toolNames).toHaveLength(3);
      expect(toolNames).toEqual(expect.arrayContaining(['alpha', 'beta', 'gamma']));
    });

    it('空注册表应返回空列表', () => {
      const toolNames = registry.listTools();

      expect(toolNames).toEqual([]);
    });
  });

  // ============================================================================
  // 工具定义
  // ============================================================================

  describe('工具定义', () => {
    it('getDefinitions 应返回所有工具定义', () => {
      const tool1 = createMockTool('tool1', 'Tool 1 description');
      const tool2 = createMockTool('tool2', 'Tool 2 description');

      registry.register(tool1);
      registry.register(tool2);

      const definitions = registry.getDefinitions();

      expect(definitions).toHaveLength(2);
      expect(definitions[0]).toMatchObject({
        name: 'tool1',
        description: 'Tool 1 description',
      });
      expect(definitions[1]).toMatchObject({
        name: 'tool2',
        description: 'Tool 2 description',
      });
    });

    it('getOpenAIFunctions 应返回 OpenAI 格式', () => {
      const mockTool = createMockTool('openai_tool');
      registry.register(mockTool);

      const functions = registry.getOpenAIFunctions();

      expect(functions).toHaveLength(1);
      expect(functions[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'openai_tool',
        },
      });
    });

    it('空注册表应返回空定义数组', () => {
      expect(registry.getDefinitions()).toEqual([]);
      expect(registry.getOpenAIFunctions()).toEqual([]);
    });
  });

  // ============================================================================
  // 工具执行
  // ============================================================================

  describe('工具执行', () => {
    it('应该成功执行有效工具', async () => {
      const mockTool = createMockTool('success_tool');
      mockTool.execute = vi.fn().mockResolvedValue({ result: 'success' });
      registry.register(mockTool);

      const result = await registry.execute('success_tool', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('{"result":"success"}');
      expect(mockTool.execute).toHaveBeenCalledWith({ input: 'test' }, undefined);
    });

    it('应该传递执行上下文', async () => {
      const mockTool = createMockTool('context_tool');
      const contextSpy = vi.fn();
      mockTool.execute = vi.fn(async (input, context) => {
        contextSpy(context);
        return { result: 'ok' };
      });
      registry.register(mockTool);

      const toolContext = {
        sessionId: 'sess-123',
        workspace: '/test/workspace',
      };

      await registry.execute('context_tool', {}, toolContext);

      expect(contextSpy).toHaveBeenCalledWith(toolContext);
    });

    it('应该处理不存在的工具', async () => {
      const result = await registry.execute('unknown_tool', { input: 'test' });

      expect(result.success).toBe(false);
      expect(result.output).toBe('');
      expect(result.error).toContain('unknown_tool');
    });

    it('参数验证失败应返回错误', async () => {
      const mockTool = createMockTool('validated_tool');
      mockTool.inputSchema = {
        parse: vi.fn(() => {
          throw new z.ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'number',
              path: ['field'],
              message: 'Expected string, received number',
            },
          ]);
        }),
      } as any;
      registry.register(mockTool);

      const result = await registry.execute('validated_tool', { field: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('工具执行异常应返回错误', async () => {
      const mockTool = createMockTool('error_tool');
      mockTool.execute = vi.fn().mockRejectedValue(new Error('Execution failed'));
      registry.register(mockTool);

      const result = await registry.execute('error_tool', {});

      expect(result.success).toBe(false);
      expect(result.output).toBe('');
      expect(result.error).toContain('Execution failed');
    });

    it('工具执行抛出字符串应转换为错误', async () => {
      const mockTool = createMockTool('string_error_tool');
      mockTool.execute = vi.fn().mockRejectedValue('String error message');
      registry.register(mockTool);

      const result = await registry.execute('string_error_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error message');
    });

    it('应该序列化工具返回值', async () => {
      const mockTool = createMockTool('serialize_tool');
      mockTool.execute = vi.fn().mockResolvedValue({
        complex: { nested: { data: [1, 2, 3] } },
        array: [{ a: 1 }, { b: 2 }],
      });
      registry.register(mockTool);

      const result = await registry.execute('serialize_tool', {});

      expect(result.success).toBe(true);
      expect(result.output).toBe('{"complex":{"nested":{"data":[1,2,3]}},"array":[{"a":1},{"b":2}]}');
    });

    it('应该正确验证参数后再执行', async () => {
      const mockTool = createMockTool('validate_before_exec');
      const parseSpy = vi.fn().mockReturnValue({ validated: true });
      const executeSpy = vi.fn().mockResolvedValue({ result: 'ok' });

      mockTool.inputSchema = { parse: parseSpy } as any;
      mockTool.execute = executeSpy;

      registry.register(mockTool);

      const input = { test: 'value' };
      await registry.execute('validate_before_exec', input);

      expect(parseSpy).toHaveBeenCalledWith(input);
      expect(executeSpy).toHaveBeenCalledWith({ validated: true }, undefined);
    });
  });

  // ============================================================================
  // 并发执行
  // ============================================================================

  describe('并发执行', () => {
    it('应该支持并发执行不同工具', async () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');

      tool1.execute = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { tool: 1 };
      });

      tool2.execute = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return { tool: 2 };
      });

      registry.register(tool1);
      registry.register(tool2);

      const startTime = Date.now();
      const results = await Promise.all([
        registry.execute('tool1', {}),
        registry.execute('tool2', {}),
      ]);
      const duration = Date.now() - startTime;

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      // 并发执行应该比串行快（50ms vs 80ms）
      expect(duration).toBeLessThan(80);
    });

    it('应该支持同一工具的并发调用', async () => {
      const tool = createMockTool('concurrent_tool');
      let callCount = 0;

      tool.execute = vi.fn(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return { call: callCount };
      });

      registry.register(tool);

      const results = await Promise.all([
        registry.execute('concurrent_tool', { id: 1 }),
        registry.execute('concurrent_tool', { id: 2 }),
        registry.execute('concurrent_tool', { id: 3 }),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  // ============================================================================
  // 边界情况
  // ============================================================================

  describe('边界情况', () => {
    it('应该处理空参数输入', async () => {
      const mockTool = createMockTool('empty_params');
      mockTool.execute = vi.fn().mockResolvedValue({ received: 'empty' });
      registry.register(mockTool);

      const result = await registry.execute('empty_params', {});

      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledWith({}, undefined);
    });

    it('应该处理 null 和 undefined 参数', async () => {
      const mockTool = createMockTool('null_undefined');
      mockTool.execute = vi.fn().mockResolvedValue({});
      registry.register(mockTool);

      await registry.execute('null_undefined', null as any);
      await registry.execute('null_undefined', undefined as any);

      expect(mockTool.execute).toHaveBeenCalledTimes(2);
    });

    it('应该处理返回 undefined 的工具', async () => {
      const mockTool = createMockTool('undefined_return');
      mockTool.execute = vi.fn().mockResolvedValue(undefined);
      registry.register(mockTool);

      const result = await registry.execute('undefined_return', {});

      expect(result.success).toBe(true);
      expect(result.output).toBe('');
    });

    it('应该处理返回 null 的工具', async () => {
      const mockTool = createMockTool('null_return');
      mockTool.execute = vi.fn().mockResolvedValue(null);
      registry.register(mockTool);

      const result = await registry.execute('null_return', {});

      expect(result.success).toBe(true);
      expect(result.output).toBe('null');
    });
  });
});

/**
 * 创建 Mock 工具的辅助函数
 */
function createMockTool(name: string, description = `Mock tool ${name}`): BaseTool {
  return {
    name,
    description,
    inputSchema: {
      parse: vi.fn((input: any) => input),
    } as any,
    getDefinition: vi.fn().mockReturnValue({
      name,
      description,
      inputSchema: { type: 'object' },
    }),
    getOpenAIFunction: vi.fn().mockReturnValue({
      type: 'function',
      function: {
        name,
        description,
        parameters: { type: 'object' },
      },
    }),
    execute: vi.fn().mockResolvedValue({ result: 'ok' }),
  } as any;
}
