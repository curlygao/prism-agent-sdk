# Prism Agent SDK

[English](./README.md) | 中文文档

## 概述

Prism Agent SDK 是一个用于构建 AI 助手应用的核心库，提供了会话管理、消息处理、工具调用、存储管理等核心功能。

## 安装

```bash
npm install @curlygao/prism-agent-sdk
```

## 快速开始

### 1. 初始化 SDK

```typescript
import { PrismAgentSDK } from '@curlygao/prism-agent-sdk';

const sdk = new PrismAgentSDK({
  workingDir: '/path/to/workspace',  // 工作目录
  configDir: '~/.prism-agent',      // 配置目录（可选）
  logLevel: 'info',                 // 日志级别（可选）
});
```

### 2. 创建会话并发送消息

```typescript
// 创建新会话
const session = await sdk.sessions.create({
  title: '我的第一个会话',
  projectId: 'optional-project-id'  // 可选
});

// 发送消息
const response = await session.sendMessage('你好，请介绍一下你自己');
console.log('AI 回复:', response);
```

### 3. 监听事件

```typescript
session.on('text:start', () => {
  console.log('开始生成文本...');
});

session.on('text:delta', (data) => {
  process.stdout.write(data.delta);
});

session.on('text:done', () => {
  console.log('\n文本生成完成');
});
```

## 核心模块

### PrismAgentSDK

SDK 的主入口类，包含所有子模块：

```typescript
const sdk = new PrismAgentSDK(options);

sdk.events      // 事件总线
sdk.sessions    // 会话管理器
sdk.tools       // 工具注册表
sdk.storage     // 存储模块
sdk.app         // 应用配置和状态
sdk.providers   // LLM 提供商管理
```

### SessionManager - 会话管理器

管理会话的生命周期：

```typescript
// 创建会话
const session = await sdk.sessions.create({ title: '会话标题' });

// 获取已存在的会话
const existingSession = await sdk.sessions.get('session-id');

// 列出会话
const sessions = await sdk.sessions.list();

// 更新会话
await sdk.sessions.update('session-id', { title: '新标题' });

// 删除会话
await sdk.sessions.delete('session-id');
```

### SessionHandle - 会话句柄

单个会话的交互接口：

```typescript
// 发送消息
const response = await session.sendMessage('用户消息');

// 获取会话状态
const state = session.getState();
console.log('会话 ID:', state.sessionId);

// 监听事件
session.on('text:delta', (data) => process.stdout.write(data.delta));

// 关闭会话
await session.close();
```

## 事件系统

### 会话事件类型

| 事件 | 描述 | 数据格式 |
|------|------|----------|
| `text:start` | 开始生成文本 | - |
| `text:delta` | 文本增量更新 | `{ delta: string }` |
| `text:done` | 文本生成完成 | `{ content: string }` |
| `reasoning:start` | 开始推理 | - |
| `reasoning:delta` | 推理增量更新 | `{ delta: string }` |
| `reasoning:done` | 推理完成 | - |
| `tool:call:start` | 开始调用工具 | `{ toolName: string, args: object }` |
| `tool:call:done` | 工具调用完成 | `{ toolName: string, result: any }` |
| `tool:execute:start` | 开始执行工具 | `{ toolName: string }` |
| `tool:execute:done` | 工具执行完成 | `{ toolName: string, result: any }` |
| `tool:execute:error` | 工具执行错误 | `{ toolName: string, error: Error }` |
| `agent:done` | Agent 处理完成 | `{ response: AgentResponse }` |
| `agent:error` | 发生错误 | `{ error: Error }` |

## 内置工具

- `read_file` - 读取文件内容
- `write_file` - 写入文件内容
- `list_dir` - 列出目录内容
- `exec_command` - 执行终端命令
- `http_get` - 发送 HTTP GET 请求

## LLM 提供商管理

```typescript
// 列出可用的提供商
const providers = sdk.providers.list();

// 获取当前提供商
const currentProvider = sdk.providers.getCurrent();

// 切换提供商
sdk.providers.switch('openai');
```

## 完整示例

```typescript
import { PrismAgentSDK } from '@curlygao/prism-agent-sdk';

async function main() {
  const sdk = new PrismAgentSDK({
    workingDir: process.cwd(),
    configDir: '~/.prism-agent',
    logLevel: 'info',
  });

  try {
    const session = await sdk.sessions.create({ title: '我的会话' });

    session.on('text:delta', (data) => {
      process.stdout.write(data.delta);
    });

    const response = await session.sendMessage('你好');
    console.log('响应:', response.finishReason);

    await session.close();
  } finally {
    await sdk.close();
  }
}

main().catch(console.error);
```

## 错误处理

```typescript
import { SessionNotFoundError, SessionClosedError, SessionBusyError } from '@curlygao/prism-agent-sdk/sdk';

try {
  const session = await sdk.sessions.get('non-existent-id');
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.error('会话不存在');
  } else if (error instanceof SessionClosedError) {
    console.error('会话已关闭');
  } else if (error instanceof SessionBusyError) {
    console.error('会话正忙');
  }
}
```

## 最佳实践

1. **资源清理**：使用完毕后记得调用 `sdk.close()` 释放资源
2. **事件监听**：对于一次性监听，使用 `once()` 而不是 `on()`
3. **错误处理**：始终使用 try-catch 捕获可能的错误
4. **会话管理**：定期清理不需要的会话，避免占用过多存储空间

## 示例

更多示例请参考 [examples](./examples/) 目录。

## 路线图

未来版本计划开发的功能：

- [ ] **上下文压缩** - 添加上下文压缩功能，高效处理更长对话
- [ ] **更多内置工具** - 扩展工具生态系统，增加更多实用工具
- [ ] **MCP 服务支持** - 支持 Model Context Protocol (MCP) 服务

## 许可证

MIT
