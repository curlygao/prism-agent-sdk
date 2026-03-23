/**
 * 存储错误基类
 */
export class StorageError extends Error {
  /** 错误代码 */
  public code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/**
 * 项目未找到错误
 */
export class ProjectNotFoundError extends StorageError {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`, 'PROJECT_NOT_FOUND');
  }
}

/**
 * 会话未找到错误
 */
export class SessionNotFoundError extends StorageError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
  }
}

/**
 * 数据损坏错误
 */
export class CorruptedDataError extends StorageError {
  constructor(path: string, reason: string) {
    super(`Corrupted data at ${path}: ${reason}`, 'CORRUPTED_DATA');
  }
}

/**
 * 并发修改错误
 */
export class ConcurrencyError extends StorageError {
  constructor(resource: string) {
    super(`Concurrent modification on ${resource}`, 'CONCURRENCY_ERROR');
  }
}
