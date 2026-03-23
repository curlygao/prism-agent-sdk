# Prism Agent SDK Examples / Prism Agent SDK 示例

This directory contains usage examples for Prism Agent SDK.
本目录包含 Prism Agent SDK 的使用示例。

---

## Quick Start / 快速开始

### 1. Configure LLM Provider / 配置 LLM 提供商

SDK requires an LLM provider configuration to work. Create a config file based on `config.example.json`:
SDK 需要配置 LLM 提供商才能工作。请参考 `config.example.json` 创建配置文件：

```bash
# Create config directory / 创建配置目录
mkdir -p ~/.prism-agent

# Copy config template / 复制配置文件模板
cp examples/config.example.json ~/.prism-agent/config.json

# Edit config file with your API Key / 编辑配置文件，填入您的 API Key
vim ~/.prism-agent/config.json
```

Supported LLM providers / 支持的 LLM 提供商：
- **Zhipu AI (zhipu)** - Recommended, default model glm-4 / 推荐，默认模型 glm-4
- **OpenAI** - GPT-4 series / GPT-4 系列
- **Anthropic** - Claude 3.5 series / Claude 3.5 系列
- **DeepSeek** - DeepSeek V2
- **OpenRouter** - Aggregates multiple models / 聚合多个模型

### 2. Run Examples / 运行示例

```bash
# Build project / 构建项目
npm run build

# Run basic example / 运行基本示例
npx tsx examples/basic-usage.ts
```

---

## Examples / 示例说明

### basic-usage.ts

Demonstrates basic SDK usage:
演示 SDK 的基本用法：

- Initialize SDK / 初始化 SDK
- Create session / 创建会话
- Send message / 发送消息
- Listen to events (text generation, reasoning, tool calls) / 监听事件（文本生成、推理、工具调用）
- Process response / 处理响应
- Resource cleanup / 资源清理

---

## Configuration / 配置说明

Config file is located at `~/.prism-agent/config.json`.
配置文件位于 `~/.prism-agent/config.json`。

```json
{
  "agents": {
    "defaults": {
      "model": "anthropic/MiniMax-M2.7-highspeed",  // Model format: provider/model-name
      "maxTokens": 8192,       // Max tokens / 最大 Token 数
      "temperature": 0.7,       // Temperature / 温度参数
      "maxIterations": 20       // Max agent iterations / Agent 最大迭代次数
    }
  },
  "providers": {
    "anthropic": {
      "apiKey": "your-api-key",
      "apiBase": "https://api.anthropic.com",  // Optional / 可选
      "model": "claude-3-5-sonnet-20241022"
    }
  },
  "tools": {
    "filesystem": { "enabled": true },
    "terminal": { "enabled": true, "timeoutSeconds": 60 },
    "web": { "enabled": true }
  }
}
```

---

## Built-in Tools / 内置工具

SDK provides the following built-in tools:
SDK 提供以下内置工具：

| Tool | Description / 说明 |
|------|-------------------|
| read_file | Read file content / 读取文件内容 |
| write_file | Write file content / 写入文件内容 |
| list_dir | List directory contents / 列出目录内容 |
| exec_command | Execute terminal commands / 执行终端命令 |
| http_get | Send HTTP GET request / 发送 HTTP GET 请求 |

---

## Event System / 事件系统

### Session Events / 会话事件

```typescript
// Text events / 文本事件
session.on('text:start', () => {});
session.on('text:delta', (data) => { /* data.delta: string */ });
session.on('text:done', () => {});

// Reasoning events / 推理事件
session.on('reasoning:start', () => {});
session.on('reasoning:delta', (data) => { /* data.delta: string */ });
session.on('reasoning:done', () => {});

// Tool call events / 工具调用事件
session.on('tool:call:start', (data) => { /* data.toolName, data.args */ });
session.on('tool:call:done', (data) => { /* data.toolName, data.result */ });

// Tool execution events / 工具执行事件
session.on('tool:execute:start', (data) => { /* data.toolName */ });
session.on('tool:execute:done', (data) => { /* data.toolName, data.result */ });
session.on('tool:execute:error', (data) => { /* data.toolName, data.error */ });

// Agent events / Agent 事件
session.on('agent:done', (data) => { /* data.response: AgentResponse */ });
session.on('agent:error', (data) => { /* data.error: Error */ });
```

---

## Error Handling / 错误处理

```typescript
import { SessionNotFoundError, SessionClosedError, SessionBusyError } from '@curlygao/prism-agent-sdk/sdk';

try {
  const session = await sdk.sessions.get('session-id');
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.error('Session not found / 会话不存在');
  } else if (error instanceof SessionClosedError) {
    console.error('Session is closed / 会话已关闭');
  } else if (error instanceof SessionBusyError) {
    console.error('Session is busy / 会话正忙');
  }
}
```
