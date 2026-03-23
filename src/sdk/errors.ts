/**
 * 会话基础错误类
 *
 * 所有会话相关错误的基类，包含会话 ID 和错误码信息。
 *
 * @example
 * ```ts
 * throw new SessionError('Custom error', 'session-123', 'CUSTOM_ERROR');
 * ```
 */
export class SessionError extends Error {
  /**
   * 创建会话错误实例
   *
   * @param message - 错误消息
   * @param sessionId - 关联的会话 ID
   * @param code - 错误码，用于程序化错误处理
   */
  constructor(
    message: string,
    public readonly sessionId: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * 会话不存在错误
 *
 * 当尝试访问一个不存在的会话时抛出此错误。
 *
 * @example
 * ```ts
 * if (!session) {
 *   throw new SessionNotFoundError('session-123');
 * }
 * ```
 */
export class SessionNotFoundError extends SessionError {
  /**
   * 创建会话不存在错误实例
   *
   * @param sessionId - 不存在的会话 ID
   */
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, sessionId, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

/**
 * 会话已关闭错误
 *
 * 当尝试向已关闭的会话发送消息或执行操作时抛出此错误。
 *
 * @example
 * ```ts
 * if (session.closed) {
 *   throw new SessionClosedError('session-123');
 * }
 * ```
 */
export class SessionClosedError extends SessionError {
  /**
   * 创建会话已关闭错误实例
   *
   * @param sessionId - 已关闭的会话 ID
   */
  constructor(sessionId: string) {
    super(`Session closed: ${sessionId}`, sessionId, 'SESSION_CLOSED');
    this.name = 'SessionClosedError';
  }
}

/**
 * 会话忙错误
 *
 * 当会话正在处理消息时，尝试发送新消息会抛出此错误。
 * 这防止了并发消息导致的状态混乱。
 *
 * @example
 * ```ts
 * if (session.isProcessing) {
 *   throw new SessionBusyError('session-123');
 * }
 * ```
 */
export class SessionBusyError extends SessionError {
  /**
   * 创建会话忙错误实例
   *
   * @param sessionId - 忙碌的会话 ID
   */
  constructor(sessionId: string) {
    super(`Session is busy processing: ${sessionId}`, sessionId, 'SESSION_BUSY');
    this.name = 'SessionBusyError';
  }
}
