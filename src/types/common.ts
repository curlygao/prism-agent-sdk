/**
 * 核心类型定义
 * 从 src/core/types/common.ts 迁移
 */

import type { Part } from './parts';
import type { Message } from './chat';

/**
 * 文件信息接口
 */
export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  size: number;
  modified?: number;
}

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string;
  title: string;
  projectId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 会话元数据
 */
export interface SessionMeta {
  id: string;
  title: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * 项目元数据
 */
export interface ProjectMeta {
  id: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  sessionCount: number;
}
