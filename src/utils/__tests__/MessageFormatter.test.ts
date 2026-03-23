import { describe, it, expect } from 'vitest';
import { MessageFormatter } from '../MessageFormatter';
import type { Message } from '../../../lib/types';

describe('MessageFormatter', () => {
  describe('extractContent', () => {
    it('应该从 TextPart 中提取文本内容', () => {
      const message: Message = {
        id: 'msg1',
        role: 'user',
        parts: [{
          id: 'part1',
          type: 'text',
          sessionId: 'session1',
          messageId: 'msg1',
          text: 'Hello, world!',
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const content = MessageFormatter.extractContent(message);
      expect(content).toBe('Hello, world!');
    });

    it('应该合并多个 TextPart 的内容', () => {
      const message: Message = {
        id: 'msg1',
        role: 'user',
        parts: [
          {
            id: 'part1',
            type: 'text',
            sessionId: 'session1',
            messageId: 'msg1',
            text: 'Hello, ',
            createdAt: Date.now(),
          },
          {
            id: 'part2',
            type: 'text',
            sessionId: 'session1',
            messageId: 'msg1',
            text: 'world!',
            createdAt: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };

      const content = MessageFormatter.extractContent(message);
      expect(content).toBe('Hello, world!');
    });

    it('应该处理空的 parts 数组', () => {
      const message: Message = {
        id: 'msg1',
        role: 'user',
        parts: [],
        timestamp: Date.now(),
      };

      const content = MessageFormatter.extractContent(message);
      expect(content).toBe('');
    });

    it('应该处理 undefined 的 parts', () => {
      const message: Message = {
        id: 'msg1',
        role: 'user',
        parts: undefined as any,
        timestamp: Date.now(),
      };

      const content = MessageFormatter.extractContent(message);
      expect(content).toBe('');
    });

    it('应该忽略非 TextPart 的内容', () => {
      const message: Message = {
        id: 'msg1',
        role: 'user',
        parts: [
          {
            id: 'part1',
            type: 'tool',
            sessionId: 'session1',
            messageId: 'msg1',
            callID: 'call_123',
            tool: 'search',
            state: {
              status: 'pending',
              input: { query: 'test' },
              raw: '{"query":"test"}',
            },
            createdAt: Date.now(),
          },
          {
            id: 'part2',
            type: 'text',
            sessionId: 'session1',
            messageId: 'msg1',
            text: 'Text content',
            createdAt: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };

      const content = MessageFormatter.extractContent(message);
      expect(content).toBe('Text content');
    });
  });

  describe('extractReasoning', () => {
    it('应该从 ReasoningPart 中提取推理内容', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: [{
          id: 'part1',
          type: 'reasoning',
          sessionId: 'session1',
          messageId: 'msg1',
          text: 'This is my reasoning process.',
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const reasoning = MessageFormatter.extractReasoning(message);
      expect(reasoning).toBe('This is my reasoning process.');
    });

    it('应该合并多个 ReasoningPart 的内容', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: [
          {
            id: 'part1',
            type: 'reasoning',
            sessionId: 'session1',
            messageId: 'msg1',
            text: 'First part ',
            createdAt: Date.now(),
          },
          {
            id: 'part2',
            type: 'reasoning',
            sessionId: 'session1',
            messageId: 'msg1',
            text: 'of reasoning.',
            createdAt: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };

      const reasoning = MessageFormatter.extractReasoning(message);
      expect(reasoning).toBe('First part of reasoning.');
    });

    it('应该处理空的 parts 数组', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: [],
        timestamp: Date.now(),
      };

      const reasoning = MessageFormatter.extractReasoning(message);
      expect(reasoning).toBe('');
    });

    it('应该处理 undefined 的 parts', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: undefined as any,
        timestamp: Date.now(),
      };

      const reasoning = MessageFormatter.extractReasoning(message);
      expect(reasoning).toBe('');
    });
  });

  describe('toOpenAIMessage', () => {
    it('应该将 user 消息转换为 OpenAI 格式', () => {
      const message: Message = {
        id: 'msg1',
        role: 'user',
        parts: [{
          id: 'part1',
          type: 'text',
          sessionId: 'session1',
          messageId: 'msg1',
          text: 'Hello!',
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const openaiMsg = MessageFormatter.toOpenAIMessage(message);

      expect(openaiMsg).toEqual({
        role: 'user',
        content: 'Hello!',
      });
    });

    it('应该将 assistant 消息转换为 OpenAI 格式', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: [{
          id: 'part1',
          type: 'text',
          sessionId: 'session1',
          messageId: 'msg1',
          text: 'Hi there!',
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const openaiMsg = MessageFormatter.toOpenAIMessage(message);

      expect(openaiMsg).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('应该处理包含 ToolPart 的 assistant 消息', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: [{
          id: 'part1',
          type: 'tool',
          sessionId: 'session1',
          messageId: 'msg1',
          callID: 'call_123',
          tool: 'search',
          state: {
            status: 'pending',
            input: { query: 'test' },
            raw: '{"query":"test"}',
          },
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const openaiMsg = MessageFormatter.toOpenAIMessage(message);

      expect(openaiMsg.role).toBe('assistant');
      expect(openaiMsg.tool_calls).toEqual([{
        id: 'call_123',
        type: 'function',
        function: {
          name: 'search',
          arguments: '{"query":"test"}',
        },
      }]);
    });

    it('应该处理多个 ToolPart', () => {
      const message: Message = {
        id: 'msg1',
        role: 'assistant',
        parts: [
          {
            id: 'part1',
            type: 'tool',
            sessionId: 'session1',
            messageId: 'msg1',
            callID: 'call_123',
            tool: 'search',
            state: {
              status: 'pending',
              input: { query: 'test' },
              raw: '{"query":"test"}',
            },
            createdAt: Date.now(),
          },
          {
            id: 'part2',
            type: 'tool',
            sessionId: 'session1',
            messageId: 'msg1',
            callID: 'call_456',
            tool: 'calculate',
            state: {
              status: 'pending',
              input: { expression: '1+1' },
              raw: '{"expression":"1+1"}',
            },
            createdAt: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };

      const openaiMsg = MessageFormatter.toOpenAIMessage(message);

      expect(openaiMsg.tool_calls).toHaveLength(2);
      expect(openaiMsg.tool_calls).toEqual([
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'search',
            arguments: '{"query":"test"}',
          },
        },
        {
          id: 'call_456',
          type: 'function',
          function: {
            name: 'calculate',
            arguments: '{"expression":"1+1"}',
          },
        },
      ]);
    });

    it('应该处理 tool 角色的消息', () => {
      const message: Message = {
        id: 'msg1',
        role: 'tool',
        parts: [{
          id: 'part1',
          type: 'tool',
          sessionId: 'session1',
          messageId: 'msg1',
          callID: 'call_123',
          tool: 'search',
          state: {
            status: 'completed',
            output: 'Tool result',
            raw: 'Tool result',
          },
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const openaiMsg = MessageFormatter.toOpenAIMessage(message);

      expect(openaiMsg.role).toBe('tool');
      expect(openaiMsg.content).toBe('Tool result');
      expect(openaiMsg.tool_call_id).toBe('call_123');
    });

    it('应该处理没有 tool_call_id 的 tool 消息', () => {
      const message: Message = {
        id: 'msg1',
        role: 'tool',
        parts: [{
          id: 'part1',
          type: 'text',
          sessionId: 'session1',
          messageId: 'msg1',
          text: 'Tool result',
          createdAt: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const openaiMsg = MessageFormatter.toOpenAIMessage(message);

      expect(openaiMsg.role).toBe('tool');
      expect(openaiMsg.content).toBe('Tool result');
      expect(openaiMsg.tool_call_id).toBeUndefined();
    });
  });

  describe('toOpenAIMessages', () => {
    it('应该转换多个消息为 OpenAI 格式', () => {
      const messages: Message[] = [
        {
          id: 'msg1',
          role: 'user',
          parts: [{
            id: 'part1',
            type: 'text',
            sessionId: 'session1',
            messageId: 'msg1',
            text: 'Hello!',
            createdAt: Date.now(),
          }],
          timestamp: Date.now(),
        },
        {
          id: 'msg2',
          role: 'assistant',
          parts: [{
            id: 'part2',
            type: 'text',
            sessionId: 'session1',
            messageId: 'msg2',
            text: 'Hi there!',
            createdAt: Date.now(),
          }],
          timestamp: Date.now(),
        },
      ];

      const openaiMessages = MessageFormatter.toOpenAIMessages(messages);

      expect(openaiMessages).toHaveLength(2);
      expect(openaiMessages[0]).toEqual({
        role: 'user',
        content: 'Hello!',
      });
      expect(openaiMessages[1]).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('应该处理空消息数组', () => {
      const openaiMessages = MessageFormatter.toOpenAIMessages([]);
      expect(openaiMessages).toEqual([]);
    });
  });

  describe('createTextParts', () => {
    it('应该创建包含 TextPart 的数组', () => {
      const parts = MessageFormatter.createTextParts(
        'Test content',
        'session1',
        'msg1'
      );

      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('text');
      expect(parts[0].text).toBe('Test content');
      expect(parts[0].sessionId).toBe('session1');
      expect(parts[0].messageId).toBe('msg1');
    });

    it('应该为每个 TextPart 生成唯一 ID', () => {
      const parts1 = MessageFormatter.createTextParts('Content 1', 'session1', 'msg1');
      const parts2 = MessageFormatter.createTextParts('Content 2', 'session1', 'msg1');

      expect(parts1[0].id).not.toBe(parts2[0].id);
    });

    it('应该设置 createdAt 时间戳', () => {
      const beforeTime = Date.now();
      const parts = MessageFormatter.createTextParts('Test', 'session1', 'msg1');
      const afterTime = Date.now();

      expect(parts[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(parts[0].createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('应该处理空字符串', () => {
      const parts = MessageFormatter.createTextParts('', 'session1', 'msg1');

      expect(parts).toHaveLength(1);
      expect(parts[0].text).toBe('');
    });

    it('应该处理多行文本', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const parts = MessageFormatter.createTextParts(multilineText, 'session1', 'msg1');

      expect(parts[0].text).toBe(multilineText);
    });
  });
});
