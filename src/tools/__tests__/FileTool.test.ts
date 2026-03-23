/**
 * FileTool 单元测试
 *
 * 测试文件系统工具的功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReadFileTool, WriteFileTool, ListDirTool, FileTool } from '../FileTool';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock fs 模块
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('FileTool', () => {
  describe('FileTool 类', () => {
    let fileTool: FileTool;

    beforeEach(() => {
      fileTool = new FileTool();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('应该读取文件内容', async () => {
      const mockContent = 'Test file content';
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await fileTool.readFile('/test/file.txt');

      expect(result).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
    });

    it('应该写入文件内容', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await fileTool.writeFile('/test/file.txt', 'New content');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/file.txt',
        'New content',
        'utf-8'
      );
    });

    it('应该列出目录内容', async () => {
      const mockEntries = ['file1.txt', 'file2.txt', 'subdir'];
      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);

      const result = await fileTool.listDir('/test/dir');

      expect(result).toEqual(mockEntries);
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
    });

    it('应该执行命令', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: 'output', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await fileTool.execCommand('echo test', '/test/cwd');

      expect(result).toEqual(mockResult);
      expect(mockExec).toHaveBeenCalledWith(
        'echo test',
        expect.objectContaining({ cwd: '/test/cwd' }),
        expect.any(Function)
      );
    });

    it('应该获取当前工作目录', async () => {
      const cwd = process.cwd();
      const result = await fileTool.getCwd();

      expect(result).toBe(cwd);
    });
  });

  describe('ReadFileTool', () => {
    let tool: ReadFileTool;

    beforeEach(() => {
      tool = new ReadFileTool();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('应该返回正确的工具定义', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('read_file');
      expect(definition.description).toContain('读取文件');
      expect(definition.inputSchema).toBeDefined();
    });

    it('应该返回正确的 OpenAI 函数格式', () => {
      const openaiFn = tool.getOpenAIFunction();

      expect(openaiFn.type).toBe('function');
      expect(openaiFn.function.name).toBe('read_file');
      expect(openaiFn.function.description).toBeDefined();
      expect(openaiFn.function.parameters).toBeDefined();
    });

    it('应该生成正确的摘要', () => {
      const summary = tool.getSummary({ path: '/test/file.txt' });

      expect(summary).toContain('读取');
      expect(summary).toContain('/test/file.txt');
    });

    it('应该执行读取文件操作', async () => {
      const mockContent = 'File content here';
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await tool.execute({ path: '/test/file.txt' });

      expect(result.content).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
    });

    it('应该处理读取失败', async () => {
      const error = new Error('File not found');
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(tool.execute({ path: '/nonexistent/file.txt' })).rejects.toThrow(
        'File not found'
      );
    });

    it('应该截断过长的路径摘要', () => {
      const longPath = '/very/long/path/that/exceeds/thirty/characters/and/should/be/truncated.txt';
      const summary = tool.getSummary({ path: longPath });

      expect(summary.length).toBeLessThan(longPath.length + 10);
      expect(summary).toContain('...');
    });
  });

  describe('WriteFileTool', () => {
    let tool: WriteFileTool;

    beforeEach(() => {
      tool = new WriteFileTool();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('应该返回正确的工具定义', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('write_file');
      expect(definition.description).toContain('写入文件');
    });

    it('应该返回正确的 OpenAI 函数格式', () => {
      const openaiFn = tool.getOpenAIFunction();

      expect(openaiFn.type).toBe('function');
      expect(openaiFn.function.name).toBe('write_file');
    });

    it('应该生成正确的摘要', () => {
      const summary = tool.getSummary({ path: '/test/output.txt' });

      expect(summary).toContain('写入');
      expect(summary).toContain('/test/output.txt');
    });

    it('应该执行写入文件操作', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await tool.execute({
        path: '/test/file.txt',
        content: 'Test content',
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/file.txt',
        'Test content',
        'utf-8'
      );
    });

    it('应该处理写入失败', async () => {
      const error = new Error('Permission denied');
      vi.mocked(fs.writeFile).mockRejectedValue(error);

      await expect(
        tool.execute({
          path: '/readonly/file.txt',
          content: 'content',
        })
      ).rejects.toThrow('Permission denied');
    });

    it('应该支持写入空内容', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await tool.execute({
        path: '/test/empty.txt',
        content: '',
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith('/test/empty.txt', '', 'utf-8');
    });

    it('应该支持写入大文件内容', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await tool.execute({
        path: '/test/large.txt',
        content: largeContent,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('ListDirTool', () => {
    let tool: ListDirTool;

    beforeEach(() => {
      tool = new ListDirTool();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('应该返回正确的工具定义', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('list_dir');
      expect(definition.description).toContain('列出目录');
    });

    it('应该返回正确的 OpenAI 函数格式', () => {
      const openaiFn = tool.getOpenAIFunction();

      expect(openaiFn.type).toBe('function');
      expect(openaiFn.function.name).toBe('list_dir');
    });

    it('应该生成正确的摘要', () => {
      const summary = tool.getSummary({ path: '/test/directory' });

      expect(summary).toContain('列出目录');
      expect(summary).toContain('/test/directory');
    });

    it('应该执行列出目录操作', async () => {
      const mockEntries = ['file1.txt', 'file2.json', 'subdirectory'];
      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);

      const result = await tool.execute({ path: '/test/dir' });

      expect(result.entries).toEqual(mockEntries);
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
    });

    it('应该处理空目录', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await tool.execute({ path: '/empty/dir' });

      expect(result.entries).toEqual([]);
    });

    it('应该处理目录不存在', async () => {
      const error = new Error('Directory not found');
      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(tool.execute({ path: '/nonexistent/dir' })).rejects.toThrow(
        'Directory not found'
      );
    });

    it('应该处理包含大量文件的目录', async () => {
      const manyEntries = Array.from({ length: 10000 }, (_, i) => `file${i}.txt`);
      vi.mocked(fs.readdir).mockResolvedValue(manyEntries as any);

      const result = await tool.execute({ path: '/large/dir' });

      expect(result.entries).toHaveLength(10000);
    });
  });

  describe('输入验证', () => {
    it('ReadFileTool 应该验证 path 参数', async () => {
      const tool = new ReadFileTool();

      // 测试缺少 path 参数
      await expect(
        (tool.execute as any)({})
      ).rejects.toThrow();
    });

    it('WriteFileTool 应该验证 path 和 content 参数', async () => {
      const tool = new WriteFileTool();

      // 测试缺少参数
      await expect(
        (tool.execute as any)({ path: '/test.txt' })
      ).rejects.toThrow();

      await expect(
        (tool.execute as any)({ content: 'content' })
      ).rejects.toThrow();
    });

    it('ListDirTool 应该验证 path 参数', async () => {
      const tool = new ListDirTool();

      await expect(
        (tool.execute as any)({})
      ).rejects.toThrow();
    });
  });

  describe('边界情况', () => {
    it('应该处理特殊字符路径', async () => {
      const tool = new ReadFileTool();
      const specialPath = '/path/with spaces/and-special@chars/file.txt';

      vi.mocked(fs.readFile).mockResolvedValue('content');

      const result = await tool.execute({ path: specialPath });

      expect(result.content).toBe('content');
      expect(fs.readFile).toHaveBeenCalledWith(specialPath, 'utf-8');
    });

    it('应该处理 Unicode 文件名', async () => {
      const tool = new ReadFileTool();
      const unicodePath = '/path/测试文件.txt';

      vi.mocked(fs.readFile).mockResolvedValue('中文内容');

      const result = await tool.execute({ path: unicodePath });

      expect(result.content).toBe('中文内容');
    });

    it('应该处理相对路径', async () => {
      const tool = new ReadFileTool();
      const relativePath = './relative/file.txt';

      vi.mocked(fs.readFile).mockResolvedValue('relative content');

      const result = await tool.execute({ path: relativePath });

      expect(result.content).toBe('relative content');
    });
  });
});
