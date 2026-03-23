/**
 * 终端命令工具
 *
 * 提供执行终端命令的功能
 * 使用 Node.js 原生 child_process API
 * 支持 Windows 系统编码
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './BaseTool';
import { z } from 'zod';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * 检测是否为 Windows 系统
 */
function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * 终端工具类 - 直接使用 Node.js 原生 API
 * 支持 Windows 系统的编码处理
 */
export class TerminalTool {
  /**
   * 执行命令
   * 在 Windows 上自动处理编码问题
   */
  async execCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
    // Windows 系统：使用 chcp 65001 切换到 UTF-8 编码
    if (isWindows()) {
      try {
        // 先切换到 UTF-8，然后执行命令
        const result = await execAsync(`chcp 65001 >nul & ${command}`, {
          cwd,
          encoding: 'utf-8',
        });
        return result;
      } catch (error: any) {
        // 如果 UTF-8 失败，尝试系统默认编码
        const result = await execAsync(command, { cwd });
        return {
          stdout: result.stdout,
          stderr: result.stderr,
        };
      }
    }

    // Unix/Linux/macOS 系统：直接执行
    return await execAsync(command, { cwd, encoding: 'utf-8' });
  }
}

/**
 * 执行命令工具（BaseTool 风格）
 */
export class ExecCommandTool extends BaseTool<
  { command: string },
  { stdout: string; stderr: string }
> {
  name = 'exec_command';
  description = isWindows()
    ? '执行终端命令并返回输出。Windows 系统：使用 dir 查看目录，cd 查看当前路径。'
    : '执行终端命令并返回输出。用于运行 shell 命令、编译代码等操作。';
  summaryTemplate = '执行 {{command}}';

  inputSchema = z.object({
    command: z.string().describe('要执行的命令'),
  });

  async execute(input: { command: string }): Promise<{ stdout: string; stderr: string }> {
    const terminalTool = new TerminalTool();
    return await terminalTool.execCommand(input.command);
  }
}
