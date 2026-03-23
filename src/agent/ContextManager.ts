// packages/core/src/agent/ContextManager.ts
import type { Message } from '../types/chat';
import type { AgentContext } from '../types/agent';
import type { IStorageAPI } from '../storage/types';

/**
 * 上下文管理器
 * 负责从 Storage 读取会话历史，构建 Agent 上下文
 */
export class ContextManager {
  constructor(private storage: IStorageAPI) {}

  /**
   * 构建上下文
   */
  async buildContext(sessionId: string, currentMessage: string): Promise<AgentContext> {
    const history = await this.storage.loadSession(sessionId);

    const context: AgentContext = {
      sessionId,
      currentMessage,
      history,
      workspace: process.cwd(),
    };

    return context;
  }

  /**
   * 清理上下文缓存
   */
  clearCache(sessionId?: string): void {
    // 如果实现缓存，这里清理
  }
}
