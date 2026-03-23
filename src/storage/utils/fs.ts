// src/core/storage/utils/fs.ts
/**
 * 文件系统抽象接口
 * 提供跨平台的文件系统操作抽象
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';

export interface IFileSystem {
  /**
   * 读取文件内容
   * @param path - 文件路径
   * @returns 文件内容字符串
   * @throws {NodeJS.ErrnoException} 文件不存在时抛出 ENOENT 错误
   */
  readFile(path: string): Promise<string>;

  /**
   * 写入文件
   * @param path - 文件路径
   * @param content - 文件内容
   * @throws {NodeJS.ErrnoException} 父目录不存在时抛出 ENOENT 错误
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * 追加内容到文件
   * @param path - 文件路径
   * @param content - 要追加的内容
   * @throws {NodeJS.ErrnoException} 文件不存在时抛出 ENOENT 错误
   */
  appendFile(path: string, content: string): Promise<void>;

  /**
   * 按行读取文件
   * @param path - 文件路径
   * @returns 行数组（保留空行）
   * @throws {NodeJS.ErrnoException} 文件不存在时抛出 ENOENT 错误
   */
  readFileLines(path: string): Promise<string[]>;

  /**
   * 创建目录
   * @param path - 目录路径
   * @param options - 选项
   * @param options.recursive - 是否递归创建父目录
   * @throws {NodeJS.ErrnoException} 非递归模式下父目录不存在时抛出 ENOENT 错误
   */
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;

  /**
   * 检查路径是否存在
   * @param path - 路径
   * @returns 是否存在
   */
  exists(path: string): Promise<boolean>;

  /**
   * 删除文件
   * @param path - 文件路径
   * @throws {NodeJS.ErrnoException} 文件不存在时抛出 ENOENT 错误
   */
  unlink(path: string): Promise<void>;

  /**
   * 列出目录内容
   * @param path - 目录路径
   * @returns 子项名称列表
   */
  readdir(path: string): Promise<string[]>;

  /**
   * 同步读取文件（ConfigManager 需要）
   * @param path - 文件路径
   * @param encoding - 编码
   * @returns 文件内容字符串
   */
  readFileSync(path: string, encoding?: BufferEncoding): string;

  /**
   * 同步检查文件是否存在（ConfigManager 需要）
   * @param path - 文件路径
   * @returns 是否存在
   */
  existsSync(path: string): boolean;

  /**
   * 同步创建目录（ConfigManager 需要）
   * @param path - 目录路径
   * @param options - 选项
   */
  mkdirSync(path: string, options?: { recursive: boolean }): void;
}

export class MockFileSystem implements IFileSystem {
  private store = new Map<string, string>();
  private directories = new Set<string>();

  async readFile(path: string): Promise<string> {
    const content = this.store.get(path);
    if (!content) {
      const error = new Error(`File not found: ${path}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir && !this.directories.has(dir)) {
      // 自动创建父目录（模拟 Node.js 的行为）
      const parts = dir.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        this.directories.add(current);
      }
    }
    this.store.set(path, content);
  }

  async appendFile(path: string, content: string): Promise<void> {
    if (!this.store.has(path)) {
      const error = new Error(`File not found: ${path}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    const existing = this.store.get(path)!;
    this.store.set(path, existing + content);
  }

  async readFileLines(path: string): Promise<string[]> {
    const content = await this.readFile(path);
    const lines = content.split('\n');
    // 移除末尾的空元素（如果文件以 \n 结尾）
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines;
  }

  async mkdir(path: string, options?: { recursive: boolean }): Promise<void> {
    if (options?.recursive) {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        this.directories.add(current);
      }
    } else {
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      if (parentDir && !this.directories.has(parentDir)) {
        // 自动创建父目录（模拟 Node.js 的行为）
        const parts = parentDir.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
          current += '/' + part;
          this.directories.add(current);
        }
      }
      this.directories.add(path);
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.store.has(path) || this.directories.has(path);
  }

  async unlink(path: string): Promise<void> {
    if (!this.store.has(path)) {
      const error = new Error(`File not found: ${path}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    this.store.delete(path);
  }

  async readdir(path: string): Promise<string[]> {
    const results: string[] = [];
    const prefix = path.endsWith('/') ? path : path + '/';
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        const relative = key.substring(prefix.length);
        const firstPart = relative.split('/')[0];
        if (firstPart && !results.includes(firstPart)) {
          results.push(firstPart);
        }
      }
    }
    return results;
  }

  /**
   * 清空所有数据（测试辅助方法）
   */
  clear() {
    this.store.clear();
    this.directories.clear();
  }

  /**
   * 检查文件是否存在（测试辅助方法）
   * @param path - 文件路径
   * @returns 是否存在
   */
  hasFile(path: string): boolean {
    return this.store.has(path);
  }

  /**
   * 同步读取文件（ConfigManager 需要）
   */
  readFileSync(path: string, encoding: BufferEncoding = 'utf-8'): string {
    const content = this.store.get(path);
    if (!content) {
      const error = new Error(`File not found: ${path}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return content;
  }

  /**
   * 同步检查文件是否存在（ConfigManager 需要）
   */
  existsSync(path: string): boolean {
    return this.store.has(path) || this.directories.has(path);
  }

  /**
   * 同步创建目录（ConfigManager 需要）
   */
  mkdirSync(path: string, options?: { recursive: boolean }): void {
    if (options?.recursive) {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        this.directories.add(current);
      }
    } else {
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      if (parentDir && !this.directories.has(parentDir)) {
        const error = new Error(`Directory not found: ${parentDir}`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      this.directories.add(path);
    }
  }
}

/**
 * Node.js 文件系统实现
 * 仅在 Node.js 环境中可用
 */
export class NodeFileSystem implements IFileSystem {
  constructor() {
    // 在构造时检查 Node.js 环境
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error('NodeFileSystem is only available in Node.js environment');
    }
  }

  /**
   * 展开路径中的 ~ 符号
   */
  private expandPath(p: string): string {
    if (p.startsWith('~/') || p === '~') {
      return p.replace('~', os.homedir());
    }
    return p;
  }

  async readFile(p: string): Promise<string> {
    return await fs.readFile(this.expandPath(p), 'utf-8');
  }

  async writeFile(p: string, content: string): Promise<void> {
    await fs.writeFile(this.expandPath(p), content, 'utf-8');
  }

  async appendFile(p: string, content: string): Promise<void> {
    await fs.appendFile(this.expandPath(p), content, 'utf-8');
  }

  async readFileLines(p: string): Promise<string[]> {
    const content = await this.readFile(p);
    return content.split('\n').filter(line => line.trim() !== '');
  }

  async mkdir(p: string, options?: { recursive: boolean }): Promise<void> {
    await fs.mkdir(this.expandPath(p), options);
  }

  async exists(p: string): Promise<boolean> {
    try {
      await fs.access(this.expandPath(p));
      return true;
    } catch {
      return false;
    }
  }

  async unlink(p: string): Promise<void> {
    await fs.unlink(this.expandPath(p));
  }

  async readdir(p: string): Promise<string[]> {
    return await fs.readdir(this.expandPath(p));
  }

  /**
   * 同步读取文件（ConfigManager 需要）
   */
  readFileSync(p: string, encoding: BufferEncoding = 'utf-8'): string {
    return fsSync.readFileSync(this.expandPath(p), encoding);
  }

  /**
   * 同步检查文件是否存在（ConfigManager 需要）
   */
  existsSync(p: string): boolean {
    try {
      fsSync.accessSync(this.expandPath(p));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 同步创建目录（ConfigManager 需要）
   */
  mkdirSync(p: string, options?: { recursive: boolean }): void {
    fsSync.mkdirSync(this.expandPath(p), options);
  }
}
