/**
 * Mock 工厂函数
 * 用于创建测试所需的 mock 对象
 */

import { vi } from 'vitest';
import type { IStorageAPI, Message, ProjectMeta, StorageSessionMeta } from '../../storage/types';
import type { BaseProvider } from '../../providers/BaseProvider';
import type { ToolDefinition, ToolExecutionResult, ToolContext } from '../../types/tools';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { EventEmitter } from 'eventemitter3';
import type { AgentLoopEvents } from '../../agent/AgentLoop';
import type { ChatCompletionResponse } from '../../providers/BaseProvider';

/**
 * 创建 Mock Storage
 */
export function createMockStorage(config?: {
  sessions?: StorageSessionMeta[];
  messages?: Record<string, Message[]>;
  projects?: ProjectMeta[];
}): IStorageAPI {
  const storage: IStorageAPI = {
    // 项目管理
    getOrCreateProject: vi.fn().mockResolvedValue({
      id: 'proj-1',
      path: '/test/project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    getProject: vi.fn().mockResolvedValue(null),
    updateProjectActivity: vi.fn().mockResolvedValue(undefined),

    // 会话管理
    listSessions: vi.fn().mockResolvedValue(config?.sessions || []),
    createSession: vi.fn().mockResolvedValue({
      id: 'sess-1',
      projectId: 'proj-1',
      title: 'Test Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    }),
    loadSession: vi.fn((sessionId: string) =>
      Promise.resolve(config?.messages?.[sessionId] || [])
    ),
    appendMessage: vi.fn().mockResolvedValue(undefined),
    appendMessages: vi.fn().mockResolvedValue(undefined),
    updateSessionMeta: vi.fn().mockResolvedValue(undefined),
    updateSessionMessages: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  };

  return storage as any;
}

/**
 * 创建 Mock Provider
 */
export function createMockProvider(config?: {
  content?: string;
  toolCalls?: any[];
  reasoning?: string;
  streamChunks?: Array<string | any>;
  finishReason?: string;
}): BaseProvider {
  const mockProvider = {
    name: 'mock-provider',
    apiBase: 'https://mock.api',
    apiKey: 'mock-key',
    supportsReasoning: false,

    chat: vi.fn().mockResolvedValue({
      content: config?.content || 'Mock response',
      toolCalls: config?.toolCalls || [],
      reasoning: config?.reasoning,
      finishReason: config?.finishReason || 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    } as ChatCompletionResponse),

    async *chatStream() {
      const chunks = config?.streamChunks || [config?.content || 'Mock response'];
      for (const chunk of chunks) {
        yield chunk;
      }
      return {
        content: config?.content || 'Mock response',
        toolCalls: config?.toolCalls || [],
        finishReason: config?.finishReason || 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      } as ChatCompletionResponse;
    },

    validateConfig: vi.fn().mockReturnValue(true),
  };

  return mockProvider as any;
}

/**
 * 创建 Mock ToolRegistry
 */
export function createMockToolRegistry(config?: {
  tools?: Record<string, any>;
}): ToolRegistry {
  const registry = new ToolRegistry();

  // 添加一个简单的 mock 工具
  const mockTool = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      parse: vi.fn((input: any) => input),
    },
    getDefinition: vi.fn().mockReturnValue({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
    }),
    getOpenAIFunction: vi.fn().mockReturnValue({
      type: 'function',
      function: {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object' },
      },
    }),
    execute: vi.fn().mockResolvedValue({ result: 'success' }),
  };

  registry.register(mockTool as any);

  // 添加额外的工具
  if (config?.tools) {
    for (const [name, tool] of Object.entries(config.tools)) {
      registry.register(tool as any);
    }
  }

  return registry;
}

/**
 * 创建测试用的 AgentContext
 */
export function createTestAgentContext(overrides?: Partial<any>): any {
  return {
    sessionId: 'test-session',
    currentMessage: 'Hello, world!',
    workspace: '/test/workspace',
    history: [],
    ...overrides,
  };
}

/**
 * 创建测试用的 Message
 */
export function createTestMessage(overrides?: Partial<Message>): Message {
  const messageId = 'msg-' + Date.now();
  return {
    id: messageId,
    role: 'user',
    parts: [{
      type: 'text',
      text: 'Test message',
      id: 'text-' + Date.now(),
      sessionId: 'test-session',
      messageId,
      createdAt: Date.now(),
    }],
    timestamp: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * 创建测试事件监听器
 */
export function createTestEventCollector<T extends Record<string, any>>() {
  const events: Array<{ event: keyof T; data: any }> = [];

  const handler = <K extends keyof T>(event: K) => {
    return (data: any) => {
      events.push({ event, data });
    };
  };

  const getEvents = (event?: keyof T) => {
    if (event) {
      return events.filter(e => e.event === event);
    }
    return events;
  };

  const clearEvents = () => {
    events.length = 0;
  };

  const getLastEvent = (event: keyof T) => {
    const filtered = getEvents(event);
    return filtered[filtered.length - 1];
  };

  const waitForEvent = (event: keyof T, timeout = 1000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const existing = getEvents(event);
      if (existing.length > 0) {
        resolve(existing[existing.length - 1].data);
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${String(event)}`));
      }, timeout);

      // 注意：这需要在实际使用时配合 EventEmitter
      (handler as any)._waitForResolve = (data: any) => {
        clearTimeout(timer);
        resolve(data);
      };
    });
  };

  return {
    events,
    handler,
    getEvents,
    clearEvents,
    getLastEvent,
    waitForEvent,
  };
}

/**
 * 等待异步操作完成
 */
export async function waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * 创建流式响应的 mock chunks
 */
export function createMockStreamChunks(config: {
  textContent?: string[];
  toolCalls?: Array<{ id: string; name: string; args: Record<string, any> }>;
  reasoning?: string[];
}): Array<string | any> {
  const chunks: Array<string | any> = [];

  // 文本内容 chunks
  if (config.textContent) {
    for (const text of config.textContent) {
      chunks.push(text);
    }
  }

  // 工具调用
  if (config.toolCalls) {
    chunks.push({
      toolCalls: config.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      })),
    });
  }

  // Reasoning 内容
  if (config.reasoning) {
    for (const reasoning of config.reasoning) {
      chunks.push({ reasoning });
    }
  }

  // 最后的 finish 状态
  chunks.push({
    finishReason: config.toolCalls && config.toolCalls.length > 0 ? 'tool-calls' : 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  });

  return chunks;
}

/**
 * 创建延迟的 promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
