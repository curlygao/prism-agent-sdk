// packages/core/src/events/types.ts
// 事件类型定义

/**
 * 事件名称常量
 */
export const EventTypes = {
  // ========== 文本内容事件 ==========
  TEXT_START: 'text:start',
  TEXT_DELTA: 'text:delta',
  TEXT_DONE: 'text:done',

  // ========== 思考内容事件 ==========
  REASONING_START: 'reasoning:start',
  REASONING_DELTA: 'reasoning:delta',
  REASONING_DONE: 'reasoning:done',

  // ========== 工具调用 - 生成阶段 ==========
  TOOL_CALL_START: 'tool:call:start',
  TOOL_CALL_DONE: 'tool:call:done',
  TOOL_CALL_INTERRUPT: 'tool:call:interrupt',

  // ========== 工具调用 - 执行阶段 ==========
  TOOL_EXECUTE_START: 'tool:execute:start',
  TOOL_EXECUTE_DONE: 'tool:execute:done',
  TOOL_EXECUTE_ERROR: 'tool:execute:error',

  // ========== 会话事件 ==========
  SESSION_CREATED: 'session:created',
  SESSION_DELETED: 'session:deleted',
  SESSION_CLOSED: 'session:closed',

  // ========== Agent 事件 ==========
  AGENT_DONE: 'agent:done',
  AGENT_ERROR: 'agent:error',
} as const;

export type EventName = typeof EventTypes[keyof typeof EventTypes];

// ============================================================================
// 文本内容事件
// ============================================================================

/**
 * text:start - 开始生成文本
 */
export interface TextStartEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
}

/**
 * text:delta - 文本增量
 */
export interface TextDeltaEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 文本内容 */
  text: string;
}

/**
 * text:done - 文本生成完成
 */
export interface TextDoneEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
}

// ============================================================================
// 思考内容事件
// ============================================================================

/**
 * reasoning:start - 开始思考
 */
export interface ReasoningStartEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
}

/**
 * reasoning:delta - 思考增量
 */
export interface ReasoningDeltaEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 思考内容 */
  text: string;
}

/**
 * reasoning:done - 思考完成
 */
export interface ReasoningDoneEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
}

// ============================================================================
// 工具调用 - 生成阶段事件
// ============================================================================

/**
 * tool:call:start - LLM 开始生成工具调用
 */
export interface ToolCallStartEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
}

/**
 * tool:call:done - 工具调用参数完整
 */
export interface ToolCallDoneEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 工具调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  arguments: Record<string, any>;
}

/**
 * tool:call:interrupt - 工具调用生成被中断
 */
export interface ToolCallInterruptEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
}

// ============================================================================
// 工具调用 - 执行阶段事件
// ============================================================================

/**
 * tool:execute:start - 开始执行工具
 */
export interface ToolExecuteStartEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 工具调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  arguments: Record<string, any>;
}

/**
 * tool:execute:done - 工具执行完成
 */
export interface ToolExecuteDoneEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 工具调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 执行结果 */
  result: any;
  /** 执行时长（毫秒） */
  duration: number;
}

/**
 * tool:execute:error - 工具执行错误
 */
export interface ToolExecuteErrorEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 工具调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 错误信息 */
  error: string;
}

// ============================================================================
// 会话事件
// ============================================================================

/**
 * session:created - 会话创建成功
 */
export interface SessionCreatedEvent {
  sessionId: string;
  title: string;
  projectId: string;
  createdAt: number;
}

/**
 * session:deleted - 会话删除成功
 */
export interface SessionDeletedEvent {
  sessionId: string;
}

/**
 * session:closed - 会话关闭成功
 */
export interface SessionClosedEvent {
  sessionId: string;
}

// ============================================================================
// Agent 事件
// ============================================================================

/**
 * agent:done - Agent 完成任务
 */
export interface AgentDoneEvent {
  sessionId: string;
}

/**
 * agent:error - Agent 执行出错
 */
export interface AgentErrorEvent {
  error: string;
}

// ============================================================================
// 类型导出（向后兼容）
// ============================================================================

/**
 * @deprecated 使用 TextStartEvent, TextDeltaEvent, TextDoneEvent
 */
export interface MessageDeltaEvent {
  sessionId: string;
  messageId: string;
  text: string;
}

/**
 * @deprecated 使用 ReasoningStartEvent, ReasoningDeltaEvent, ReasoningDoneEvent
 */
export interface MessageReasoningEvent {
  sessionId: string;
  messageId: string;
  text: string;
}

/**
 * @deprecated 使用 ToolCallStartEvent, ToolExecuteStartEvent 等
 */
export interface ToolStartEvent {
  toolName: string;
  input?: unknown;
  callId?: string;
  arguments?: unknown;
}

/**
 * @deprecated 使用 ToolExecuteDoneEvent
 */
export interface ToolDoneEvent {
  toolName: string;
  output?: unknown;
  callId?: string;
  success?: boolean;
  duration?: number;
  result?: unknown;
}

/**
 * @deprecated 使用 AgentErrorEvent
 */
export interface ErrorEvent {
  code?: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// 向后兼容类型（已废弃但需要保留导出）
// ============================================================================

/**
 * @deprecated 基础事件接口，具体事件请使用具体的事件类型
 */
export interface BaseEvent {
  type: string;
  data?: unknown;
}

/**
 * @deprecated 流式事件，请使用具体的事件类型
 */
export interface StreamEvent {
  sessionId: string;
  messageId?: string;
  type: string;
  data?: unknown;
}

/**
 * @deprecated 使用 TextDoneEvent
 */
export interface MessageDoneEvent {
  sessionId: string;
  messageId: string;
}

/**
 * @deprecated 项目变更事件
 */
export interface ProjectChangedEvent {
  projectId: string;
  sessionId?: string;
  action: 'created' | 'updated' | 'deleted';
}

/**
 * @deprecated 处理状态变更事件
 */
export interface ProcessingChangedEvent {
  sessionId: string;
  status: 'idle' | 'processing' | 'error';
  error?: string;
}
