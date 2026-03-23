/**
 * 转义路径为安全的目录名
 * @example escapePath('C:\\Users\\Test\\Project') => 'C__Users_Test_Project'
 * @example escapePath('/home/user/project') => '_home_user_project'
 */
export function escapePath(projectPath: string): string {
  return projectPath
    .replace(/\\/g, '_')  // Windows 路径分隔符
    .replace(/\//g, '_')  // Unix 路径分隔符
    .replace(/:/g, '_')   // Windows 驱动器冒号
    .replace(/\s+/g, '_'); // 空格
}

/**
 * 获取项目存储目录路径
 * @param baseDir - 基础目录（如 ~/.prism-agent/projects）
 * @param projectPath - 项目原始路径
 * @returns 项目目录路径
 */
export function getProjectDir(baseDir: string, projectPath: string): string {
  const escaped = escapePath(projectPath);
  return `${baseDir}/${escaped}`;
}

/**
 * 获取会话文件路径
 * @param projectDir - 项目目录
 * @param sessionId - 会话 ID
 * @returns 会话文件路径
 * @throws {Error} 如果 sessionId 包含路径分隔符
 */
export function getSessionFile(projectDir: string, sessionId: string): string {
  if (sessionId.includes('/') || sessionId.includes('\\')) {
    throw new Error(`会话 ID 不能包含路径分隔符: ${sessionId}`);
  }
  return `${projectDir}/${sessionId}.jsonl`;
}

/**
 * 获取项目元数据文件路径
 * @param projectDir - 项目目录
 * @returns 元数据文件路径
 */
export function getMetaFile(projectDir: string): string {
  return `${projectDir}/meta.json`;
}
