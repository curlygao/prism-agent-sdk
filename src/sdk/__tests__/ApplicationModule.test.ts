import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplicationModule } from '../ApplicationModule';
import { ConfigManager } from '../../application/ConfigManager';
import { AppStateManager } from '../../application/AppStateManager';
import { EventBus } from '../../events/EventBus';
import { MockFileSystem } from '../../storage/utils/fs';

describe('ApplicationModule', () => {
  let module: ApplicationModule;
  let configManager: ConfigManager;
  let stateManager: AppStateManager;
  let eventBus: EventBus;
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    eventBus = new EventBus();
    configManager = new ConfigManager(mockFs, '/test/config');
    stateManager = new AppStateManager(eventBus);
    module = new ApplicationModule(configManager, stateManager, eventBus);
  });

  describe('基础功能', () => {
    it('应该暴露 config 属性', () => {
      expect(module.config).toBe(configManager);
    });

    it('应该暴露 state 属性', () => {
      expect(module.state).toBe(stateManager);
    });
  });

  describe('事件快捷方式', () => {
    it('应该能够订阅 project:changed 事件', () => {
      const handler = vi.fn();
      module.on('project:changed', handler);
      stateManager.setCurrentProject({
        id: 'proj-1',
        originalPath: '/test',
        name: 'Test Project',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionCount: 0,
      });
      expect(handler).toHaveBeenCalled();
    });

    it('应该能够订阅 processing:changed 事件', () => {
      const handler = vi.fn();
      module.on('processing:changed', handler);
      stateManager.setProcessing(true, 'test task');
      expect(handler).toHaveBeenCalled();
    });
  });
});
