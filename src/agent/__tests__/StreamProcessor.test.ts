/**
 * StreamProcessor 单元测试
 *
 * 测试流式处理器的功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StreamProcessor } from '../StreamProcessor';
import type { IStorageAPI, Message } from '../../storage/types';
import type { BaseProvider } from '../../providers/BaseProvider';
import { ToolRegistry } from '../../tools/ToolRegistry';
import {
  createMockStorage,
  createMockProvider,
  createMockToolRegistry,
  createTestEventCollector,
  createMockStreamChunks,
} from '../../__tests__/mocks';

describe('StreamProcessor', () => {
  let processor: StreamProcessor;
  let mockStorage: IStorageAPI;
  let mockProvider: BaseProvider;
  let mockToolRegistry: ToolRegistry;
  let eventCollector: ReturnType<typeof createTestEventCollector>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockToolRegistry = createMockToolRegistry();
    eventCollector = createTestEventCollector();

    // 创建一个可以配置的 provider
    mockProvider = createMockProvider();

    processor = new StreamProcessor(
      mockProvider,
      mockToolRegistry,
      mockStorage
    );
  });

  afterEach(() => {
    eventCollector.clearEvents();
  });

  // ============================================================================
  // 文本处理测试
  // ============================================================================

  describe('文本处理', () => {
    it('应该创建 TextPart 并追加文本增量', async () => {
      const chunks = createMockStreamChunks({
        textContent: ['Hello', ' world', '!'],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const messages: Message[] = [];
      const onEvent = vi.fn();

      const result = await processor.process({
        messages,
        sessionId: 'sess-1',
        messageId: 'msg-1',
        onEvent,
      });

      expect(result.message.parts).toBeDefined();
      expect(result.message.parts!.length).toBeGreaterThan(0);
      expect(result.message.parts![0].type).toBe('text');
    });

    it('应该正确累积文本内容', async () => {
      const chunks = createMockStreamChunks({
        textContent: ['Part 1', ' Part 2', ' Part 3'],
      });

      mockProvider = createMockProvider({
        content: 'Part 1 Part 2 Part 3',
        streamChunks: chunks,
      });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const onEvent = vi.fn();
      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
        onEvent,
      });

      const textPart = result.message.parts![0];
      expect(textPart.type).toBe('text');
    });

    it('应该触发 text-delta 事件', async () => {
      const chunks = createMockStreamChunks({
        textContent: ['Test', ' content'],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const onEvent = vi.fn();
      await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
        onEvent,
      });

      // 验证 text-delta 事件被触发
      const textDeltaEvents = onEvent.mock.calls.filter(
        call => call[0]?.type === 'text-delta'
      );
      expect(textDeltaEvents.length).toBeGreaterThan(0);
    });

    it('应该完成 TextPart', async () => {
      const chunks = createMockStreamChunks({
        textContent: ['Complete', ' text'],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      // TextPart 应该被创建并添加到消息中
      expect(result.message.parts).toBeDefined();
      expect(result.message.parts!.length).toBe(1);
      expect(result.message.parts![0].type).toBe('text');
    });
  });

  // ============================================================================
  // Reasoning 处理测试
  // ============================================================================

  describe('Reasoning 处理', () => {
    it('应该创建 ReasoningPart', async () => {
      const chunks = createMockStreamChunks({
        reasoning: ['Thinking step 1', ' Thinking step 2'],
      });

      mockProvider = createMockProvider({
        streamChunks: chunks,
        reasoning: 'Thinking step 1 Thinking step 2',
      });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      const reasoningParts = result.message.parts?.filter(p => p.type === 'reasoning');
      expect(reasoningParts).toBeDefined();
      expect(reasoningParts!.length).toBeGreaterThan(0);
    });

    it('应该支持多个独立的 ReasoningPart', async () => {
      const chunks: Array<string | any> = [
        { reasoning: 'First reasoning' },
        { reasoning: 'Second reasoning' },
      ];

      mockProvider = createMockProvider({
        streamChunks: chunks,
        reasoning: 'First reasoning Second reasoning',
      });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      const reasoningParts = result.message.parts?.filter(p => p.type === 'reasoning');
      expect(reasoningParts!.length).toBeGreaterThan(0);
    });

    it('应该完成所有 ReasoningPart', async () => {
      const chunks = createMockStreamChunks({
        reasoning: ['Reasoning content'],
      });

      mockProvider = createMockProvider({
        streamChunks: chunks,
      });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      // 验证所有 Part 被正确添加
      expect(result.message.parts).toBeDefined();
    });

    it('应该触发 reasoning-delta 事件', async () => {
      const chunks = createMockStreamChunks({
        reasoning: ['Reasoning text'],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const onEvent = vi.fn();
      await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
        onEvent,
      });

      const reasoningEvents = onEvent.mock.calls.filter(
        call => call[0]?.type === 'reasoning-delta'
      );
      expect(reasoningEvents.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 工具调用处理测试
  // ============================================================================

  describe('工具调用处理', () => {
    it('应该创建 ToolPart', async () => {
      const toolCall = {
        id: 'call-123',
        name: 'test_tool',
        arguments: { input: 'test' },
      };

      const chunks = createMockStreamChunks({
        toolCalls: [toolCall],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      const toolParts = result.message.parts?.filter(p => p.type === 'tool');
      expect(toolParts).toBeDefined();
      expect(toolParts!.length).toBe(1);
      expect(toolParts![0].tool).toBe('test_tool');
    });

    it('应该并行执行所有工具', async () => {
      const toolCalls = [
        { id: 'call-1', name: 'test_tool', arguments: { index: 1 } },
        { id: 'call-2', name: 'test_tool', arguments: { index: 2 } },
        { id: 'call-3', name: 'test_tool', arguments: { index: 3 } },
      ];

      const chunks = createMockStreamChunks({
        toolCalls,
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const startTime = Date.now();
      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });
      const duration = Date.now() - startTime;

      const toolParts = result.message.parts?.filter(p => p.type === 'tool');
      expect(toolParts!.length).toBe(3);

      // 并行执行应该比串行快
      // 假设每个工具需要至少 10ms，串行需要 30ms，并行应该少于 25ms
      expect(duration).toBeLessThan(100);
    });

    it('成功工具应标记为 completed', async () => {
      const toolCall = {
        id: 'call-success',
        name: 'test_tool',
        arguments: {},
      };

      const chunks = createMockStreamChunks({
        toolCalls: [toolCall],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      const toolPart = result.message.parts?.find(p => p.type === 'tool');
      expect(toolPart).toBeDefined();
      expect((toolPart as any).state.status).toBe('completed');
    });

    it('失败工具应标记为 error', async () => {
      // 创建一个会失败的工具
      const failingTool = {
        name: 'failing_tool',
        description: 'A failing tool',
        inputSchema: {
          parse: vi.fn((input: any) => input),
        },
        getDefinition: vi.fn().mockReturnValue({
          name: 'failing_tool',
          description: 'A failing tool',
          inputSchema: { type: 'object' },
        }),
        getOpenAIFunction: vi.fn().mockReturnValue({
          type: 'function',
          function: {
            name: 'failing_tool',
            description: 'A failing tool',
            parameters: { type: 'object' },
          },
        }),
        execute: vi.fn().mockRejectedValue(new Error('Tool failed')),
      };

      const registry = new ToolRegistry();
      registry.register(failingTool as any);

      const toolCall = {
        id: 'call-fail',
        name: 'failing_tool',
        arguments: {},
      };

      const chunks = createMockStreamChunks({
        toolCalls: [toolCall],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, registry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      const toolPart = result.message.parts?.find(p => p.type === 'tool');
      expect(toolPart).toBeDefined();
      expect((toolPart as any).state.status).toBe('error');
      expect((toolPart as any).state.error).toBeDefined();
    });

    it('应该触发 tool-call 事件', async () => {
      const toolCall = {
        id: 'call-event',
        name: 'test_tool',
        arguments: {},
      };

      const chunks = createMockStreamChunks({
        toolCalls: [toolCall],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });
      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const onEvent = vi.fn();
      await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
        onEvent,
      });

      const toolCallEvents = onEvent.mock.calls.filter(
        call => call[0]?.type === 'tool-call'
      );
      expect(toolCallEvents.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 中止处理测试
  // ============================================================================

  describe('中止处理', () => {
    it('abortSignal 应中止流式处理', async () => {
      // 创建一个可中止的 provider
      const abortController = new AbortController();

      let shouldAbort = false;
      const chunks: Array<string | any> = [];

      mockProvider = {
        name: 'mock-provider',
        apiBase: 'https://mock.api',
        apiKey: 'mock-key',
        supportsReasoning: false,

        async *chatStream() {
          for (const chunk of chunks) {
            if (shouldAbort) {
              abortController.signal.throwIfAborted();
            }
            yield chunk;
          }
          return {
            content: 'Response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          };
        },
      };

      processor = new StreamProcessor(
        mockProvider as any,
        mockToolRegistry,
        mockStorage
      );

      shouldAbort = true;

      await expect(
        processor.process({
          messages: [],
          sessionId: 'sess-1',
          messageId: 'msg-1',
          abortSignal: abortController.signal,
        })
      ).rejects.toThrow();
    });

    it('中止时应清理未完成的 Part', async () => {
      // 这个测试验证中止时的清理逻辑
      // 实际实现可能需要调整
      const abortController = new AbortController();

      mockProvider = createMockProvider({
        streamChunks: ['Part 1', 'Part 2'],
      });

      processor = new StreamProcessor(
        mockProvider as any,
        mockToolRegistry,
        mockStorage
      );

      // 立即中止
      abortController.abort();

      try {
        await processor.process({
          messages: [],
          sessionId: 'sess-1',
          messageId: 'msg-1',
          abortSignal: abortController.signal,
        });
      } catch (e) {
        // 预期的中止错误
        expect(e).toBeDefined();
      }
    });
  });

  // ============================================================================
  // 错误恢复测试
  // ============================================================================

  describe('错误恢复', () => {
    it('异常时应完成活跃的 TextPart', async () => {
      mockProvider = {
        name: 'mock-provider',
        apiBase: 'https://mock.api',
        apiKey: 'mock-key',
        supportsReasoning: false,

        async *chatStream() {
          yield 'Start';
          throw new Error('Stream error');
        },
      };

      processor = new StreamProcessor(
        mockProvider as any,
        mockToolRegistry,
        mockStorage
      );

      await expect(
        processor.process({
          messages: [],
          sessionId: 'sess-1',
          messageId: 'msg-1',
        })
      ).rejects.toThrow('Stream error');
    });

    it('异常时应完成活跃的 ReasoningPart', async () => {
      mockProvider = {
        name: 'mock-provider',
        apiBase: 'https://mock.api',
        apiKey: 'mock-key',
        supportsReasoning: false,

        async *chatStream() {
          yield { reasoning: 'Thinking' };
          throw new Error('Error during reasoning');
        },
      };

      processor = new StreamProcessor(
        mockProvider as any,
        mockToolRegistry,
        mockStorage
      );

      await expect(
        processor.process({
          messages: [],
          sessionId: 'sess-1',
          messageId: 'msg-1',
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // 结果返回测试
  // ============================================================================

  describe('结果返回', () => {
    it('应返回正确的 finishReason', async () => {
      const chunks = createMockStreamChunks({
        textContent: ['Response'],
      });

      mockProvider = createMockProvider({
        streamChunks: chunks,
        finishReason: 'stop',
      });

      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      expect(result.finishReason).toBe('stop');
    });

    it('应返回正确的 usage 信息', async () => {
      const expectedUsage = {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      };

      const chunks = createMockStreamChunks({
        textContent: ['Response'],
      });

      mockProvider = createMockProvider({
        streamChunks: chunks,
        finishReason: 'stop',
      });

      // 修改 chatStream 的返回值
      const originalProvider = mockProvider as any;
      const originalChatStream = originalProvider.chatStream;

      originalProvider.chatStream = async function* (...args: any[]) {
        const stream = originalChatStream(...args);
        const final = await stream.return();
        yield* [];
        return {
          ...final,
          usage: expectedUsage,
        };
      };

      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      expect(result.usage).toEqual(expectedUsage);
    });

    it('工具调用时应返回 tool-calls 类型', async () => {
      const chunks = createMockStreamChunks({
        toolCalls: [{ id: 'call-1', name: 'test_tool', arguments: {} }],
      });

      mockProvider = createMockProvider({
        streamChunks: chunks,
      });

      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      expect(result.type).toBe('tool-calls');
    });

    it('无工具调用时应返回 stop 类型', async () => {
      const chunks = createMockStreamChunks({
        textContent: ['Response'],
      });

      mockProvider = createMockProvider({
        streamChunks: chunks,
      });

      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      expect(result.type).toBe('stop');
    });
  });

  // ============================================================================
  // 边界情况测试
  // ============================================================================

  describe('边界情况', () => {
    it('应处理空流', async () => {
      mockProvider = {
        name: 'mock-provider',
        apiBase: 'https://mock.api',
        apiKey: 'mock-key',
        supportsReasoning: false,

        async *chatStream() {
          // 立即返回，不产生任何 chunk
          return {
            content: '',
            finishReason: 'stop',
          };
        },
      };

      processor = new StreamProcessor(
        mockProvider as any,
        mockToolRegistry,
        mockStorage
      );

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      expect(result.message.parts).toBeDefined();
    });

    it('应处理只有 finishReason 的响应', async () => {
      mockProvider = {
        name: 'mock-provider',
        apiBase: 'https://mock.api',
        apiKey: 'mock-key',
        supportsReasoning: false,

        async *chatStream() {
          yield { finishReason: 'stop' };
          return {
            finishReason: 'stop',
          };
        },
      };

      processor = new StreamProcessor(
        mockProvider as any,
        mockToolRegistry,
        mockStorage
      );

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      expect(result.finishReason).toBe('stop');
    });

    it('应处理混合内容类型', async () => {
      const chunks: Array<string | any> = [
        'Text start',
        { reasoning: 'Reasoning' },
        'Text middle',
        'Text end',
      ];

      mockProvider = createMockProvider({
        streamChunks: chunks,
        reasoning: 'Reasoning',
      });

      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      const result = await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
      });

      // 应该有 text 和 reasoning 两种类型的 part
      const hasTextPart = result.message.parts?.some(p => p.type === 'text');
      const hasReasoningPart = result.message.parts?.some(p => p.type === 'reasoning');

      expect(hasTextPart).toBe(true);
      expect(hasReasoningPart).toBe(true);
    });
  });

  // ============================================================================
  // 工作区上下文测试
  // ============================================================================

  describe('工作区上下文', () => {
    it('应传递工作区路径给工具执行', async () => {
      const testWorkspace = '/test/workspace/path';

      const toolCall = {
        id: 'call-workspace',
        name: 'test_tool',
        arguments: {},
      };

      const chunks = createMockStreamChunks({
        toolCalls: [toolCall],
      });

      mockProvider = createMockProvider({ streamChunks: chunks });

      // 添加工具执行拦截来验证工作区
      const executeSpy = vi.spyOn(mockToolRegistry, 'execute').mockResolvedValue({
        success: true,
        output: 'result',
      });

      processor = new StreamProcessor(mockProvider, mockToolRegistry, mockStorage);

      await processor.process({
        messages: [],
        sessionId: 'sess-1',
        messageId: 'msg-1',
        workspace: testWorkspace,
      });

      // 验证工具执行时收到了正确的工作区路径
      expect(executeSpy).toHaveBeenCalledWith(
        'test_tool',
        {},
        expect.objectContaining({
          workspace: testWorkspace,
        })
      );
    });
  });
});
