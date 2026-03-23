/**
 * Message Formatter
 *
 * 负责在 Part 架构（内部）和 LLM API 格式（外部）之间转换
 */

import type { Message } from '../types/chat';
import type { Part, TextPart, ToolPart, ReasoningPart } from '../types/parts';

/**
 * OpenAI API 消息格式
 */
export interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text: string }>;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export class MessageFormatter {
  /**
   * 将内部 Message[] 转换为 OpenAI 格式
   */
  static toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map(msg => this.toOpenAIMessage(msg));
  }

  /**
   * 将单个 Message 转换为 OpenAI 格式
   */
  static toOpenAIMessage(message: Message): OpenAIMessage {
    const openaiMsg: OpenAIMessage = {
      role: message.role,
      content: this.extractContent(message),
    };

    // 处理工具调用（从 ToolPart 中提取）
    const toolParts = message.parts?.filter(p => p.type === 'tool') as ToolPart[];
    if (toolParts && toolParts.length > 0) {
      // 对于 assistant 消息，设置 tool_calls
      if (message.role === 'assistant') {
        openaiMsg.tool_calls = toolParts.map(part => ({
          id: part.callID,
          type: 'function' as const,
          function: {
            name: part.tool,
            arguments: JSON.stringify(part.state.input || {}),
          },
        }));
      }
      // 对于 tool 消息，设置 content 和 tool_call_id
      else if (message.role === 'tool') {
        const toolPart = toolParts[0]; // 取第一个工具部分
        openaiMsg.tool_call_id = toolPart.callID;
        // 工具结果根据状态类型获取
        let output = '';
        if (toolPart.state.status === 'completed') {
          output = toolPart.state.output;
        } else if (toolPart.state.status === 'error') {
          output = toolPart.state.error;
        }
        openaiMsg.content = output;
      }
    }

    return openaiMsg;
  }

  /**
   * 从 Message 中提取文本内容
   */
  static extractContent(message: Message): string {
    if (!message.parts || !Array.isArray(message.parts)) {
      return '';
    }

    // 提取所有 TextPart 的文本
    const textParts = message.parts.filter(p => p.type === 'text') as TextPart[];
    return textParts.map(p => p.text).join('');
  }

  /**
   * 从 Message 中提取推理内容
   */
  static extractReasoning(message: Message): string {
    if (!message.parts || !Array.isArray(message.parts)) {
      return '';
    }

    const reasoningParts = message.parts.filter(p => p.type === 'reasoning') as ReasoningPart[];
    return reasoningParts.map(p => p.text).join('');
  }

  /**
   * 将字符串内容转换为 TextPart[]
   */
  static createTextParts(content: string, sessionId: string, messageId: string): TextPart[] {
    return [{
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      sessionId,
      messageId,
      text: content,
      createdAt: Date.now(),
    }];
  }
}
