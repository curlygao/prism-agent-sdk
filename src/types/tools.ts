/**
 * 工具相关类型定义
 *
 * 从 src/lib/types/tools.ts 迁移
 */

import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolContext {
  sessionId: string;
  workspace?: string;
}
