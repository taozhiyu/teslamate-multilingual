/**
 * 从 Grafana Dashboard JSON 中提取可翻译的文本
 */

export interface ExtractedString {
  path: string;
  value: string;
  type: 'title' | 'description' | 'fieldName' | 'tooltip' | 'other';
}

/**
 * 从 JSON 对象中提取所有可翻译的字符串
 */
export function extractStrings(obj: any, path: string = ''): ExtractedString[] {
  const results: ExtractedString[] = [];

  if (!obj || typeof obj !== 'object') {
    return results;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...extractStrings(obj[i], `${path}[${i}]`));
    }
    return results;
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;

    // 需要翻译的字段
    const translateFields = ['title', 'description', 'fieldName', 'tooltip', 'name', 'text'];

    if (translateFields.includes(key) && typeof value === 'string' && value.trim()) {
      let type: ExtractedString['type'] = 'other';
      if (key === 'title') type = 'title';
      else if (key === 'description') type = 'description';
      else if (key === 'fieldName') type = 'fieldName';
      else if (key === 'tooltip') type = 'tooltip';

      results.push({
        path: currentPath,
        value: value.trim(),
        type
      });
    } else if (typeof value === 'object') {
      results.push(...extractStrings(value, currentPath));
    }
  }

  return results;
}

/**
 * 去重并返回唯一字符串
 */
export function uniqueStrings(strings: ExtractedString[]): ExtractedString[] {
  const seen = new Map<string, ExtractedString>();

  for (const s of strings) {
    if (!seen.has(s.value)) {
      seen.set(s.value, s);
    }
  }

  return Array.from(seen.values());
}

/**
 * 从 dashboard JSON 文件中提取所有可翻译字符串
 */
export async function extractFromFile(filePath: string): Promise<ExtractedString[]> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const dashboard = JSON.parse(content);
  const strings = extractStrings(dashboard);
  return uniqueStrings(strings);
}