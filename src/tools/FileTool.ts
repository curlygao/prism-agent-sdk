/**
 * 文件系统工具
 *
 * 提供文件读写、目录操作等功能
 * 使用 Node.js 原生 fs/promises API
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './BaseTool';
import { z } from 'zod';

const execAsync = promisify(exec);

/**
 * 文件工具类 - 直接使用 Node.js 原生 API
 */
export class FileTool {
  /**
   * 读取文件
   */
  async readFile(path: string): Promise<string> {
    return await readFile(path, 'utf-8');
  }

  /**
   * 写入文件
   */
  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8');
  }

  /**
   * 列出目录
   */
  async listDir(path: string): Promise<string[]> {
    return await readdir(path);
  }

  /**
   * 执行命令（获取当前目录等）
   */
  async execCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
    return await execAsync(command, { cwd });
  }

  /**
   * 获取当前工作目录
   */
  async getCwd(): Promise<string> {
    return process.cwd();
  }
}

/**
 * 读取文件工具（BaseTool 风格）
 */
export class ReadFileTool extends BaseTool<
  { path: string },
  { content: string }
> {
  name = 'read_file';
  description = '读取文件内容。使用此工具查看文件的具体内容。';
  summaryTemplate = '读取 {{path}}';

  inputSchema = z.object({
    path: z.string().describe('要读取的文件路径'),
  });

  protected async executeWithValidation(input: { path: string }): Promise<{ content: string }> {
    const fileTool = new FileTool();
    const content = await fileTool.readFile(input.path);
    return { content };
  }
}

/**
 * 写入文件工具
 */
export class WriteFileTool extends BaseTool<
  { path: string; content: string },
  { success: boolean }
> {
  name = 'write_file';
  description = '写入文件内容。如果文件不存在会自动创建，如果存在则覆盖原有内容。';
  summaryTemplate = '写入 {{path}}';

  inputSchema = z.object({
    path: z.string().describe('要写入的文件路径'),
    content: z.string().describe('要写入的文件内容'),
  });

  protected async executeWithValidation(input: { path: string; content: string }): Promise<{ success: boolean }> {
    const fileTool = new FileTool();
    await fileTool.writeFile(input.path, input.content);
    return { success: true };
  }
}

/**
 * 列出目录工具
 */
export class ListDirTool extends BaseTool<
  { path: string },
  { entries: string[] }
> {
  name = 'list_dir';
  description = '列出目录中的文件和子目录。';
  summaryTemplate = '列出目录 {{path}}';

  inputSchema = z.object({
    path: z.string().describe('要列出的目录路径'),
  });

  protected async executeWithValidation(input: { path: string }): Promise<{ entries: string[] }> {
    const fileTool = new FileTool();
    const entries = await fileTool.listDir(input.path);
    return { entries };
  }
}

// 导出 BaseTool
export { BaseTool } from './BaseTool';
