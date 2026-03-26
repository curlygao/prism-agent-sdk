/**
 * 应用状态管理器
 *
 * 管理进程级别的运行时状态（非持久化）
 */

import type { EventBus } from '../events';
import type { ProjectMeta } from '../storage/types';

/**
 * 处理状态
 */
export interface ProcessingState {
  isProcessing: boolean;
  currentTask: string | null;
}

/**
 * 应用状态管理器
 */
export class AppStateManager {
  private currentProject: ProjectMeta | null = null;
  private processingState: ProcessingState = {
    isProcessing: false,
    currentTask: null,
  };

  constructor(private eventBus: EventBus) {}

  // ========== 项目状态 ==========

  /**
   * 获取当前项目
   */
  getCurrentProject(): ProjectMeta | null {
    return this.currentProject;
  }

  /**
   * 设置当前项目
   */
  setCurrentProject(project: ProjectMeta | null): void {
    this.currentProject = project;
    this.eventBus.emit('project:changed', project);
  }

  /**
   * 清除当前项目
   */
  clearCurrentProject(): void {
    this.currentProject = null;
    this.eventBus.emit('project:changed', null);
  }

  // ========== 处理状态 ==========

  /**
   * 获取处理状态
   */
  getProcessingState(): ProcessingState {
    return { ...this.processingState };
  }

  /**
   * 设置处理状态
   */
  setProcessing(isProcessing: boolean, task?: string): void {
    this.processingState = {
      isProcessing,
      currentTask: task || null,
    };
    this.eventBus.emit('processing:changed', this.processingState);
  }

  /**
   * 开始处理任务
   */
  startProcessing(task: string): void {
    this.setProcessing(true, task);
  }

  /**
   * 结束处理
   */
  endProcessing(): void {
    this.setProcessing(false);
  }

  /**
   * 判断是否正在处理
   */
  isProcessing(): boolean {
    return this.processingState.isProcessing;
  }
}
