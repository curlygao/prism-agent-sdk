// packages/core/src/lib/types/agent.ts

/**
 * Agent 上下文
 */
export interface AgentContext {
  /** 会话ID */
  sessionId: string;
  /** 当前消息内容 */
  currentMessage: string;
  /** 会话历史 */
  history: Message[];
  /** 工作区路径 */
  workspace: string;
}

/**
 * 消息
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  timestamp: number;
}

/**
 * 消息部分
 */
export type MessagePart =
  | TextPart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart;

/**
 * 文本部分
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * 工具调用部分
 */
export interface ToolCallPart {
  type: 'tool_call';
  callID: string;
  tool: string;
  input: Record<string, unknown>;
}

/**
 * 工具结果部分
 */
export interface ToolResultPart {
  type: 'tool_result';
  callID: string;
  output: string;
  success: boolean;
  duration?: number;
}

/**
 * 推理部分
 */
export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}
