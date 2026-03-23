/**
 * Part 类型定义
 * 从 src/lib/types/parts.ts 迁移
 *
 * 基于 Opencode 的架构设计，消息内容由多个 Part 组成
 * 每个 Part 代表消息中的一个独立内容单元
 */

// ============================================================================
// 基础接口
// ============================================================================

/**
 * Part 基础接口
 * 所有 Part 类型都必须实现这些字段
 */
export interface PartBase {
  /** Part 唯一标识 */
  id: string;
  /** 所属会话 ID */
  sessionId: string;
  /** 所属消息 ID */
  messageId: string;
  /** 创建时间戳 */
  createdAt: number;
}

// ============================================================================
// TextPart - 文本内容
// ============================================================================

/**
 * TextPart - 用户可见的最终文本输出
 */
export interface TextPart extends PartBase {
  /** Part 类型标识 */
  type: 'text';
  /** 文本内容 */
  text: string;
  /** 是否为合成内容（由系统生成，非模型输出） */
  synthetic?: boolean;
  /** 是否被忽略（不显示给用户） */
  ignored?: boolean;
  /** 时间范围 */
  time?: {
    /** 开始时间 */
    start: number;
    /** 结束时间 */
    end?: number;
  };
  /** 元数据 */
  metadata?: Record<string, any>;
}

// ============================================================================
// ReasoningPart - 推理内容
// ============================================================================

/**
 * ReasoningPart - 模型的思考过程（可隐藏/显示）
 * 可能来自模型的原生 reasoning 字段（如 Claude 3.7、DeepSeek-R1）
 * 也可能通过 middleware from <think> 标签中提取
 */
export interface ReasoningPart extends PartBase {
  /** Part 类型标识 */
  type: 'reasoning';
  /** 推理内容文本 */
  text: string;
  /** 时间范围 */
  time: {
    /** 开始时间 */
    start: number;
    /** 结束时间 */
    end?: number;
  };
  /** 提供商元数据（如 reasoning tokens 数量） */
  metadata?: {
    /** 推理 token 数量 */
    reasoningTokens?: number;
    /** 其他提供商特定信息 */
    [key: string]: any;
  };
}

// ============================================================================
// ToolPart - 工具调用
// ============================================================================

/**
 * 工具状态 - Pending
 */
export interface ToolStatePending {
  status: 'pending';
  /** 工具输入参数 */
  input: Record<string, any>;
  /** 原始输入字符串 */
  raw: string;
}

/**
 * 工具状态 - Running
 */
export interface ToolStateRunning {
  status: 'running';
  /** 工具输入参数 */
  input: Record<string, any>;
  /** 工具显示标题（从摘要模板生成） */
  title?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 时间范围 */
  time: {
    /** 开始时间 */
    start: number;
  };
}

/**
 * 工具状态 - Completed
 */
export interface ToolStateCompleted {
  status: 'completed';
  /** 工具输入参数 */
  input: Record<string, any>;
  /** 工具输出结果 */
  output: string;
  /** 工具显示标题 */
  title: string;
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 时间范围 */
  time: {
    /** 开始时间 */
    start: number;
    /** 结束时间 */
    end: number;
  };
  /** 文件附件（如果工具产生文件） */
  attachments?: FilePart[];
}

/**
 * 工具状态 - Error
 */
export interface ToolStateError {
  status: 'error';
  /** 工具输入参数 */
  input: Record<string, any>;
  /** 错误信息 */
  error: string;
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 时间范围 */
  time: {
    /** 开始时间 */
    start: number;
    /** 结束时间 */
    end: number;
  };
}

/**
 * 工具状态联合类型
 */
export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError;

/**
 * ToolPart - 工具调用的完整生命周期
 * 跟踪工具从 pending → running → completed/error 的状态变化
 */
export interface ToolPart extends PartBase {
  /** Part 类型标识 */
  type: 'tool';
  /** 工具调用唯一标识 */
  callID: string;
  /** 工具名称 */
  tool: string;
  /** 工具状态 */
  state: ToolState;
}

// ============================================================================
// FilePart - 文件附件
// ============================================================================

/**
 * FilePart - 文件附件
 */
export interface FilePart extends PartBase {
  /** Part 类型标识 */
  type: 'file';
  /** 文件名 */
  name: string;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件 URL（可能是本地路径或远程 URL） */
  url?: string;
  /** 文件内容（如果是小文件，可以直接存储） */
  content?: string | ArrayBuffer;
  /** 缩略图 URL */
  thumbnailUrl?: string;
}

// ============================================================================
// Part 联合类型
// ============================================================================

/**
 * Part 联合类型
 * 包含所有可能的 Part 类型
 */
export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | FilePart;

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 检查是否为 TextPart
 */
export function isTextPart(part: Part): part is TextPart {
  return part.type === 'text';
}

/**
 * 检查是否为 ReasoningPart
 */
export function isReasoningPart(part: Part): part is ReasoningPart {
  return part.type === 'reasoning';
}

/**
 * 检查是否为 ToolPart
 */
export function isToolPart(part: Part): part is ToolPart {
  return part.type === 'tool';
}

/**
 * 检查是否为 FilePart
 */
export function isFilePart(part: Part): part is FilePart {
  return part.type === 'file';
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取 Part 的显示文本（用于预览）
 */
export function getPartText(part: Part): string {
  switch (part.type) {
    case 'text':
      return part.text;
    case 'reasoning':
      return `[思考] ${part.text.slice(0, 100)}${part.text.length > 100 ? '...' : ''}`;
    case 'tool':
      return `[工具] ${part.tool} - ${part.state.status}`;
    case 'file':
      return `[文件] ${part.name}`;
    default:
      return assertNever(part);
  }
}

/**
 * 检查 Part 是否已完成（不再更新）
 */
export function isPartComplete(part: Part): boolean {
  switch (part.type) {
    case 'text':
      return part.time?.end !== undefined;
    case 'reasoning':
      return part.time.end !== undefined;
    case 'tool':
      return part.state.status === 'completed' || part.state.status === 'error';
    case 'file':
      return true; // 文件一旦创建就是完整的
    default:
      return assertNever(part);
  }
}

/**
 * 获取 Part 的状态描述
 */
export function getPartStatus(part: Part): string {
  switch (part.type) {
    case 'text':
      return part.time?.end ? '已完成' : '生成中';
    case 'reasoning':
      return part.time.end ? '已完成' : '思考中';
    case 'tool':
      switch (part.state.status) {
        case 'pending':
          return '等待中';
        case 'running':
          return '执行中';
        case 'completed':
          return '已完成';
        case 'error':
          return '失败';
      }
    case 'file':
      return '已附加';
    default:
      return assertNever(part);
  }
}

/**
 * 类型完整性检查（用于 exhaustiveness check）
 */
function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}

// ============================================================================
// Token 使用统计
// ============================================================================

/**
 * Token 使用统计
 */
export interface TokenUsage {
  /** 输入 token 数量 */
  promptTokens: number;
  /** 输出 token 数量 */
  completionTokens: number;
  /** 总 token 数量 */
  totalTokens: number;
  /** 推理 token 数量（如果模型支持） */
  reasoningTokens?: number;
}

// ============================================================================
// Finish Reason
// ============================================================================

/**
 * 消息结束原因
 */
export type FinishReason =
  | 'stop'          // 正常结束
  | 'tool_calls'    // 有工具调用（需要继续循环）
  | 'length'        // 达到长度限制
  | 'error'         // 发生错误
  | 'content_filter'; // 内容被过滤
