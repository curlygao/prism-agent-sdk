/**
 * SkillTool 单元测试
 *
 * 测试 SKILL 系统工具的功能
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { SkillTool } from '../SkillTool';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('SkillTool', () => {
  const testDir = path.join(os.tmpdir(), 'skill-tool-test');

  beforeEach(async () => {
    // 清理并创建测试目录
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // 忽略错误
    }
    await mkdir(path.join(testDir, '.claude', 'skills'), { recursive: true });
  });

  test('扫描项目级 skills 目录', async () => {
    // 创建测试 SKILL 文件
    await writeFile(
      path.join(testDir, '.claude', 'skills', 'test-skill.md'),
      `---
name: test-skill
description: 测试技能
---

# Test Skill Content
`
    );

    const tool = new SkillTool(testDir);
    // 等待异步初始化完成 - 使用更长的等待时间
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(tool.name).toBe('skill');
    expect(tool.description).toContain('<skill>');
    expect(tool.description).toContain('test-skill');
    expect(tool.description).toContain('测试技能');
  });

  test('execute 加载技能内容', async () => {
    await writeFile(
      path.join(testDir, '.claude', 'skills', 'my-skill.md'),
      `---
name: my-skill
description: 我的技能
---

# My Skill

Some content here.
`
    );

    const tool = new SkillTool(testDir);
    const result = await tool.execute({ name: 'my-skill' });

    expect(result.title).toBe('Loaded skill: my-skill');
    expect(result.output).toContain('# My Skill');
    expect(result.output).toContain('Some content here.');
  });

  test('execute 抛出错误当技能不存在', async () => {
    const tool = new SkillTool(testDir);

    await expect(tool.execute({ name: 'nonexistent' }))
      .rejects.toThrow('Skill "nonexistent" not found');
  });

  test('应该忽略没有 frontmatter name 的技能文件', async () => {
    // 没有 frontmatter 或 frontmatter 中没有 name 的文件应该被忽略
    await writeFile(
      path.join(testDir, '.claude', 'skills', 'no-frontmatter.md'),
      `# Only Content

Some content without frontmatter.
`
    );

    const tool = new SkillTool(testDir);
    // 技能没有被注册，所以会抛出错误
    await expect(tool.execute({ name: 'no-frontmatter' }))
      .rejects.toThrow('not found');
  });

  test('应该处理包含中文的技能', async () => {
    await writeFile(
      path.join(testDir, '.claude', 'skills', 'chinese-skill.md'),
      `---
name: chinese-skill
description: 中文技能描述
---

# 中文技能标题

这是中文内容。
`
    );

    const tool = new SkillTool(testDir);
    const result = await tool.execute({ name: 'chinese-skill' });

    expect(result.title).toBe('Loaded skill: chinese-skill');
    expect(result.output).toContain('中文技能标题');
    expect(result.output).toContain('这是中文内容。');
  });

  test('execute 返回的 metadata 包含正确信息', async () => {
    await writeFile(
      path.join(testDir, '.claude', 'skills', 'metadata-test.md'),
      `---
name: metadata-test
description: Metadata 测试
---

# Metadata Test
`
    );

    const tool = new SkillTool(testDir);
    const result = await tool.execute({ name: 'metadata-test' });

    expect(result.metadata.name).toBe('metadata-test');
    expect(result.metadata.dir).toBeDefined();
  });
});
