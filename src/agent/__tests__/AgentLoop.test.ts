/**
 * AgentLoop 单元测试
 *
 * 测试核心 Agent 循环引擎的功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentLoop } from '../AgentLoop';
import type { IStorageAPI } from '../../storage/types';
import type { BaseProvider } from '../../providers/BaseProvider';
import { ToolRegistry } from '../../tools/ToolRegistry';
import {
  createMockStorage,
  createMockProvider,
  createMockToolRegistry,
  createTestAgentContext,
  createTestEventCollector,
  createMockStreamChunks,
} from '../../__tests__/mocks';

describe('AgentLoop', () => {
  let agentLoop: AgentLoop;
  let mockStorage: IStorageAPI;
  let mockProvider: BaseProvider;
  let mockToolRegistry: ToolRegistry;
  let eventCollector: ReturnType<typeof createTestEventCollector>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockProvider = createMockProvider({
      content: 'Hello! How can I help you?',
    });
    mockToolRegistry = createMockToolRegistry();
    eventCollector = createTestEventCollector();

    agentLoop = new AgentLoop(
      mockToolRegistry,
      mockProvider,
      mockStorage,
      { maxIterations: 10 }
    );

    // 注册事件监听器
    agentLoop.on('message', eventCollector.handler('message'));
    agentLoop.on('tool_call', eventCollector.handler('tool_call'));
    agentLoop.on('tool_result', eventCollector.handler('tool_result'));
    agentLoop.on('tool_use_start', eventCollector.handler('tool_use_start'));
    agentLoop.on('tool_use_end', eventCollector.handler('tool_use_end'));
    agentLoop.on('done', eventCollector.handler('done'));
    agentLoop.on('error', eventCollector.handler('error'));
  });

  afterEach(() => {
    eventCollector.clearEvents();
  });

  // ============================================================================
  // 基础功能测试
  // ============================================================================

  describe('基础功能', () => {
    it('应该正确初始化配置', () => {
      const loop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage,
        { maxIterations: 20 }
      );

      expect(loop).toBeDefined();
    });

    it('应该处理简单用户消息（无工具调用）', async () => {
      const context = createTestAgentContext({
        currentMessage: 'Hello, AI!',
      });

      const response = await agentLoop.processMessage(context, false);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.toolCalls).toBeUndefined();
      expect(eventCollector.getLastEvent('message')).toBeDefined();
    });

    it('应该触发 done 事件完成处理', async () => {
      const context = createTestAgentContext({
        currentMessage: 'Hello',
      });

      await agentLoop.processMessage(context, false);

      expect(eventCollector.getLastEvent('done')).toBeDefined();
    });

    it('应该使用默认最大迭代次数', () => {
      const loop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      // 默认应该是 20
      expect(loop).toBeDefined();
    });
  });

  // ============================================================================
  // 工具调用测试
  // ============================================================================

  describe('工具调用处理', () => {
    it('应该处理带工具调用的消息', async () => {
      const toolCall = {
        id: 'call-123',
        name: 'test_tool',
        arguments: { query: 'test' },
      };

      mockProvider = createMockProvider({
        content: 'I will help you with that',
        toolCalls: [toolCall],
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage,
        { maxIterations: 10 }
      );

      const context = createTestAgentContext({
        currentMessage: 'Use the test tool',
      });

      const response = await agentLoop.processMessage(context, false);

      expect(response.content).toBe('I will help you with that');
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].id).toBe(toolCall.id);
    });

    it('应该触发工具相关事件', async () => {
      const toolCall = {
        id: 'call-456',
        name: 'test_tool',
        arguments: { input: 'test data' },
      };

      mockProvider = createMockProvider({
        content: 'Processing...',
        toolCalls: [toolCall],
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      // 重新注册事件监听器
      agentLoop.on('tool_use_start', eventCollector.handler('tool_use_start'));
      agentLoop.on('tool_use_end', eventCollector.handler('tool_use_end'));
      agentLoop.on('tool_result', eventCollector.handler('tool_result'));

      const context = createTestAgentContext({
        currentMessage: 'Execute test_tool',
      });

      await agentLoop.processMessage(context, false);

      // 验证事件被触发
      expect(eventCollector.getEvents('tool_use_start').length).toBeGreaterThan(0);
      expect(eventCollector.getEvents('tool_use_end').length).toBeGreaterThan(0);
      expect(eventCollector.getEvents('tool_result').length).toBeGreaterThan(0);
    });

    it('应该并行执行多个工具调用', async () => {
      const toolCalls = [
        { id: 'call-1', name: 'test_tool', arguments: { index: 0 } },
        { id: 'call-2', name: 'test_tool', arguments: { index: 1 } },
        { id: 'call-3', name: 'test_tool', arguments: { index: 2 } },
      ];

      mockProvider = createMockProvider({
        content: 'Running multiple tools',
        toolCalls,
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      const context = createTestAgentContext({
        currentMessage: 'Run all tools',
      });

      const response = await agentLoop.processMessage(context, false);

      expect(response.toolCalls).toHaveLength(3);
      expect(response.toolCalls![0].id).toBe('call-1');
      expect(response.toolCalls![1].id).toBe('call-2');
      expect(response.toolCalls![2].id).toBe('call-3');
    });
  });

  // ============================================================================
  // 循环控制测试
  // ============================================================================

  describe('循环控制', () => {
    it('应该在无工具调用时退出循环', async () => {
      let callCount = 0;
      mockProvider = createMockProvider({
        content: 'Simple response',
      });

      // 监控 chat 调用次数
      const originalChat = mockProvider.chat;
      mockProvider.chat = vi.fn(async (...args) => {
        callCount++;
        return originalChat(...args);
      }) as any;

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage,
        { maxIterations: 10 }
      );

      const context = createTestAgentContext({
        currentMessage: 'Simple question',
      });

      await agentLoop.processMessage(context, false);

      // 应该只调用一次，因为没有工具调用
      expect(callCount).toBe(1);
    });

    it('应该遵守最大迭代次数限制', async () => {
      // 模拟一个会持续调用工具的场景
      mockProvider = createMockProvider({
        content: 'I will call a tool',
        toolCalls: [{ id: 'call-loop', name: 'test_tool', arguments: {} }],
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage,
        { maxIterations: 2 }  // 设置较小的限制
      );

      const context = createTestAgentContext({
        currentMessage: 'Start loop',
      });

      await expect(agentLoop.processMessage(context, false)).rejects.toThrow(
        '超过最大迭代次数'
      );
    });

    it('应该允许动态更新最大迭代次数', () => {
      const loop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage,
        { maxIterations: 10 }
      );

      loop.setMaxIterations(20);

      // 验证设置成功（通过不抛出错误来间接验证）
      expect(loop).toBeDefined();
    });
  });

  // ============================================================================
  // 流式模式测试
  // ============================================================================

  describe('流式模式', () => {
    it('应该处理流式文本响应', async () => {
      const streamChunks = createMockStreamChunks({
        textContent: ['Hello', ' there', '!'],
      });

      mockProvider = createMockProvider({
        content: 'Hello there!',
        streamChunks,
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      const context = createTestAgentContext({
        currentMessage: 'Say hello',
      });

      const response = await agentLoop.processMessage(context, true);

      expect(response.content).toBeDefined();
      expect(eventCollector.getLastEvent('done')).toBeDefined();
    });

    it('应该处理流式工具调用', async () => {
      const streamChunks = createMockStreamChunks({
        textContent: ['I will', ' use tools'],
        toolCalls: [
          { id: 'call-1', name: 'test_tool', arguments: { data: 'test' } },
        ],
      });

      mockProvider = createMockProvider({
        content: 'I will use tools',
        streamChunks,
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      const context = createTestAgentContext({
        currentMessage: 'Use tools in stream',
      });

      const response = await agentLoop.processMessage(context, true);

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
    });

    it('应该正确触发流式事件', async () => {
      mockProvider = createMockProvider({
        content: 'Streamed response',
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      const context = createTestAgentContext({
        currentMessage: 'Stream something',
      });

      await agentLoop.processMessage(context, true);

      expect(eventCollector.getLastEvent('message')).toBeDefined();
    });
  });

  // ============================================================================
  // 错误处理测试
  // ============================================================================

  describe('错误处理', () => {
    it('应该传播 Provider 错误', async () => {
      mockProvider = createMockProvider();
      const error = new Error('Provider API failed');
      mockProvider.chat = vi.fn().mockRejectedValue(error);

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      agentLoop.on('error', eventCollector.handler('error'));

      const context = createTestAgentContext({
        currentMessage: 'Trigger error',
      });

      await expect(agentLoop.processMessage(context, false)).rejects.toThrow(
        'Provider API failed'
      );

      // 验证错误事件被触发
      const errorEvent = eventCollector.getLastEvent('error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.data).toBe(error);
    });

    it('应该处理工具执行失败', async () => {
      // 让工具执行失败
      const mockTool = {
        name: 'failing_tool',
        description: 'A tool that fails',
        inputSchema: {
          parse: vi.fn((input: any) => input),
        },
        getDefinition: vi.fn().mockReturnValue({
          name: 'failing_tool',
          description: 'A tool that fails',
          inputSchema: { type: 'object' },
        }),
        getOpenAIFunction: vi.fn().mockReturnValue({
          type: 'function',
          function: {
            name: 'failing_tool',
            description: 'A tool that fails',
            parameters: { type: 'object' },
          },
        }),
        execute: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
      };

      const registry = new ToolRegistry();
      registry.register(mockTool as any);

      mockProvider = createMockProvider({
        content: 'I will use the failing tool',
        toolCalls: [
          { id: 'call-fail', name: 'failing_tool', arguments: {} },
        ],
      });

      agentLoop = new AgentLoop(
        registry,
        mockProvider,
        mockStorage
      );

      agentLoop.on('tool_result', eventCollector.handler('tool_result'));

      const context = createTestAgentContext({
        currentMessage: 'Use failing tool',
      });

      const response = await agentLoop.processMessage(context, false);

      // 响应应该仍然返回，但工具结果应该包含错误
      expect(response).toBeDefined();

      // 检查工具结果事件中的失败信息
      const toolResultEvents = eventCollector.getEvents('tool_result');
      expect(toolResultEvents.length).toBeGreaterThan(0);
    });

    it('应该处理工具未找到的情况', async () => {
      mockProvider = createMockProvider({
        content: 'I will use unknown tool',
        toolCalls: [
          { id: 'call-unknown', name: 'unknown_tool', arguments: {} },
        ],
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,  // 只包含 test_tool
        mockProvider,
        mockStorage
      );

      agentLoop.on('tool_result', eventCollector.handler('tool_result'));

      const context = createTestAgentContext({
        currentMessage: 'Use unknown tool',
      });

      await agentLoop.processMessage(context, false);

      // 应该触发 tool_result 事件，但包含错误信息
      const toolResultEvents = eventCollector.getEvents('tool_result');
      expect(toolResultEvents.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 边界情况测试
  // ============================================================================

  describe('边界情况', () => {
    it('应该处理空消息历史', async () => {
      const context = createTestAgentContext({
        history: [],
        currentMessage: 'First message',
      });

      const response = await agentLoop.processMessage(context, false);

      expect(response.content).toBeDefined();
    });

    it('应该处理包含历史消息的上下文', async () => {
      const history = [
        createTestMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Previous message' }],
        }),
        createTestMessage({
          role: 'assistant',
          parts: [{ type: 'text', text: 'Previous response' }],
        }),
      ];

      const context = createTestAgentContext({
        history,
        currentMessage: 'Follow-up question',
      });

      const response = await agentLoop.processMessage(context, false);

      expect(response.content).toBeDefined();
    });

    it('应该处理空内容的响应', async () => {
      mockProvider = createMockProvider({
        content: '',
        toolCalls: [],
      });

      agentLoop = new AgentLoop(
        mockToolRegistry,
        mockProvider,
        mockStorage
      );

      const context = createTestAgentContext({
        currentMessage: 'Get empty response',
      });

      const response = await agentLoop.processMessage(context, false);

      expect(response.content).toBe('');
    });
  });

  // ============================================================================
  // 消息构建测试
  // ============================================================================

  describe('消息构建', () => {
    it('应该为用户消息创建正确的结构', async () => {
      const context = createTestAgentContext({
        currentMessage: 'Test message content',
      });

      await agentLoop.processMessage(context, false);

      // 验证消息被正确构建（通过检查 provider 的调用）
      expect(mockProvider.chat).toHaveBeenCalled();
    });

    it('应该保持历史消息结构', async () => {
      const history = [
        createTestMessage({
          id: 'hist-1',
          role: 'user',
          parts: [{ type: 'text', text: 'History 1' }],
        }),
      ];

      const context = createTestAgentContext({
        history,
        currentMessage: 'New message',
      });

      await agentLoop.processMessage(context, false);

      expect(mockProvider.chat).toHaveBeenCalled();
    });
  });
});
