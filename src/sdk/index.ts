// SDK 模块导出

export { vercelAIManager } from '../vercelai';
export { SDKEventBus } from './SDKEventBus';
export { ToolsModule } from './ToolsModule';
export { StorageModule } from './StorageModule';
export { ApplicationModule } from './ApplicationModule';

// SessionManager 和相关组件
export { SessionManager } from './SessionManager';
export { SessionHandle } from './SessionHandle';
export { SessionState } from './SessionState';
export { SessionEventEmitter } from './SessionEventEmitter';

// 类型定义
export type {
  SessionState as SessionStateType,
  SessionEvent,
  SessionInfo,
  CreateSessionOptions,
  SendOptions,
  SessionHandle as SessionHandleInterface,
} from './types';

// 错误类
export {
  SessionError,
  SessionNotFoundError,
  SessionClosedError,
  SessionBusyError,
} from './errors';
