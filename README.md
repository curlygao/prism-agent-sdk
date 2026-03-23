# Prism Agent SDK

[中文文档](./README-zh.md) | English

## Overview

Prism Agent SDK is a core library for building AI assistant applications, providing session management, message handling, tool calling, and storage management features.

## Installation

```bash
npm install @curlygao/prism-agent-sdk
```

## Quick Start

### 1. Initialize SDK

```typescript
import { PrismAgentSDK } from '@curlygao/prism-agent-sdk';

const sdk = new PrismAgentSDK({
  workingDir: '/path/to/workspace',  // Working directory
  configDir: '~/.prism-agent',      // Config directory (optional)
  logLevel: 'info',                // Log level (optional)
});
```

### 2. Create Session and Send Message

```typescript
// Create a new session
const session = await sdk.sessions.create({
  title: 'My First Session',
  projectId: 'optional-project-id'  // Optional
});

// Send a message
const response = await session.sendMessage('Hello, introduce yourself');
console.log('AI Response:', response);
```

### 3. Listen to Events

```typescript
session.on('text:start', () => {
  console.log('Text generation started...');
});

session.on('text:delta', (data) => {
  process.stdout.write(data.delta);
});

session.on('text:done', () => {
  console.log('\nText generation completed');
});
```

## Core Modules

### PrismAgentSDK

The main entry point class containing all sub-modules:

```typescript
const sdk = new PrismAgentSDK(options);

sdk.events      // Event bus
sdk.sessions    // Session manager
sdk.tools       // Tool registry
sdk.storage     // Storage module
sdk.app         // App config and state
sdk.providers   // LLM provider management
```

### SessionManager

Manages session lifecycle:

```typescript
// Create session
const session = await sdk.sessions.create({ title: 'Session Title' });

// Get existing session
const existingSession = await sdk.sessions.get('session-id');

// List sessions
const sessions = await sdk.sessions.list();

// Update session
await sdk.sessions.update('session-id', { title: 'New Title' });

// Delete session
await sdk.sessions.delete('session-id');
```

### SessionHandle

Interface for interacting with a single session:

```typescript
// Send message
const response = await session.sendMessage('User message');

// Get session state
const state = session.getState();
console.log('Session ID:', state.sessionId);

// Listen to events
session.on('text:delta', (data) => process.stdout.write(data.delta));

// Close session
await session.close();
```

## Event System

### Session Event Types

| Event | Description | Data |
|-------|-------------|------|
| `text:start` | Text generation started | - |
| `text:delta` | Text delta update | `{ delta: string }` |
| `text:done` | Text generation completed | `{ content: string }` |
| `reasoning:start` | Reasoning started | - |
| `reasoning:delta` | Reasoning delta update | `{ delta: string }` |
| `reasoning:done` | Reasoning completed | - |
| `tool:call:start` | Tool call started | `{ toolName: string, args: object }` |
| `tool:call:done` | Tool call completed | `{ toolName: string, result: any }` |
| `tool:execute:start` | Tool execution started | `{ toolName: string }` |
| `tool:execute:done` | Tool execution completed | `{ toolName: string, result: any }` |
| `tool:execute:error` | Tool execution error | `{ toolName: string, error: Error }` |
| `agent:done` | Agent processing completed | `{ response: AgentResponse }` |
| `agent:error` | Error occurred | `{ error: Error }` |

## Built-in Tools

- `read_file` - Read file content
- `write_file` - Write file content
- `list_dir` - List directory contents
- `exec_command` - Execute terminal commands
- `http_get` - Send HTTP GET requests

## LLM Provider Management

```typescript
// List available providers
const providers = sdk.providers.list();

// Get current provider
const currentProvider = sdk.providers.getCurrent();

// Switch provider
sdk.providers.switch('openai');
```

## Complete Example

```typescript
import { PrismAgentSDK } from '@curlygao/prism-agent-sdk';

async function main() {
  const sdk = new PrismAgentSDK({
    workingDir: process.cwd(),
    configDir: '~/.prism-agent',
    logLevel: 'info',
  });

  try {
    const session = await sdk.sessions.create({ title: 'My Session' });

    session.on('text:delta', (data) => {
      process.stdout.write(data.delta);
    });

    const response = await session.sendMessage('Hello');
    console.log('Response:', response.finishReason);

    await session.close();
  } finally {
    await sdk.close();
  }
}

main().catch(console.error);
```

## Error Handling

```typescript
import { SessionNotFoundError, SessionClosedError, SessionBusyError } from '@curlygao/prism-agent-sdk/sdk';

try {
  const session = await sdk.sessions.get('non-existent-id');
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.error('Session not found');
  } else if (error instanceof SessionClosedError) {
    console.error('Session is closed');
  } else if (error instanceof SessionBusyError) {
    console.error('Session is busy');
  }
}
```

## Best Practices

1. **Resource Cleanup**: Call `sdk.close()` to release resources after use
2. **Event Listeners**: Use `once()` for one-time listeners
3. **Error Handling**: Always use try-catch
4. **Session Management**: Regularly clean up unused sessions

## Examples

See [examples](./examples/) directory for more examples.

## Roadmap

Planned features for future releases:

- [ ] **Context Compression** - Add context compression to handle longer conversations efficiently
- [ ] **More Built-in Tools** - Expand the tool ecosystem with additional utility tools
- [ ] **MCP Server Support** - Add support for Model Context Protocol (MCP) services

## License

MIT
