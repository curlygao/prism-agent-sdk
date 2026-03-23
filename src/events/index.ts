// packages/core/src/events/index.ts
// 仅导出事件类型定义和内部实现，不导出 handlers

// 内部实现（仅供 Core 内部使用）
export { EventBus, eventBus } from './EventBus';

// 类型定义
export type {
  // 文本事件
  TextStartEvent,
  TextDeltaEvent,
  TextDoneEvent,
  // 思考事件
  ReasoningStartEvent,
  ReasoningDeltaEvent,
  ReasoningDoneEvent,
  // 工具调用 - 生成阶段
  ToolCallStartEvent,
  ToolCallDoneEvent,
  ToolCallInterruptEvent,
  // 工具调用 - 执行阶段
  ToolExecuteStartEvent,
  ToolExecuteDoneEvent,
  ToolExecuteErrorEvent,
  // 会话事件
  SessionCreatedEvent,
  SessionDeletedEvent,
  // Agent 事件
  AgentDoneEvent,
  AgentErrorEvent,
  // 向后兼容
  BaseEvent,
  StreamEvent,
  MessageDeltaEvent,
  MessageReasoningEvent,
  MessageDoneEvent,
  ToolStartEvent,
  ToolDoneEvent,
  ErrorEvent,
  ProjectChangedEvent,
  ProcessingChangedEvent,
} from './types';

export { EventTypes, type EventName } from './types';
