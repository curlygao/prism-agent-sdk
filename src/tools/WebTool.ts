/**
 * Web 请求工具
 *
 * 提供 HTTP 请求功能
 * 从 src/core/tools/WebTool.ts 迁移并简化
 */

import { BaseTool } from './BaseTool';
import { z } from 'zod';

/**
 * HTTP GET 请求工具（简化版）
 */
export class HttpGetTool extends BaseTool<
  { url: string },
  { status: number; body: string }
> {
  name = 'http_get';
  description = '发送 HTTP GET 请求。用于获取网页内容、调用 API 等。';
  summaryTemplate = '请求 {{url}}';

  inputSchema = z.object({
    url: z.string().describe('请求的 URL'),
  });

  async execute(input: { url: string }): Promise<{
    status: number;
    body: string;
  }> {
    const response = await fetch(input.url);
    const body = await response.text();

    return {
      status: response.status,
      body,
    };
  }
}
