# Vercel AI Provider & Event System Refactor Design

**Date:** 2026-03-25
**Status:** Approved
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

| Vercel AI 回调 | PartEntity 操作 | SDK 公共事件 |
|---|---|---|
| `onTextDelta` | `textPart.appendDelta(delta)` | `text:delta` |
| `onReasoning` | `reasoningPart.appendDelta(delta)` | `reasoning:delta` |
| `onToolCall` | `toolPart.setToolCall(toolCall)` | `tool:call:start` |
| `onToolResult` | `toolPart.setResult(result)` | `tool:call:done` |
| `onToolError` | `toolPart.setError(error)` | `tool:error` |
| `onStepStart` | — | `step:start` |
| `onStepFinish` | — | `step:finish` |
| `onError` | — | `agent:error` |
| `streamText` 完成 | `textPart.complete()` | `agent:done` |

## Component Changes

### Delete

| Component | Reason |
|-----------|--------|
| `src/providers/` (entire directory) | Replaced by Vercel AI built-in providers |
| `src/agent/StreamProcessor.ts` | Logic moved to AgentLoop via `streamText()` |
| `src/events/EventBus.ts` | Only used by PartEntity, which no longer emits events |

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
class ToolRegistry {
  toVercelAITools(): AIJS.ManagedTools {
    const tools = this.getTools();
    const result: AIJS.ManagedTools = {};
    for (const tool of tools) {
      result[tool.name] = {
        description: tool.description,
        parameters: tool.inputSchema, // JSON Schema
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
│   └── EventBus.ts            # DELETE (or repurpose for app-level events)
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

None — all decisions confirmed with user.
