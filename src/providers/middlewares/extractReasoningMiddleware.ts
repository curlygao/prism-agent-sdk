/**
 * Reasoning 提取中间件
 *
 * 从模型的输出中提取 `

` 标签的内容作为 reasoning
 * 适用于不支持原生 reasoning 字段的模型
 */

export interface ExtractReasoningMiddlewareOptions {
  /** 标签名称（默认 'think'） */
  tagName?: string;
  /** 是否以 reasoning 开始 */
  startWithReasoning?: boolean;
}

/**
 * 解析文本中的 reasoning 标签
 */
export function parseReasoningFromText(
  text: string,
  options: ExtractReasoningMiddlewareOptions = {}
): { reasoning: string; text: string } {
  const tagName = options.tagName || 'think';
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;

  let reasoning = '';
  let remainingText = text;

  // 查找所有 reasoning 标签
  let openIndex = text.indexOf(openTag);
  while (openIndex !== -1) {
    const closeIndex = text.indexOf(closeTag, openIndex);
    if (closeIndex === -1) {
      // 没有闭合标签，忽略
      break;
    }

    // 提取 reasoning 内容
    const reasoningContent = text.slice(openIndex + openTag.length, closeIndex).trim();
    reasoning += (reasoning ? '\n\n' : '') + reasoningContent;

    // 移除标签和内容
    remainingText =
      text.slice(0, openIndex) +
      text.slice(closeIndex + closeTag.length);

    text = remainingText;
    openIndex = text.indexOf(openTag);
  }

  return { reasoning, text: remainingText };
}

/**
 * 从文本中提取 reasoning（迭代器版本，用于流式处理）
 */
export class ReasoningExtractor {
  private tagName: string;
  private openTag: string;
  private closeTag: string;
  private buffer = '';
  private inReasoning = false;
  private currentReasoning = '';

  constructor(options: ExtractReasoningMiddlewareOptions = {}) {
    this.tagName = options.tagName || 'think';
    this.openTag = `<${this.tagName}>`;
    this.closeTag = `</${this.tagName}>`;
  }

  /**
   * 处理文本块
   *
   * @returns 包含 reasoning 和 text 的对象
   */
  process(chunk: string): { reasoning?: string; text?: string } {
    const result: { reasoning?: string; text?: string } = {};

    this.buffer += chunk;

    // 处理缓冲区
    while (this.buffer.length > 0) {
      if (this.inReasoning) {
        // 在 reasoning 标签内
        const closeIndex = this.buffer.indexOf(this.closeTag);
        if (closeIndex !== -1) {
          // 找到闭合标签
          this.currentReasoning += this.buffer.slice(0, closeIndex);
          result.reasoning = this.currentReasoning.trim();
          this.buffer = this.buffer.slice(closeIndex + this.closeTag.length);
          this.inReasoning = false;
          this.currentReasoning = '';
        } else {
          // 没有闭合标签，保留所有内容
          this.currentReasoning += this.buffer;
          result.reasoning = this.currentReasoning;
          this.buffer = '';
          break;
        }
      } else {
        // 在 reasoning 标签外
        const openIndex = this.buffer.indexOf(this.openTag);
        if (openIndex !== -1) {
          // 找到开始标签
          result.text = this.buffer.slice(0, openIndex);
          this.buffer = this.buffer.slice(openIndex + this.openTag.length);
          this.inReasoning = true;
        } else {
          // 没有标签，返回所有内容
          result.text = this.buffer;
          this.buffer = '';
          break;
        }
      }
    }

    return result;
  }

  /**
   * 重置提取器
   */
  reset(): void {
    this.buffer = '';
    this.inReasoning = false;
    this.currentReasoning = '';
  }

  /**
   * 获取当前状态
   */
  getState(): { inReasoning: boolean; currentReasoning: string } {
    return {
      inReasoning: this.inReasoning,
      currentReasoning: this.currentReasoning,
    };
  }
}

/**
 * 创建 Reasoning 提取中间件
 *
 * 使用示例：
 * ```typescript
 * const extractor = createReasoningExtractor({ tagName: 'think' });
 * const chunk1 = "让我思考一下这是结果";
 *
 * console.log(extractor.process(chunk1)); // { text: "让我思考一下" }
 * console.log(extractor.process(chunk2)); // { reasoning: "这是思考过程", text: "这是结果" }
 * ```
 */
export function createReasoningExtractor(
  options: ExtractReasoningMiddlewareOptions = {}
): ReasoningExtractor {
  return new ReasoningExtractor(options);
}

/**
 * 检测文本中是否包含 reasoning 标签
 */
export function hasReasoningTags(
  text: string,
  options: ExtractReasoningMiddlewareOptions = {}
): boolean {
  const tagName = options.tagName || 'think';
  const openTag = `<${tagName}>`;
  return text.includes(openTag);
}
