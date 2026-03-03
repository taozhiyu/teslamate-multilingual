/**
 * 将翻译结果合并回 Grafana Dashboard JSON
 */

import { TranslationResult } from './translate';

export interface MergeOptions {
  backup?: boolean;
}

/**
 * 将翻译结果合并到原始 JSON 对象
 */
export function mergeTranslations(
  obj: any,
  translations: Map<string, string>,
  path: string = ''
): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => mergeTranslations(item, translations, `${path}[${index}]`));
  }

  const result: any = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;

    // 需要翻译的字段
    const translateFields = ['title', 'description', 'fieldName', 'tooltip', 'name', 'text'];

    if (translateFields.includes(key) && typeof value === 'string' && value.trim()) {
      const original = value.trim();
      if (translations.has(original)) {
        result[key] = translations.get(original);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object') {
      result[key] = mergeTranslations(value, translations, currentPath);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 加载翻译映射
 */
export function loadTranslationMap(results: TranslationResult[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of results) {
    map.set(r.original, r.translated);
  }
  return map;
}

/**
 * 从文件读取并合并翻译
 */
export async function mergeFromFile(
  inputPath: string,
  outputPath: string,
  translations: Map<string, string>,
  options: MergeOptions = {}
): Promise<void> {
  const fs = await import('fs/promises');

  // 读取原始文件
  const content = await fs.readFile(inputPath, 'utf-8');
  const dashboard = JSON.parse(content);

  // 备份原文件
  if (options.backup) {
    await fs.copyFile(inputPath, `${inputPath}.backup`);
  }

  // 合并翻译
  const merged = mergeTranslations(dashboard, translations);

  // 写入目标文件
  await fs.writeFile(outputPath, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * 从目录读取所有已翻译文件
 */
export async function loadTranslationsFromDir(dirPath: string): Promise<Map<string, string>> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const translations = new Map<string, string>();

  try {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // 从翻译后的 JSON 中提取字符串（用于对比）
        extractTranslatedStrings(data, translations);
      }
    }
  } catch (error) {
    // 目录不存在，返回空映射
  }

  return translations;
}

/**
 * 从 JSON 对象中提取翻译后的字符串
 */
function extractTranslatedStrings(obj: any, map: Map<string, string>, path: string = ''): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractTranslatedStrings(item, map, path);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;

    const translateFields = ['title', 'description', 'fieldName', 'tooltip', 'name', 'text'];

    if (translateFields.includes(key) && typeof value === 'string' && value.trim()) {
      // 这里存储翻译后的值
      map.set(currentPath, value.trim());
    } else if (typeof value === 'object') {
      extractTranslatedStrings(value, map, currentPath);
    }
  }
}