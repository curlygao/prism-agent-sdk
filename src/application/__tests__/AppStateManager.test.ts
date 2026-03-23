/**
 * AppStateManager 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppStateManager } from '../AppStateManager';
import { EventBus } from '../../events';
import type { ProjectMeta } from '../../storage/types';

describe('AppStateManager', () => {
  let appStateManager: AppStateManager;
  let eventBus: EventBus;
  let projectChangedHandler: any;
  let processingChangedHandler: any;

  beforeEach(() => {
    eventBus = new EventBus();
    appStateManager = new AppStateManager(eventBus);

    // 记录事件
    projectChangedHandler = vi.fn();
    processingChangedHandler = vi.fn();

    eventBus.on('project:changed', projectChangedHandler);
    eventBus.on('processing:changed', processingChangedHandler);
  });

  describe('项目状态管理', () => {
    it('初始状态应该没有当前项目', () => {
      expect(appStateManager.getCurrentProject()).toBeNull();
    });

    it('应该设置当前项目', () => {
      const project: ProjectMeta = {
        id: 'proj-1',
        originalPath: '/test/project',
        name: 'test-project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };

      appStateManager.setCurrentProject(project);

      expect(appStateManager.getCurrentProject()).toEqual(project);
      expect(projectChangedHandler).toHaveBeenCalledWith(project);
    });

    it('应该清除当前项目', () => {
      const project: ProjectMeta = {
        id: 'proj-1',
        originalPath: '/test/project',
        name: 'test-project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };

      appStateManager.setCurrentProject(project);
      appStateManager.clearCurrentProject();

      expect(appStateManager.getCurrentProject()).toBeNull();
      expect(projectChangedHandler).toHaveBeenCalledWith(null);
    });

    it('应该触发 project:changed 事件', () => {
      const project: ProjectMeta = {
        id: 'proj-1',
        originalPath: '/test/project',
        name: 'test-project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };

      appStateManager.setCurrentProject(project);

      expect(projectChangedHandler).toHaveBeenCalledTimes(1);
      expect(projectChangedHandler).toHaveBeenCalledWith(project);
    });
  });

  describe('处理状态管理', () => {
    it('初始状态应该不在处理中', () => {
      const state = appStateManager.getProcessingState();

      expect(state.isProcessing).toBe(false);
      expect(state.currentTask).toBeNull();
    });

    it('应该设置处理状态', () => {
      appStateManager.setProcessing(true, 'test-task');

      const state = appStateManager.getProcessingState();
      expect(state.isProcessing).toBe(true);
      expect(state.currentTask).toBe('test-task');
      expect(processingChangedHandler).toHaveBeenCalledWith({
        isProcessing: true,
        currentTask: 'test-task',
      });
    });

    it('应该清除处理状态', () => {
      appStateManager.setProcessing(true, 'test-task');
      appStateManager.setProcessing(false);

      const state = appStateManager.getProcessingState();
      expect(state.isProcessing).toBe(false);
      expect(state.currentTask).toBeNull();
    });

    it('应该开始处理任务', () => {
      appStateManager.startProcessing('loading data');

      expect(appStateManager.isProcessing()).toBe(true);
      expect(appStateManager.getProcessingState().currentTask).toBe('loading data');
    });

    it('应该结束处理', () => {
      appStateManager.startProcessing('loading data');
      appStateManager.endProcessing();

      expect(appStateManager.isProcessing()).toBe(false);
      expect(appStateManager.getProcessingState().currentTask).toBeNull();
    });

    it('应该判断是否正在处理', () => {
      expect(appStateManager.isProcessing()).toBe(false);

      appStateManager.startProcessing('test');

      expect(appStateManager.isProcessing()).toBe(true);

      appStateManager.endProcessing();

      expect(appStateManager.isProcessing()).toBe(false);
    });

    it('应该触发 processing:changed 事件', () => {
      appStateManager.setProcessing(true, 'test-task');

      expect(processingChangedHandler).toHaveBeenCalledTimes(1);
      expect(processingChangedHandler).toHaveBeenCalledWith({
        isProcessing: true,
        currentTask: 'test-task',
      });
    });

    it('应该返回处理状态的副本', () => {
      appStateManager.setProcessing(true, 'test-task');

      const state1 = appStateManager.getProcessingState();
      const state2 = appStateManager.getProcessingState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // 不同引用
    });
  });

  describe('状态变更事件', () => {
    it('应该在项目变更时触发事件', () => {
      const project: ProjectMeta = {
        id: 'proj-1',
        originalPath: '/test/project',
        name: 'test-project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      };

      appStateManager.setCurrentProject(project);

      expect(projectChangedHandler).toHaveBeenCalledWith(project);
    });

    it('应该在处理状态变更时触发事件', () => {
      appStateManager.setProcessing(true, 'test-task');

      expect(processingChangedHandler).toHaveBeenCalledWith({
        isProcessing: true,
        currentTask: 'test-task',
      });
    });
  });
});
