import type { IFileSystem } from './utils/fs';
import type { ProjectMeta, StorageSessionMeta, Message } from './types';
import { getProjectDir, getSessionFile } from './utils/path';
import { SessionNotFoundError, CorruptedDataError } from './errors';
import { ProjectStorage } from './ProjectStorage';

/**
 * 会话存储类
 * 负责管理会话和消息的持久化
 */
export class SessionStorage {
  constructor(
    private fs: IFileSystem,
    private baseDir: string,
    private projectStorage: ProjectStorage
  ) {}

  /**
   * 创建新会话
   * @param projectId - 项目 ID
   * @param title - 会话标题
   * @returns 会话元数据
   */
  async createSession(projectId: string, title: string): Promise<StorageSessionMeta> {
    const project = await this.projectStorage.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const session: StorageSessionMeta = {
      id: this.generateSessionId(),
      projectId,
      title,
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const sessionFile = getSessionFile(projectDir, session.id);
    await this.fs.writeFile(sessionFile, '');

    await this.projectStorage.addSession(projectId, session);

    return session;
  }

  /**
   * 加载会话的所有消息
   * @param sessionId - 会话 ID
   * @returns 消息列表
   */
  async loadSession(sessionId: string): Promise<Message[]> {
    const project = await this.findProjectForSession(sessionId);
    if (!project) {
      throw new SessionNotFoundError(sessionId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const sessionFile = getSessionFile(projectDir, sessionId);

    return await this.loadMessagesFromFile(sessionFile);
  }

  /**
   * 追加单个消息到会话
   * @param sessionId - 会话 ID
   * @param message - 消息对象
   */
  async appendMessage(sessionId: string, message: Message): Promise<void> {
    const project = await this.findProjectForSession(sessionId);
    if (!project) {
      throw new SessionNotFoundError(sessionId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const sessionFile = getSessionFile(projectDir, sessionId);

    const line = JSON.stringify(message) + '\n';
    await this.fs.appendFile(sessionFile, line);

    const sessions = await this.projectStorage.listSessions(project.id);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.messageCount++;
      session.updatedAt = Date.now();
      await this.projectStorage.updateSession(project.id, session);
    }
  }

  /**
   * 批量追加消息
   * @param sessionId - 会话 ID
   * @param messages - 消息数组
   */
  async appendMessages(sessionId: string, messages: Message[]): Promise<void> {
    for (const message of messages) {
      await this.appendMessage(sessionId, message);
    }
  }

  /**
   * 更新会话元数据
   * @param sessionId - 会话 ID
   * @param updates - 要更新的字段
   */
  async updateSessionMeta(sessionId: string, updates: Partial<StorageSessionMeta>): Promise<void> {
    const project = await this.findProjectForSession(sessionId);
    if (!project) {
      throw new SessionNotFoundError(sessionId);
    }

    const sessions = await this.projectStorage.listSessions(project.id);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    Object.assign(session, updates);
    await this.projectStorage.updateSession(project.id, session);
  }

  /**
   * 更新会话的所有消息
   * @param sessionId - 会话 ID
   * @param messages - 新的消息列表
   */
  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    const project = await this.findProjectForSession(sessionId);
    if (!project) {
      throw new SessionNotFoundError(sessionId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const sessionFile = getSessionFile(projectDir, sessionId);

    // 将消息数组写入文件（每行一个 JSON 对象）
    const lines = messages.map(msg => JSON.stringify(msg));
    await this.fs.writeFile(sessionFile, lines.join('\n') + '\n');

    // 更新会话元数据中的消息数量
    const sessions = await this.projectStorage.listSessions(project.id);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.messageCount = messages.length;
      await this.projectStorage.updateSession(project.id, session);
    }
  }

  /**
   * 删除会话
   * @param sessionId - 会话 ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const project = await this.findProjectForSession(sessionId);
    if (!project) {
      throw new SessionNotFoundError(sessionId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const sessionFile = getSessionFile(projectDir, sessionId);

    await this.fs.unlink(sessionFile);
    await this.projectStorage.deleteSession(project.id, sessionId);
  }

  /**
   * 从文件加载消息
   * @param sessionFile - 会话文件路径
   * @returns 消息列表
   */
  private async loadMessagesFromFile(sessionFile: string): Promise<Message[]> {
    try {
      const lines = await this.fs.readFileLines(sessionFile);
      return lines.map(line => {
        try {
          return JSON.parse(line) as Message;
        } catch (error) {
          throw new CorruptedDataError(sessionFile, 'Invalid message JSON');
        }
      });
    } catch (error) {
      if ((error as SessionNotFoundError).code === 'SESSION_NOT_FOUND') {
        throw error;
      }
      throw new CorruptedDataError(sessionFile, (error as Error).message);
    }
  }

  /**
   * 查找会话所属项目
   * @param sessionId - 会话 ID
   * @returns 项目元数据，未找到时返回 null
   */
  private async findProjectForSession(sessionId: string): Promise<ProjectMeta | null> {
    const projects = await this.projectStorage.listAllProjects();

    for (const project of projects) {
      const projectDir = getProjectDir(this.baseDir, project.originalPath);
      const sessionFile = getSessionFile(projectDir, sessionId);

      if (await this.fs.exists(sessionFile)) {
        return project;
      }
    }

    return null;
  }

  /**
   * 生成会话 ID
   * @returns 会话 ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
