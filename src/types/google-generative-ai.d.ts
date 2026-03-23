/**
 * Google Generative AI 可选依赖类型声明
 *
 * 当 @google/generative-ai 未安装时，此文件提供基本类型定义
 */

declare module '@google/generative-ai' {
  export interface GenerateContentResult {
    response: any;
    stream: AsyncIterable<any>;
  }

  export interface GenerativeModel {
    generateContent(prompt: any): Promise<GenerateContentResult>;
    generateContentStream(prompt: any): Promise<GenerateContentResult>;
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: {
      model: string;
      systemInstruction?: string;
    }): GenerativeModel;
  }
}
