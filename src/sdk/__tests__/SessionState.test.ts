import { describe, it, expect } from 'vitest';
import { SessionState } from '../SessionState';

describe('SessionState', () => {
  it('应该正确初始化状态', () => {
    const state = new SessionState('session-1', 'project-1');

    expect(state.sessionId).toBe('session-1');
    expect(state.projectId).toBe('project-1');
    expect(state.createdAt).toBeGreaterThan(0);
    expect(state.processingState.isProcessing).toBe(false);
    expect(state.processingState.currentTask).toBe(null);
  });

  it('应该正确设置处理状态', () => {
    const state = new SessionState('session-1', 'project-1');

    state.setProcessing(true, '处理消息中');

    expect(state.isProcessing()).toBe(true);
    expect(state.getCurrentTask()).toBe('处理消息中');

    state.setProcessing(false);

    expect(state.isProcessing()).toBe(false);
    expect(state.getCurrentTask()).toBe(null);
  });

  it('应该生成唯一的消息 ID', () => {
    const state = new SessionState('session-1', 'project-1');

    const id1 = state.generateMessageId();
    const id2 = state.generateMessageId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(state.currentMessageId).toBe(id2);
  });

  it('生成的消息 ID 应该包含 msg_ 前缀', () => {
    const state = new SessionState('session-1', 'project-1');

    const id = state.generateMessageId();

    expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/);
  });
});
