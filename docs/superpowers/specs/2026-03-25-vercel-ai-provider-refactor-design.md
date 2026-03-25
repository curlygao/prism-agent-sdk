# Vercel AI Provider & Event System Refactor Design

**Date:** 2026-03-25
**Status:** Approved (v3)
**Author:** Claude

## Overview

Refactor the Prism Agent SDK to replace custom provider implementations with Vercel AI SDK, leveraging `streamText()` as the core streaming primitive. The goal is to eliminate duplicate tool-call accumulation code, improve streaming reliability, and maintain the existing SDK event architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SessionHandle                                │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  AgentLoop     │  │ SessionEvent    │  │ ContextManager       │  │
│  │                │  │ Emitter         │  │                      │  │
│  │ - streamText() │  │                 │  │ - buildContext()     │  │
│  │ - 内部事件映射  │──│ forwards to     │  │                      │  │
│  │   Vercel AI    │  │ SessionHandle   │  │                      │  │
│  └────────┬───────┘  └─────────────────┘  └──────────────────────┘  │
└───────────┼─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AgentLoop.processMessage()                         │
│                                                                      │
│  const result = await streamText({                                   │
│    model,                                                             │
│    messages,                                                          │
│    system,                                                             │
│    tools: convertTools(ToolRegistry.getTools()),                      │
│    abortSignal,                                                       │
│                                                                      │
│    // 内部事件回调 → PartEntity 更新                                  │
│    onTextDelta: (chunk) => textPart.appendDelta(chunk.text),        │
│    onReasoning: ({ delta }) => reasoningPart.appendDelta(delta),    │
│    onToolCall: (toolCall) => toolPart.setToolCall(toolCall),         │
│    onToolResult: (result) => toolPart.setResult(result),            │
│    onToolError: (error) => toolPart.setError(error),                │
│    onStepStart: (step) => emitInternal('step:start', step),        │
│    onStepFinish: (step) => emitInternal('step:finish', step),      │
│    onError: (error) => emitInternal('agent:error', error),        │
│  });                                                                  │
└─────────────────────────────────────────────────────────────────────┘
            │
            │ Part 更新（纯数据操作，无事件）
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PartEntity (纯数据实体)                             │
│                                                                      │
│  - 数据封装：part: TextPart | ReasoningPart | ToolPart              │
│  - 方法：appendDelta(), complete(), setToolCall(), setResult()      │
│  - 无 EventBus，无 emitCreated/emitUpdated/emitCompleted            │
└─────────────────────────────────────────────────────────────────────┘
            │
            │ 外部 SDK 事件（SessionEventEmitter 转发）
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SDK 公共事件                                        │
│                                                                      │
│  text:start, text:delta, text:done                                   │
│  reasoning:start, reasoning:delta, reasoning:done                   │
│  tool:call:start, tool:call:done, tool:error                        │
│  step:start, step:finish, step:error                                │
│  agent:done, agent:error                                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Event Mapping

### Internal Events (AgentLoop → PartEntity / SessionEventEmitter)

| Vercel AI 回调 | PartEntity 操作 | SDK 公共事件 |
|---|---|---|
| `onTextDelta` | `textPart.appendDelta(delta)` | `text:start` (首次), `text:delta` |
| `onReasoning` | `reasoningPart.appendDelta(delta)` | `reasoning:start` (首次), `reasoning:delta` |
| `onToolCall` | `toolPart.setToolCall(toolCall)` | `tool:call:start` |
| `onToolCallFinished` | `toolPart.setResult(result)` | `tool:call:done` |
| `onToolError` | `toolPart.setError(error)` | `tool:error` |
| `onStepStart` | — | `step:start` |
| `onStepFinish` | — | `step:finish` |
| `onError` | — | `agent:error` |
| `onFinish` | — | `agent:done` (包含 finishReason, usage) |

### 工具执行事件 (由 AgentLoop 在工具执行时产生)

| 事件 | 触发时机 |
|------|---------|
| `tool:execute:start` | 开始执行工具时 |
| `tool:execute:done` | 工具执行成功完成 |
| `tool:execute:error` | 工具执行失败 |
| `tool:call:interrupt` | 当 text/reasoning 内容打断 tool call 生成时 |

### Vercel AI Tool Execution 策略

Vercel AI SDK 的 `streamText()` 默认自动执行工具。本设计采用 **手动工具执行模式**：

```typescript
const result = await streamText({
  model,
  messages,
  system,
  tools: convertTools(ToolRegistry.getTools()),
  toolExecution: 'manual', // 禁用自动执行
  // ...
});
```

这样工具调用会通过 `onToolCall` 回调触发，由 AgentLoop 手动执行并通过 `tool:execute:*` 事件暴露。

## Component Changes

### Delete

| Component | Reason |
|-----------|--------|
| `src/providers/` (entire directory) | Replaced by Vercel AI built-in providers |
| `src/agent/StreamProcessor.ts` | Logic moved to AgentLoop via `streamText()` |

> **Note:** `src/events/EventBus.ts` is NOT deleted because it is also used by `AppStateManager` in the application module.

### Refactor

| Component | Changes |
|-----------|---------|
| `src/agent/AgentLoop.ts` | Use `streamText()` instead of manual streaming loop |
| `src/parts/PartEntity.ts` | Remove EventBus import and all emit* methods |
| `src/parts/TextPartEntity.ts` | Remove emitCreated, emitUpdated, emitCompleted |
| `src/parts/ReasoningPartEntity.ts` | Remove emitCreated, emitUpdated, emitCompleted |
| `src/parts/ToolPartEntity.ts` | Remove emitCreated, emitUpdated, emitCompleted |

### Keep (with modifications)

| Component | Changes |
|-----------|---------|
| `src/tools/ToolRegistry.ts` | Add `toVercelAITools()` method to convert tools to Vercel AI format |
| `src/sdk/SessionHandle.ts` | Adjust event mapping to new internal event names |
| `src/sdk/SessionEventEmitter.ts` | Keep as-is |
| `src/sdk/SDKEventBus.ts` | Keep as-is |

## Tool Conversion

```typescript
// ToolRegistry.toVercelAITools()
// Note: tool.inputSchema is a Zod type, not JSON Schema.
// Use existing zodToJsonSchema() conversion or getOpenAIFunction().function.parameters.
import { zodToJsonSchema } from 'zod-to-json-schema';

class ToolRegistry {
  toVercelAITools(): AIJS.ManagedTools {
    const tools = this.getTools();
    const result: AIJS.ManagedTools = {};
    for (const tool of tools) {
      result[tool.name] = {
        description: tool.description,
        parameters: zodToJsonSchema(tool.inputSchema),
      };
    }
    return result;
  }
}
```

Alternatively, leverage existing `BaseTool.getOpenAIFunction()` which already performs this conversion:

```typescript
class ToolRegistry {
  toVercelAITools(): AIJS.ManagedTools {
    const tools = this.getTools();
    const result: AIJS.ManagedTools = {};
    for (const tool of tools) {
      const openAIFunc = tool.getOpenAIFunction();
      result[tool.name] = {
        description: openAIFunc.function.description,
        parameters: openAIFunc.function.parameters,
      };
    }
    return result;
  }
}
```

## Directory Structure After Refactor

```
src/
├── providers/                    # DELETE - all custom providers
│
├── agent/
│   ├── AgentLoop.ts           # REFACTOR - use streamText()
│   └── StreamProcessor.ts    # DELETE
│
├── parts/
│   ├── PartEntity.ts          # REFACTOR - remove EventBus
│   ├── TextPartEntity.ts      # REFACTOR - remove emit methods
│   ├── ReasoningPartEntity.ts # REFACTOR - remove emit methods
│   └── ToolPartEntity.ts      # REFACTOR - remove emit methods
│
├── events/
│   └── EventBus.ts            # KEEP - used by AppStateManager
│
├── tools/
│   └── ToolRegistry.ts        # KEEP - add toVercelAITools()
│
└── sdk/                        # KEEP - as-is
```

## Key Design Decisions

1. **Vercel AI `streamText()` only** — No `generateText()` or other non-streaming methods
2. **All 6 current providers replaced** — Use Vercel AI built-in providers (`createOpenAI()`, `createAnthropic()`, etc.)
3. **ToolRegistry preserved** — Convert tools to Vercel AI format before calling `streamText()`
4. **PartEntity preserved** — Pure data entity with methods, no events
5. **Dual event architecture** — Internal Vercel AI events → external SDK events
6. **SDK event naming preserved** — Map `text-start` → `text:start`, etc.
7. **Manual tool execution** — Use `toolExecution: 'manual'` to maintain control over tool execution and emit `tool:execute:*` events
8. **Keep EventBus** — Used by `AppStateManager` for application-level events

## Dependencies

```typescript
// New dependency
import { streamText, type AIJS } from 'ai';

// Provider packages (examples)
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
```

## Open Issues

All resolved.

| Issue | Decision |
|-------|----------|
| #1 Provider Configuration | **C**: config 优先，fallback 到环境变量 |
| #2 Message Format Conversion | **C**: 使用 Vercel AI 官方转换（如 `toVercelAI()`） |
| #3 Model Selection | **A**: 保持前缀方式 `anthropic/claude-xxx` → `createAnthropic().model('claude-xxx')` |
| #4 Tool Continuation Flow | 无需改动，现有 AgentLoop for 循环已支持 |

### Provider Configuration Details

```typescript
// Provider 初始化策略
const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

const provider = createOpenAI({
  apiKey,
  baseURL: config.baseUrl || undefined,  // 可选
});
```

### Model Selection Details

```typescript
// 解析 model 前缀
function parseModel(model: string): { provider: string; model: string } {
  const [prefix, ...rest] = model.split('/');
  return { provider: prefix, model: rest.join('/') };
}

// 使用
const { provider, model } = parseModel('anthropic/claude-3-5-sonnet');
const aiProvider = createAnthropic({ apiKey: ... });
const languageModel = aiProvider.languageModel(model);
```
