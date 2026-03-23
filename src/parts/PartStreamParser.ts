/**
 * Part Stream Parser - 无状态流式解析器
 *
 * 解析 OpenAI SDK 的 ChatCompletionChunk，返回统一的 ParseResult
 * 完全无状态，不维护任何解析上下文
 */

import OpenAI from 'openai';

/**
 * 解析结果（无状态的纯数据）
 */
export type ParseResult =
  | { type: 'reasoning-delta'; content: string }
  | { type: 'text-delta'; content: string }
  | {
      type: 'tool-call-delta';
      index: number;
      id?: string;
      name?: string;
      argDelta?: string;
    };

/**
 * Anthropic 扩展的 Delta（包含 reasoning 字段）
 */
interface AnthropicExtendedDelta
  extends OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta {
  reasoning?: string;
}

/**
 * Part 流式解析器（完全无状态）
 */
export class PartStreamParser {
  /**
   * 解析 OpenAI ChatCompletionChunk
   * 返回解析结果，不维护任何状态
   */
  parse(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): ParseResult[] {
    const results: ParseResult[] = [];
    const choice = chunk.choices[0];
    if (!choice) return results;

    const delta = choice.delta as AnthropicExtendedDelta;

    // 1. 处理 reasoning（Anthropic 扩展）
    if (delta.reasoning) {
      results.push({ type: 'reasoning-delta', content: delta.reasoning });
    }

    // 2. 处理文本
    if (delta.content) {
      results.push({ type: 'text-delta', content: delta.content });
    }

    // 3. 处理工具调用
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      for (const tc of delta.tool_calls) {
        results.push({
          type: 'tool-call-delta',
          index: tc.index,
          id: tc.id,
          name: tc.function?.name,
          argDelta: tc.function?.arguments,
        });
      }
    }

    return results;
  }
}
