/**
 * Prism Agent SDK Basic Usage Example
 * Prism Agent SDK 基本使用示例
 *
 * Before running, configure your LLM provider:
 * 运行前请先配置 LLM 提供商：
 * 1. Create ~/.prism-agent/config.json
 * 2. See examples/config.example.json for config format
 */

import { PrismAgentSDK } from '../src';
import * as path from 'path';
import * as os from 'os';

async function main() {
  console.log('=== Prism Agent SDK Basic Usage Example ===\n');
  // console.log('=== Prism Agent SDK 基本使用示例 ===\n');

  // 1. Initialize SDK / 初始化 SDK
  const configDir = path.join(os.homedir(), '.prism-agent');
  const sdk = new PrismAgentSDK({
    workingDir: process.cwd(),
    configDir: configDir,
    logLevel: 'info',
  });

  console.log('SDK initialized / SDK 初始化完成');

  // Check for available providers / 检查是否有可用的 Provider
  const providers = sdk.providers.list();
  if (providers.length === 0) {
    console.error('\nError: No LLM providers configured');
    console.error('错误: 没有配置任何 LLM 提供商');
    console.error('See examples/config.example.json to create config file');
    console.error('请参考 examples/config.example.json 创建配置文件');
    console.error(`Config path / 配置文件路径: ${configDir}/config.json`);
    await sdk.close();
    process.exit(1);
  }

  console.log(`Available providers / 可用 Provider: ${providers.join(', ')}`);
  console.log(`Current provider / 当前 Provider: ${sdk.providers.getCurrent().name}\n`);

  try {
    // 2. Create session / 创建会话
    const session = await sdk.sessions.create({
      title: 'Example Session',
    });
    console.log(`Session created / 会话已创建: ${session.id}\n`);

    // 3. Set up event listeners / 设置事件监听
    // Text events / 文本事件
    session.on('text:start', () => {
      console.log('--- Text generation started / 开始生成文本 ---');
    });

    session.on('text:delta', (data) => {
      process.stdout.write(data.delta || '');
    });

    session.on('text:done', () => {
      console.log('\n--- Text generation completed / 文本生成完成 ---\n');
    });

    // Reasoning events / 推理事件
    session.on('reasoning:start', () => {
      console.log('[Reasoning] Thinking... / [推理] 开始思考...');
    });

    session.on('reasoning:delta', (data) => {
      console.log(`[Reasoning] ${data.delta}`);
    });

    session.on('reasoning:done', () => {
      console.log('[Reasoning] Done / [推理] 思考完成\n');
    });

    // Tool call events / 工具调用事件
    session.on('tool:call:start', (data) => {
      console.log(`[Tool] Calling tool / [工具] 调用工具: ${data.toolName}`);
    });

    session.on('tool:call:done', (data) => {
      console.log(`[Tool] ${data.toolName} completed / 执行完成`);
    });

    // Tool execution events / 工具执行事件
    session.on('tool:execute:start', (data) => {
      console.log(`[Tool] Executing / [工具] 开始执行: ${data.toolName}`);
    });

    session.on('tool:execute:done', (data) => {
      console.log(`[Tool] ${data.toolName} done / 执行完成`);
    });

    session.on('tool:execute:error', (data) => {
      console.error(`[Tool] ${data.toolName} error / 执行错误: ${data.error}`);
    });

    // 4. Send message / 发送消息
    console.log('Sending message: "Hello, introduce yourself"\n');
    const response = await session.sendMessage('Hello, introduce yourself');

    console.log('\n=== Response Info / 响应信息 ===');
    console.log(`Finish Reason: ${response.finishReason}`);
    console.log(`Model: ${response.model}`);
    if (response.usage) {
      console.log(`Token usage / Token 使用: ${JSON.stringify(response.usage)}`);
    }

    // 5. Get session state / 获取会话状态
    const state = session.getState();
    console.log(`\nSession state / 会话状态:`);
    console.log(`  Session ID: ${state.sessionId}`);
    console.log(`  Project ID: ${state.projectId}`);
    console.log(`  Processing / 处理中: ${state.processingState.isProcessing}`);

    // 6. Cleanup / 清理资源
    await session.close();
    console.log('\nSession closed / 会话已关闭');

  } finally {
    // 7. Close SDK / 关闭 SDK
    await sdk.close();
    console.log('SDK closed / SDK 已关闭');
  }
}

main().catch((error) => {
  console.error('\nError / 错误:', error);
  process.exit(1);
});
