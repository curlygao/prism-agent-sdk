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
