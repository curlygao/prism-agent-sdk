import type { IFileSystem } from './utils/fs';
import type { ProjectMeta, ProjectData, StorageSessionMeta } from './types';
import { getProjectDir, getMetaFile } from './utils/path';
import { ProjectNotFoundError, CorruptedDataError } from './errors';

/**
 * 项目存储类
 * 负责管理项目和会话元数据的持久化
 */
export class ProjectStorage {
  constructor(
    private fs: IFileSystem,
    private baseDir: string
  ) {}

  /**
   * 获取或创建项目
   * @param projectPath - 项目路径
   * @returns 项目元数据
   */
  async getOrCreateProject(projectPath: string): Promise<ProjectMeta> {
    const projectDir = getProjectDir(this.baseDir, projectPath);
    const metaFile = getMetaFile(projectDir);

    if (await this.fs.exists(metaFile)) {
      return await this.loadProject(projectPath);
    }

    return await this.createProject(projectPath);
  }

  /**
   * 获取项目元数据
   * @param projectId - 项目 ID
   * @returns 项目元数据，不存在时返回 null
   */
  async getProject(projectId: string): Promise<ProjectMeta | null> {
    const projects = await this.fs.exists(this.baseDir)
      ? await this.fs.readdir(this.baseDir)
      : [];

    for (const dirName of projects) {
      const projectDir = `${this.baseDir}/${dirName}`;
      const metaFile = getMetaFile(projectDir);
      if (await this.fs.exists(metaFile)) {
        const meta = await this.loadMetaFile(metaFile);
        if (meta.id === projectId) {
          return this.metaToProjectMeta(meta);
        }
      }
    }

    return null;
  }

  /**
   * 更新项目活动时间
   * @param projectId - 项目 ID
   */
  async updateProjectActivity(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const metaFile = getMetaFile(projectDir);
    const meta = await this.loadMetaFile(metaFile);
    meta.lastActivity = Date.now();

    await this.fs.writeFile(metaFile, JSON.stringify(meta, null, 2));
  }

  /**
   * 列出项目的所有会话
   * @param projectId - 项目 ID
   * @returns 会话元数据列表
   */
  async listSessions(projectId: string): Promise<StorageSessionMeta[]> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const metaFile = getMetaFile(projectDir);
    const meta = await this.loadMetaFile(metaFile);

    return meta.sessions;
  }

  /**
   * 添加会话到项目
   * @param projectId - 项目 ID
   * @param session - 会话元数据
   */
  async addSession(projectId: string, session: StorageSessionMeta): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const metaFile = getMetaFile(projectDir);
    const meta = await this.loadMetaFile(metaFile);

    const existingIndex = meta.sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      meta.sessions[existingIndex] = session;
    } else {
      meta.sessions.unshift(session);
    }

    meta.lastActivity = Date.now();
    await this.fs.writeFile(metaFile, JSON.stringify(meta, null, 2));
  }

  /**
   * 更新会话元数据
   * @param projectId - 项目 ID
   * @param session - 会话元数据
   */
  async updateSession(projectId: string, session: StorageSessionMeta): Promise<void> {
    await this.addSession(projectId, session);
  }

  /**
   * 删除会话
   * @param projectId - 项目 ID
   * @param sessionId - 会话 ID
   */
  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const projectDir = getProjectDir(this.baseDir, project.originalPath);
    const metaFile = getMetaFile(projectDir);
    const meta = await this.loadMetaFile(metaFile);

    meta.sessions = meta.sessions.filter(s => s.id !== sessionId);
    meta.lastActivity = Date.now();

    await this.fs.writeFile(metaFile, JSON.stringify(meta, null, 2));
  }

  /**
   * 列出所有项目
   * @returns 所有项目元数据列表
   */
  async listAllProjects(): Promise<ProjectMeta[]> {
    const projects: ProjectMeta[] = [];

    if (!await this.fs.exists(this.baseDir)) {
      return projects;
    }

    const dirNames = await this.fs.readdir(this.baseDir);

    for (const dirName of dirNames) {
      const projectDir = `${this.baseDir}/${dirName}`;
      const metaFile = getMetaFile(projectDir);

      if (await this.fs.exists(metaFile)) {
        const meta = await this.loadMetaFile(metaFile);
        projects.push(this.metaToProjectMeta(meta));
      }
    }

    return projects.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * 创建新项目
   * @param projectPath - 项目路径
   * @returns 项目元数据
   */
  private async createProject(projectPath: string): Promise<ProjectMeta> {
    const projectDir = getProjectDir(this.baseDir, projectPath);

    await this.fs.mkdir(projectDir, { recursive: true });

    const projectData: ProjectData = {
      id: this.generateProjectId(),
      name: this.extractProjectName(projectPath),
      originalPath: projectPath,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      sessions: [],
    };

    const metaFile = getMetaFile(projectDir);
    await this.fs.writeFile(metaFile, JSON.stringify(projectData, null, 2));

    return this.metaToProjectMeta(projectData);
  }

  /**
   * 加载项目元数据
   * @param projectPath - 项目路径
   * @returns 项目元数据
   */
  private async loadProject(projectPath: string): Promise<ProjectMeta> {
    const projectDir = getProjectDir(this.baseDir, projectPath);
    const metaFile = getMetaFile(projectDir);
    return this.metaToProjectMeta(await this.loadMetaFile(metaFile));
  }

  /**
   * 加载 meta.json 文件
   * @param metaFile - 元数据文件路径
   * @returns 项目数据
   */
  private async loadMetaFile(metaFile: string): Promise<ProjectData> {
    try {
      const content = await this.fs.readFile(metaFile);
      return JSON.parse(content) as ProjectData;
    } catch (error) {
      throw new CorruptedDataError(metaFile, 'Failed to parse JSON');
    }
  }

  /**
   * 转换 ProjectData 为 ProjectMeta
   * @param data - 项目数据
   * @returns 项目元数据
   */
  private metaToProjectMeta(data: ProjectData): ProjectMeta {
    return {
      id: data.id,
      originalPath: data.originalPath,
      name: data.name,
      createdAt: data.createdAt,
      lastActivity: data.lastActivity,
      sessionCount: data.sessions.length,
    };
  }

  /**
   * 生成项目 ID
   * @returns 项目 ID
   */
  private generateProjectId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 从路径提取项目名称
   * @param projectPath - 项目路径
   * @returns 项目名称
   */
  private extractProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'Untitled';
  }
}
