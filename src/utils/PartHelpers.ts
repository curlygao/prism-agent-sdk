/**
 * Part 辅助函数
 *
 * 从 src/utils/PartHelpers.ts 迁移
 * 简化版本，只包含 AgentLoop 使用的功能
 */

import type {
  ToolPart,
  ToolStateCompleted,
  ToolStateError,
} from '../types/parts';

/**
 * Part 辅助函数
 */
export const PartHelpers = {
  /**
   * 设置工具为完成状态
   */
  setToolCompleted(
    part: ToolPart,
    output: string,
    title: string,
    emitEvent = false
  ): ToolPart {
    const now = Date.now();
    const startTime = part.state.status === 'running' ? (part.state as any).time?.start : now;

    const state: ToolStateCompleted = {
      status: 'completed',
      input: part.state.input,
      output,
      title,
      time: { start: startTime || now, end: now },
    };
    part.state = state;

    return part;
  },

  /**
   * 设置工具为错误状态
   */
  setToolError(
    part: ToolPart,
    error: string,
    emitEvent = false
  ): ToolPart {
    const now = Date.now();
    const startTime = part.state.status === 'running' ? (part.state as any).time?.start : now;

    const state: ToolStateError = {
      status: 'error',
      input: part.state.input,
      error,
      time: { start: startTime || now, end: now },
    };
    part.state = state;

    return part;
  },
};
