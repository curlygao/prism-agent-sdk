// packages/core/src/storage/index.ts
export { StorageManager } from './StorageManager';
export { ProjectStorage } from './ProjectStorage';
export { SessionStorage } from './SessionStorage';
export { MemoryStorage } from './utils/MemoryStorage';
export type { IFileSystem, NodeFileSystem, MockFileSystem } from './utils/fs';
// 导出类型，避免与 types/index.ts 中的类型冲突
export type { StorageSessionMeta, ProjectData, IStorageAPI, Message } from './types';
