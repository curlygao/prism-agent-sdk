import { z } from 'zod';
import { BaseTool } from './BaseTool';
import type { ToolContext } from '../types/tools';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { glob } from 'glob';
import matter from 'gray-matter';

interface SkillInfo {
  name: string;
  description: string;
  location: string;
}

const SkillToolSchema = z.object({
  name: z.string().describe('SKILL 标识符'),
});

export class SkillTool extends BaseTool {
  name = 'skill';
  description = '加载技能以获取特定任务的详细指令';
  inputSchema = SkillToolSchema;
  summaryTemplate = '加载技能 {{name}}';

  private skills: Map<string, SkillInfo> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(workingDir: string) {
    super();
    this.workingDir = workingDir;
    // 启动异步初始化，但不阻塞构造函数
    this.initPromise = this.scanSkills().then(() => {
      this.initialized = true;
      this.description = this.getDescription();
    });
  }

  private workingDir: string;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private getDescription(): string {
    const skills = Array.from(this.skills.values());

    if (skills.length === 0) {
      return '加载技能以获取特定任务的详细指令。当前没有可用的技能。';
    }

    const skillList = skills
      .map(s => `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`)
      .join('\n');

    return [
      '加载技能以获取特定任务的详细指令。',
      '技能提供专业知识和分步指导。',
      '当任务匹配可用技能描述时使用此工具。',
      '<available_skills>',
      skillList,
      '</available_skills>',
    ].join(' ');
  }

  private async scanSkills(): Promise<void> {
    const CLAUDE_SKILL_PATTERN = 'skills/**/*.md';

    // 扫描项目级 skills - cwd 是 .claude，glob 模式匹配 skills/**/*.md
    const projectSkillsBase = path.join(this.workingDir, '.claude');
    try {
      const projectMatches = await glob(CLAUDE_SKILL_PATTERN, {
        cwd: projectSkillsBase,
        absolute: true,
        onlyFiles: true,
      });
      for (const match of projectMatches) {
        await this.addSkill(match);
      }
    } catch (e) {
      // 目录不存在时忽略
    }

    // 扫描全局 skills - cwd 是 ~/.claude，glob 模式匹配 skills/**/*.md
    const globalSkillsBase = path.join(os.homedir(), '.claude');
    try {
      const globalMatches = await glob(CLAUDE_SKILL_PATTERN, {
        cwd: globalSkillsBase,
        absolute: true,
        onlyFiles: true,
      });
      for (const match of globalMatches) {
        await this.addSkill(match);
      }
    } catch (e) {
      // 目录不存在时忽略
    }
  }

  private async addSkill(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data } = matter(content);

      if (data.name && typeof data.name === 'string') {
        this.skills.set(data.name, {
          name: data.name,
          description: data.description || '',
          location: filePath,
        });
      }
    } catch (e) {
      // 解析失败时忽略
    }
  }

  async execute(input: z.infer<typeof SkillToolSchema>, context?: ToolContext): Promise<any> {
    await this.ensureInitialized();

    const skill = this.skills.get(input.name);

    if (!skill) {
      const available = Array.from(this.skills.keys()).join(', ');
      throw new Error(`Skill "${input.name}" not found. Available skills: ${available || 'none'}`);
    }

    const content = await fs.readFile(skill.location, 'utf-8');
    const { content: skillContent } = matter(content);
    const dir = path.dirname(skill.location);

    return {
      title: `Loaded skill: ${skill.name}`,
      output: [
        `## Skill: ${skill.name}`,
        '',
        `**Base directory**: ${dir}`,
        '',
        skillContent.trim(),
      ].join('\n'),
      metadata: {
        name: skill.name,
        dir,
      },
    };
  }
}
