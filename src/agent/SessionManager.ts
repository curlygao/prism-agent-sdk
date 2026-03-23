/**
 * 会话管理器
 *
 * 管理聊天会话的创建、加载、保存
 * 支持 Part 数据持久化
 */

import type { ChatSession } from '../types/common';
import type { Message } from '../types/chat';
import type { Part } from '../types/parts';

export class SessionManager {
  private sessions = new Map<string, ChatSession>();
  private currentSessionId?: string;

  /**
   * 创建新会话
   */
  createSession(title = '新对话', projectId = 'default'): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      title,
      projectId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    return session;
  }

  /**
   * 获取会话
   */
  getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): ChatSession | undefined {
    if (!this.currentSessionId) {
      return undefined;
    }
    return this.sessions.get(this.currentSessionId);
  }

  /**
   * 设置当前会话
   */
  setCurrentSession(id: string): void {
    if (!this.sessions.has(id)) {
      throw new Error(`会话不存在: ${id}`);
    }
    this.currentSessionId = id;
  }

  /**
   * 添加消息到会话
   */
  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();
  }

  /**
   * 添加 Part 到消息
   */
  addPart(sessionId: string, messageId: string, part: Part): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const message = session.messages.find(m => m.id === messageId);
    if (!message) {
      throw new Error(`消息不存在: ${messageId}`);
    }

    // 初始化 parts 数组
    if (!message.parts) {
      message.parts = [];
    }

    message.parts.push(part);
    session.updatedAt = Date.now();
  }

  /**
   * 更新会话标题
   */
  updateTitle(sessionId: string, title: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    session.title = title;
    session.updatedAt = Date.now();
  }

  /**
   * 删除会话
   */
  deleteSession(id: string): void {
    this.sessions.delete(id);
    if (this.currentSessionId === id) {
      this.currentSessionId = undefined;
    }
  }

  /**
   * 列出所有会话
   */
  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  /**
   * 序列化会话（包含 Part 数据）
   */
  serializeSession(session: ChatSession): string {
    return JSON.stringify(session, (key, value) => {
      // 处理特殊类型
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      return value;
    });
  }

  /**
   * 反序列化会话
   */
  deserializeSession(data: string): ChatSession {
    return JSON.parse(data);
  }

  /**
   * 保存会话到持久存储
   */
  async saveSession(id: string): Promise<void> {
    // TODO: 实现持久化存储
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`会话不存在: ${id}`);
    }
    // 使用 Tauri API 保存到文件
  }

  /**
   * 从持久存储加载会话
   */
  async loadSession(id: string): Promise<ChatSession> {
    // TODO: 实现从文件加载
    // 需要迁移旧格式数据
    throw new Error('未实现');
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
