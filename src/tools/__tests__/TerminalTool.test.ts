/**
 * TerminalTool 单元测试
 *
 * 测试终端命令工具的功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExecCommandTool, TerminalTool } from '../TerminalTool';

describe('TerminalTool', () => {
  describe('TerminalTool 类', () => {
    let tool: TerminalTool;

    beforeEach(() => {
      tool = new TerminalTool();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('应该执行命令并返回输出', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: 'command output', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execCommand('echo test');

      expect(result).toEqual(mockResult);
      expect(mockExec).toHaveBeenCalledWith('echo test', {}, expect.any(Function));
    });

    it('应该支持指定工作目录', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: 'output', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      await tool.execCommand('pwd', '/custom/cwd');

      expect(mockExec).toHaveBeenCalledWith(
        'pwd',
        expect.objectContaining({ cwd: '/custom/cwd' }),
        expect.any(Function)
      );
    });

    it('应该处理命令执行错误', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockError = new Error('Command failed');
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(mockError, '', 'error output');
        return {} as any;
      });

      await expect(tool.execCommand('invalid command')).rejects.toThrow('Command failed');
    });

    it('应该返回 stderr 输出', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: '', stderr: 'error message' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execCommand('command');

      expect(result.stderr).toBe('error message');
    });

    it('应该处理带有 stdout 和 stderr 的命令', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = {
        stdout: 'standard output',
        stderr: 'standard error',
      };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execCommand('mixed command');

      expect(result.stdout).toBe('standard output');
      expect(result.stderr).toBe('standard error');
    });
  });

  describe('ExecCommandTool', () => {
    let tool: ExecCommandTool;

    beforeEach(() => {
      tool = new ExecCommandTool();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('应该返回正确的工具定义', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('exec_command');
      expect(definition.description).toContain('执行终端命令');
      expect(definition.inputSchema).toBeDefined();
    });

    it('应该返回正确的 OpenAI 函数格式', () => {
      const openaiFn = tool.getOpenAIFunction();

      expect(openaiFn.type).toBe('function');
      expect(openaiFn.function.name).toBe('exec_command');
      expect(openaiFn.function.description).toBeDefined();
      expect(openaiFn.function.parameters).toBeDefined();
    });

    it('应该生成正确的摘要', () => {
      const summary = tool.getSummary({ command: 'ls -la' });

      expect(summary).toContain('执行');
      expect(summary).toContain('ls -la');
    });

    it('应该截断过长的命令摘要', () => {
      const longCommand = 'echo ' + 'very-long-text '.repeat(10);
      const summary = tool.getSummary({ command: longCommand });

      expect(summary.length).toBeLessThan(longCommand.length + 10);
      expect(summary).toContain('...');
    });

    it('应该执行命令并返回输出', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: 'output', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'echo hello' });

      expect(result.stdout).toBe('output');
      expect(result.stderr).toBe('');
      expect(mockExec).toHaveBeenCalledWith(
        'echo hello',
        {},
        expect.any(Function)
      );
    });

    it('应该处理命令执行失败', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const error = new Error('Command not found');
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(error, '', 'command not found');
        return {} as any;
      });

      await expect(tool.execute({ command: 'nonexistent_cmd' })).rejects.toThrow(
        'Command not found'
      );
    });

    it('应该处理返回 stderr 的命令', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: '', stderr: 'Warning message' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'warning-command' });

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Warning message');
    });

    it('应该处理空输出命令', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: '', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'true' });

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('应该处理包含特殊字符的命令', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: 'output', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'echo "test with spaces && quotes"' });

      expect(result.stdout).toBe('output');
      expect(mockExec).toHaveBeenCalledWith(
        'echo "test with spaces && quotes"',
        {},
        expect.any(Function)
      );
    });

    it('应该处理管道命令', async () => {
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: 'filtered output', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'cat file.txt | grep pattern' });

      expect(result.stdout).toBe('filtered output');
    });
  });

  describe('输入验证', () => {
    it('应该验证 command 参数', async () => {
      const tool = new ExecCommandTool();

      await expect((tool.execute as any)({})).rejects.toThrow();
    });

    it('应该接受空命令字符串', async () => {
      const tool = new ExecCommandTool();
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, '', '');
        return {} as any;
      });

      const result = await tool.execute({ command: '' });

      expect(result.stdout).toBe('');
    });
  });

  describe('边界情况', () => {
    it('应该处理超长输出', async () => {
      const tool = new ExecCommandTool();
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const longOutput = 'x'.repeat(1000000); // 1MB
      const mockResult = { stdout: longOutput, stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'generate-large-output' });

      expect(result.stdout.length).toBe(1000000);
    });

    it('应该处理包含换行符的输出', async () => {
      const tool = new ExecCommandTool();
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const multiLineOutput = 'line1\nline2\nline3';
      const mockResult = { stdout: multiLineOutput, stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'ls' });

      expect(result.stdout).toBe(multiLineOutput);
    });

    it('应该处理包含 Unicode 的输出', async () => {
      const tool = new ExecCommandTool();
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const unicodeOutput = '你好世界 🌍\nこんにちは';
      const mockResult = { stdout: unicodeOutput, stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      const result = await tool.execute({ command: 'echo-unicode' });

      expect(result.stdout).toBe(unicodeOutput);
    });
  });

  describe('安全性', () => {
    it('应该允许执行危险命令（由调用者控制）', async () => {
      const tool = new ExecCommandTool();
      const { exec } = require('child_process');
      const mockExec = vi.mocked(exec);

      const mockResult = { stdout: '', stderr: '' };
      mockExec.mockImplementation((cmd: string, options: any, callback: any) => {
        callback(null, mockResult.stdout, mockResult.stderr);
        return {} as any;
      });

      // 工具本身不进行安全过滤，由调用者负责
      await expect(
        tool.execute({ command: 'rm -rf /' })
      ).resolves.toBeDefined();

      expect(mockExec).toHaveBeenCalledWith('rm -rf /', {}, expect.any(Function));
    });
  });
});
