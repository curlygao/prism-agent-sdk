# Vercel AI Provider & Event System Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom provider implementations with Vercel AI SDK `streamText()`, eliminate duplicate tool-call accumulation code, maintain existing SDK event architecture.

**Architecture:** Use Vercel AI SDK as the core streaming engine. AgentLoop controls tool execution via `toolExecution: 'manual'`. PartEntity becomes pure data entity without events. Provider instances cached for performance.

**Tech Stack:** Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`), TypeScript, Vitest

---

## File Structure

### New Files
- `src/vercelai/VercelAIManager.ts` — Provider/Model 缓存管理

### Modified Files
- `src/agent/AgentLoop.ts` — 重构使用 `streamText()`
- `src/tools/ToolRegistry.ts` — 添加 `toVercelAITools()` 方法
- `src/parts/PartEntity.ts` — 移除 EventBus 导入和 emit* 方法
- `src/parts/TextPartEntity.ts` — 移除 emit 方法
- `src/parts/ReasoningPartEntity.ts` — 移除 emit 方法
- `src/parts/ToolPartEntity.ts` — 移除 emit 方法
- `src/sdk/SessionHandle.ts` — 适配新 AgentLoop 接口
- `package.json` — 添加 Vercel AI SDK 依赖

### Deleted Files
- `src/providers/` (整个目录)
- `src/agent/StreamProcessor.ts`

---

## Task 1: Install Vercel AI SDK Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json with Vercel AI dependencies**

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/google": "^1.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Vercel AI SDK dependencies"
```

---

## Task 2: Create VercelAIManager

**Files:**
- Create: `src/vercelai/VercelAIManager.ts`
- Create: `src/vercelai/index.ts`

- [ ] **Step 1: Create VercelAIManager class**

```typescript
// src/vercelai/VercelAIManager.ts

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModelV1 } from 'ai';
import type { AI } from 'ai';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class VercelAIManager {
  private providerCache = new Map<string, AI>();
  private modelCache = new Map<string, LanguageModelV1>();

  /**
   * 获取 LanguageModel 实例
   */
  getModel(provider: string, model: string, config: ProviderConfig): LanguageModelV1 {
    // 1. 获取或创建 Provider 实例
    let aiProvider = this.providerCache.get(provider);
    if (!aiProvider) {
      aiProvider = this.createProvider(provider, config);
      this.providerCache.set(provider, aiProvider);
    }

    // 2. 获取或创建 Model 实例
    const modelKey = `${provider}:${model}`;
    let languageModel = this.modelCache.get(modelKey);
    if (!languageModel) {
      languageModel = aiProvider.languageModel(model);
      this.modelCache.set(modelKey, languageModel);
    }

    return languageModel;
  }

  /**
   * 创建 Provider 实例
   */
  private createProvider(provider: string, config: ProviderConfig): AI {
    switch (provider) {
      case 'openai':
        return createOpenAI({
          apiKey: config.apiKey || process.env.OPENAI_API_KEY,
          baseURL: config.baseUrl,
        });
      case 'anthropic':
        return createAnthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          baseURL: config.baseUrl,
        });
      case 'google':
        return createGoogleGenerativeAI({
          apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
        });
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * 解析 model 字符串，提取 provider 和 model name
   * 例如: "anthropic/claude-3-5-sonnet" -> { provider: "anthropic", model: "claude-3-5-sonnet" }
   */
  parseModel(model: string): { provider: string; model: string } {
    const [provider, ...rest] = model.split('/');
    return {
      provider,
      model: rest.join('/'),
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.providerCache.clear();
    this.modelCache.clear();
  }
}

// Singleton instance
export const vercelAIManager = new VercelAIManager();
```

- [ ] **Step 2: Create index file**

```typescript
// src/vercelai/index.ts

export { VercelAIManager, vercelAIManager } from './VercelAIManager';
export type { ProviderConfig } from './VercelAIManager';
```

- [ ] **Step 3: Commit**

```bash
git add src/vercelai/VercelAIManager.ts src/vercelai/index.ts
git commit -m "feat: add VercelAIManager for provider/model caching"
```

---

## Task 3: Update ToolRegistry with toVercelAITools()

**Files:**
- Modify: `src/tools/ToolRegistry.ts:60-62`

- [ ] **Step 1: Add toVercelAITools() method to ToolRegistry**

Add after `getOpenAIFunctions()` method (around line 62):

```typescript
  /**
   * 转换为 Vercel AI SDK 工具格式
   */
  toVercelAITools(): Record<string, {
    description: string;
    parameters: any;
  }> {
    const tools = Array.from(this.tools.values());
    const result: Record<string, { description: string; parameters: any }> = {};

    for (const tool of tools) {
      const openAIFunc = tool.getOpenAIFunction();
      result[tool.name] = {
        description: openAIFunc.function.description,
        parameters: openAIFunc.function.parameters,
      };
    }

    return result;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/ToolRegistry.ts
git commit -m "feat: add toVercelAITools() method to ToolRegistry"
```

---

## Task 4: Refactor PartEntity - Remove EventBus

**Files:**
- Modify: `src/parts/PartEntity.ts`

- [ ] **Step 1: Remove EventBus import and emit* methods**

Remove lines 8 (eventBus import) and lines 48-93 (emitCreated, emitUpdated, emitCompleted methods).

The file should look like:

```typescript
/**
 * Part Entity 基类
 *
 * 提供所有 Part Entity 的通用功能
 */

import { randomUUID } from 'crypto';
import type { Part } from '../types/parts';

/**
 * Part Entity 基类
 */
export abstract class PartEntity<T extends Part> {
  protected part: T;

  constructor(part: T) {
    this.part = part;
  }

  /**
   * 获取 Part 实例
   */
  get(): T {
    return this.part;
  }

  /**
   * 获取 Part ID
   */
  getId(): string {
    return this.part.id;
  }

  /**
   * 生成唯一 ID
   */
  static generateId(): string {
    return randomUUID();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/parts/PartEntity.ts
git commit -m "refactor: remove EventBus and emit methods from PartEntity"
```

---

## Task 5: Refactor PartEntity subclasses - Remove emit methods

**Files:**
- Modify: `src/parts/TextPartEntity.ts`
- Modify: `src/parts/ReasoningPartEntity.ts`
- Modify: `src/parts/ToolPartEntity.ts`

- [ ] **Step 1: Refactor TextPartEntity**

Remove lines 32 (`entity.emitCreated();`) and 42 (`this.emitUpdated();`), 53 (`this.emitCompleted();`), 61 (`this.emitUpdated();`), 69 (`this.emitUpdated();`), 79 (`this.emitCompleted();`).

```typescript
// src/parts/TextPartEntity.ts

import { PartEntity } from './PartEntity';
import type { TextPart } from '../types/parts';

export class TextPartEntity extends PartEntity<TextPart> {
  static create(params: {
    messageId: string;
    sessionId: string;
    text?: string;
  }): TextPartEntity {
    const part: TextPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'text',
      text: params.text || '',
      createdAt: Date.now(),
      time: {
        start: Date.now(),
      },
    };

    return new TextPartEntity(part);
  }

  appendDelta(delta: string): void {
    this.part.text += delta;
    (this.part as any).delta = delta;
  }

  setText(text: string): void {
    this.part.text = text;
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
  }

  setSynthetic(value: boolean = true): void {
    this.part.synthetic = value;
  }

  setIgnored(value: boolean = true): void {
    this.part.ignored = value;
  }

  complete(): void {
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
  }
}
```

- [ ] **Step 2: Refactor ReasoningPartEntity**

```typescript
// src/parts/ReasoningPartEntity.ts

import { PartEntity } from './PartEntity';
import type { ReasoningPart } from '../types/parts';

export class ReasoningPartEntity extends PartEntity<ReasoningPart> {
  static create(params: {
    messageId: string;
    sessionId: string;
    text?: string;
  }): ReasoningPartEntity {
    const part: ReasoningPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'reasoning',
      text: params.text || '',
      createdAt: Date.now(),
      time: {
        start: Date.now(),
      },
    };

    return new ReasoningPartEntity(part);
  }

  appendDelta(delta: string): void {
    this.part.text += delta;
    (this.part as any).delta = delta;
  }

  complete(): void {
    if (this.part.time) {
      this.part.time.end = Date.now();
    }
  }
}
```

- [ ] **Step 3: Refactor ToolPartEntity**

```typescript
// src/parts/ToolPartEntity.ts

import { PartEntity } from './PartEntity';
import type { ToolPart, ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError } from '../types/parts';

export class ToolPartEntity extends PartEntity<ToolPart> {
  static create(params: {
    messageId: string;
    sessionId: string;
    callId: string;
    tool: string;
  }): ToolPartEntity {
    const part: ToolPart = {
      id: PartEntity.generateId(),
      messageId: params.messageId,
      sessionId: params.sessionId,
      type: 'tool',
      callID: params.callId,
      tool: params.tool,
      state: {
        status: 'pending',
        input: {},
        raw: '',
      } as ToolStatePending,
    };

    return new ToolPartEntity(part);
  }

  setPending(input: Record<string, any>, raw: string): void {
    this.part.state = {
      status: 'pending',
      input,
      raw,
    };
  }

  setRunning(title?: string): void {
    const state: ToolStateRunning = {
      status: 'running',
      input: this.part.state.status === 'pending' ? this.part.state.input : {},
      title,
      time: {
        start: Date.now(),
      },
    };
    this.part.state = state;
  }

  setCompleted(output: string, title?: string): void {
    const state: ToolStateCompleted = {
      status: 'completed',
      input: this.part.state.status === 'pending' ? this.part.state.input : {},
      output,
      title: title || '',
      time: {
        start: this.part.state.status === 'running' ? this.part.state.time.start : Date.now(),
        end: Date.now(),
      },
    };
    this.part.state = state;
  }

  setError(error: string): void {
    const state: ToolStateError = {
      status: 'error',
      input: this.part.state.status === 'pending' ? this.part.state.input : {},
      error,
      time: {
        start: this.part.state.status === 'running' ? this.part.state.time.start : Date.now(),
        end: Date.now(),
      },
    };
    this.part.state = state;
  }

  getStatus(): string {
    return this.part.state.status;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/parts/TextPartEntity.ts src/parts/ReasoningPartEntity.ts src/parts/ToolPartEntity.ts
git commit -m "refactor: remove emit methods from PartEntity subclasses"
```

---

## Task 6: Refactor AgentLoop - Use streamText()

**Files:**
- Modify: `src/agent/AgentLoop.ts`

- [ ] **Step 1: Rewrite AgentLoop to use streamText()**

This is the core refactor. The new AgentLoop will:

1. Accept `VercelAIManager` instead of `BaseProvider`
2. Use `streamText()` from Vercel AI SDK
3. Handle tool execution via `onToolCall` callback
4. Map Vercel AI events to existing SDK events

```typescript
// src/agent/AgentLoop.ts

import { EventEmitter } from 'eventemitter3';
import { streamText, type CoreMessage } from 'ai';
import type { Message, AgentContext, AgentResponse, AgentOptions } from '../types';
import type { Part, TextPart, ReasoningPart, ToolPart } from '../types/parts';
import type { IStorageAPI } from '../storage/types';
import { ToolRegistry } from '../tools/ToolRegistry';
import { vercelAIManager, VercelAIManager, type ProviderConfig } from '../vercelai';
import { TextPartEntity } from '../parts/TextPartEntity';
import { ReasoningPartEntity } from '../parts/ReasoningPartEntity';
import { ToolPartEntity } from '../parts/ToolPartEntity';

export interface AgentLoopEvents {
  'text:start': (data: { sessionId: string; messageId: string }) => void;
  'text:delta': (data: { sessionId: string; messageId: string; text: string }) => void;
  'text:done': (data: { sessionId: string; messageId: string }) => void;
  'reasoning:start': (data: { sessionId: string; messageId: string }) => void;
  'reasoning:delta': (data: { sessionId: string; messageId: string; text: string }) => void;
  'reasoning:done': (data: { sessionId: string; messageId: string }) => void;
  'tool:call:start': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:call:done': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:execute:start': (data: { sessionId: string; messageId: string; callId: string; toolName: string; arguments: any }) => void;
  'tool:execute:done': (data: { sessionId: string; messageId: string; callId: string; toolName: string; result: any; duration: number }) => void;
  'tool:execute:error': (data: { sessionId: string; messageId: string; callId: string; toolName: string; error: string }) => void;
  'done': () => void;
  'error': (error: Error) => void;
}

export class AgentLoop extends EventEmitter<AgentLoopEvents> {
  private maxIterations: number;
  private toolRegistry: ToolRegistry;
  private vercelAIManager: VercelAIManager;
  private storage: IStorageAPI;

  constructor(
    toolRegistry: ToolRegistry,
    vercelAIManager: VercelAIManager,
    storage: IStorageAPI,
    options: AgentOptions = {}
  ) {
    super();
    this.toolRegistry = toolRegistry;
    this.vercelAIManager = vercelAIManager;
    this.storage = storage;
    this.maxIterations = options.maxIterations ?? 20;
  }

  async processMessage(
    context: AgentContext
  ): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const historyCount = context.history.length;

    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[AgentLoop] 循环 ${i + 1}/${this.maxIterations}, 当前消息数: ${messages.length}`);

      try {
        const response = await this.processStreamWithParts(messages, context, context.workspace);

        console.log(`[AgentLoop] 第 ${i + 1} 轮结果: finishReason=${response.finishReason}`);

        // 检查是否有工具调用
        const hasToolCalls = response.finishReason === 'tool_calls' &&
                            response.message.parts &&
                            response.message.parts.some(p => p.type === 'tool');

        if (!hasToolCalls) {
          this.emit('done');
          context.history = messages.slice(historyCount);
          return response;
        }

        // 有工具调用，继续循环
        console.log(`[AgentLoop] 工具调用完成，当前消息数: ${messages.length}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        throw err;
      }
    }

    context.history = messages.slice(historyCount);
    throw new Error('超过最大迭代次数');
  }

  private async processStreamWithParts(
    messages: Message[],
    context: AgentContext,
    workspace: string
  ): Promise<AgentResponse> {
    const messageId = this.generateId('msg');
    const sessionId = context.sessionId;

    // 创建 PartEntity 实例
    let textPart: TextPartEntity | undefined;
    let reasoningPart: ReasoningPartEntity | undefined;
    let toolPart: ToolPartEntity | undefined;

    // 转换消息格式
    const vercelMessages = this.convertMessages(messages);

    // 解析 model 并获取 LanguageModel
    const { provider, model: modelName } = this.vercelAIManager.parseModel(context.model || 'openai/gpt-4');
    const providerConfig: ProviderConfig = {}; // TODO: 从配置获取
    const languageModel = this.vercelAIManager.getModel(provider, modelName, providerConfig);

    let finishReason: string | undefined;
    let usage: any;

    const result = await streamText({
      model: languageModel,
      messages: vercelMessages,
      system: context.system,
      tools: this.toolRegistry.toVercelAITools(),
      toolExecution: 'manual',
      maxTokens: 4096,

      onTextDelta: (chunk) => {
        if (!textPart) {
          textPart = TextPartEntity.create({ messageId, sessionId });
          this.emit('text:start', { sessionId, messageId });
        }
        textPart.appendDelta(chunk.text);
        this.emit('text:delta', { sessionId, messageId, text: chunk.text });
      },

      onReasoning: ({ delta }) => {
        if (!reasoningPart) {
          reasoningPart = ReasoningPartEntity.create({ messageId, sessionId });
          this.emit('reasoning:start', { sessionId, messageId });
        }
        reasoningPart.appendDelta(delta);
        this.emit('reasoning:delta', { sessionId, messageId, text: delta });
      },

      onToolCall: async ({ toolCall }) => {
        const { toolName, args, toolCallId } = toolCall;

        // 创建 ToolPartEntity
        toolPart = ToolPartEntity.create({
          messageId,
          sessionId,
          callId: toolCallId,
          tool: toolName,
        });
        toolPart.setPending(args, JSON.stringify(args));

        this.emit('tool:call:start', { sessionId, messageId, callId: toolCallId, toolName, arguments: args });
        this.emit('tool:execute:start', { sessionId, messageId, callId: toolCallId, toolName, arguments: args });

        // 执行工具
        const startTime = Date.now();
        try {
          const toolResult = await this.toolRegistry.execute(toolName, args, { workspace });

          const duration = Date.now() - startTime;

          if (toolResult.success) {
            toolPart.setCompleted(toolResult.output);
            this.emit('tool:execute:done', {
              sessionId,
              messageId,
              callId: toolCallId,
              toolName,
              result: toolResult.output,
              duration,
            });
          } else {
            toolPart.setError(toolResult.error || 'Unknown error');
            this.emit('tool:execute:error', {
              sessionId,
              messageId,
              callId: toolCallId,
              toolName,
              error: toolResult.error || 'Unknown error',
            });
          }

          // 将工具结果添加到 messages
          const toolMessage: CoreMessage = {
            role: 'tool',
            content: toolResult.output || toolResult.error || '',
            toolCallId,
          };
          messages.push(toolMessage as any);

        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolPart.setError(errorMessage);
          this.emit('tool:execute:error', {
            sessionId,
            messageId,
            callId: toolCallId,
            toolName,
            error: errorMessage,
          });

          // 添加错误结果到 messages
          const toolMessage: CoreMessage = {
            role: 'tool',
            content: `Error: ${errorMessage}`,
            toolCallId,
          };
          messages.push(toolMessage as any);
        }

        this.emit('tool:call:done', { sessionId, messageId, callId: toolCallId, toolName, arguments: args });
      },

      onFinish: (params) => {
        finishReason = params.finishReason;
        usage = params.usage;

        if (textPart) {
          textPart.complete();
          this.emit('text:done', { sessionId, messageId });
        }
        if (reasoningPart) {
          reasoningPart.complete();
          this.emit('reasoning:done', { sessionId, messageId });
        }
      },

      onError: (error) => {
        console.error('[AgentLoop] streamText error:', error);
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      },
    });

    // 完成 streamText 等待
    await result.wait();

    // 构建 assistant message
    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      parts: [],
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    if (textPart) {
      assistantMessage.parts!.push(textPart.get());
    }
    if (reasoningPart) {
      assistantMessage.parts!.push(reasoningPart.get());
    }
    if (toolPart) {
      assistantMessage.parts!.push(toolPart.get());
    }

    if (assistantMessage.parts!.length > 0) {
      messages.push(assistantMessage);
    }

    return {
      message: assistantMessage,
      finishReason: finishReason || 'stop',
      usage,
      model: context.model,
    };
  }

  /**
   * 转换 messages 为 Vercel AI 格式
   */
  private convertMessages(messages: Message[]): CoreMessage[] {
    return messages.map(msg => {
      if (msg.role === 'user') {
        const textPart = msg.parts?.find(p => p.type === 'text') as any;
        return {
          role: 'user',
          content: textPart?.text || '',
        };
      }
      if (msg.role === 'assistant') {
        const textPart = msg.parts?.find(p => p.type === 'text') as any;
        return {
          role: 'assistant',
          content: textPart?.text || '',
        };
      }
      if (msg.role === 'tool') {
        const toolPart = msg.parts?.find(p => p.type === 'tool') as any;
        return {
          role: 'tool',
          content: toolPart?.state?.output || '',
          toolCallId: toolPart?.callID,
        };
      }
      return {
        role: msg.role,
        content: JSON.stringify(msg.parts),
      };
    }) as CoreMessage[];
  }

  private buildMessages(context: AgentContext): Message[] {
    const userMessageId = this.generateId('msg');
    const textPart = {
      id: userMessageId,
      messageId: userMessageId,
      sessionId: context.sessionId,
      type: 'text' as const,
      text: context.currentMessage,
      createdAt: Date.now(),
      time: { start: Date.now() },
    };

    const currentUserMessage: Message = {
      id: userMessageId,
      role: 'user',
      parts: [textPart],
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    return [
      ...context.history,
      currentUserMessage,
    ];
  }

  private generateId(prefix = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setMaxIterations(max: number): void {
    this.maxIterations = max;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/agent/AgentLoop.ts
git commit -m "refactor: rewrite AgentLoop to use Vercel AI streamText()"
```

---

## Task 7: Delete StreamProcessor

**Files:**
- Delete: `src/agent/StreamProcessor.ts`

- [ ] **Step 1: Delete StreamProcessor**

Run: `rm src/agent/StreamProcessor.ts`

- [ ] **Step 2: Commit**

```bash
git rm src/agent/StreamProcessor.ts
git commit -m "refactor: delete StreamProcessor, logic moved to AgentLoop"
```

---

## Task 8: Delete providers directory

**Files:**
- Delete: `src/providers/` (entire directory)

- [ ] **Step 1: Delete providers directory**

Run: `rm -rf src/providers/`

- [ ] **Step 2: Commit**

```bash
git rm -rf src/providers/
git commit -m "refactor: delete custom providers, replaced by Vercel AI SDK"
```

---

## Task 9: Update SessionHandle

**Files:**
- Modify: `src/sdk/SessionHandle.ts:41-56`

- [ ] **Step 1: Update SessionHandle constructor**

Replace `private provider: BaseProvider` with `private vercelAIManager: VercelAIManager`:

```typescript
import { vercelAIManager } from '../vercelai';

constructor(
  sessionId: string,
  projectId: string,
  private storage: IStorageAPI,
  providerConfig: ProviderConfig,  // Changed from BaseProvider
  private toolRegistry: ToolRegistry,
  private eventBus: SDKEventBus,
  private workspace: string
) {
  // ...
  this.agentLoop = new AgentLoop(
    toolRegistry,
    vercelAIManager,
    storage,
    { maxIterations: 20 }
  );
  // ...
}
```

Also update the import to remove `BaseProvider`.

- [ ] **Step 2: Commit**

```bash
git add src/sdk/SessionHandle.ts
git commit -m "refactor: update SessionHandle to use VercelAIManager"
```

---

## Task 10: Run Tests

**Files:**
- Run: `npm test`

- [ ] **Step 1: Run all tests**

Run: `npm test`

- [ ] **Step 2: Fix any failing tests**

Expected changes may be needed in test files that reference removed components.

- [ ] **Step 3: Commit any test fixes**

---

## Task 11: Update exports in index.ts

**Files:**
- Modify: `src/index.ts`
- Modify: `src/sdk/index.ts`

- [ ] **Step 1: Update exports**

Add to `src/index.ts`:
```typescript
export { VercelAIManager, vercelAIManager } from './vercelai';
export type { ProviderConfig } from './vercelai';
```

Add to `src/sdk/index.ts`:
```typescript
export { vercelAIManager } from '../vercelai';
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts src/sdk/index.ts
git commit -m "feat: export VercelAIManager from SDK"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install Vercel AI SDK dependencies |
| 2 | Create VercelAIManager for provider/model caching |
| 3 | Update ToolRegistry with toVercelAITools() |
| 4 | Refactor PartEntity - remove EventBus |
| 5 | Refactor PartEntity subclasses - remove emit methods |
| 6 | Refactor AgentLoop - use streamText() |
| 7 | Delete StreamProcessor |
| 8 | Delete providers directory |
| 9 | Update SessionHandle |
| 10 | Run tests |
| 11 | Update exports |

---

## Notes

- **Context:** This plan is derived from the spec at `docs/superpowers/specs/2026-03-25-vercel-ai-provider-refactor-design.md`
- **Dependencies:** Vercel AI SDK v4.x
- **Breaking Changes:** SessionHandle constructor signature changed (ProviderConfig instead of BaseProvider)
