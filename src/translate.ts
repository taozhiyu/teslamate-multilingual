/**
 * AI 翻译服务
 */

import axios from 'axios';

export interface TranslateOptions {
  provider: 'openai' | 'anthropic' | 'deepl' | 'deeplx' | 'openai-compatible' | 'anthropic-compatible';
  apiKey: string;
  baseUrl?: string;
  model?: string;
  targetLang: string;
  sourceLang?: string;
}

export interface TranslationResult {
  original: string;
  translated: string;
}

/**
 * 通用翻译接口
 */
async function translateWithProvider(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { provider } = options;

  switch (provider) {
    case 'openai':
      return translateWithOpenAI(strings, options);
    case 'openai-compatible':
      return translateWithOpenAICompatible(strings, options);
    case 'anthropic':
      return translateWithAnthropic(strings, options);
    case 'anthropic-compatible':
      return translateWithAnthropicCompatible(strings, options);
    case 'deepl':
      return translateWithDeepL(strings, options);
    case 'deeplx':
      return translateWithDeepLX(strings, options);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * OpenAI 翻译
 */
async function translateWithOpenAI(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { apiKey, targetLang, model = 'gpt-4' } = options;

  const prompt = buildTranslatePrompt(strings, targetLang);

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate the strings to the target language. Return JSON array with format: [{"original": "...", "translated": "..."}]'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.choices[0].message.content;
  return JSON.parse(content);
}

/**
 * OpenAI 兼容 API 翻译（如本地 LLM）
 */
async function translateWithOpenAICompatible(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { apiKey, baseUrl, model, targetLang } = options;

  const prompt = buildTranslatePrompt(strings, targetLang);

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate the strings to the target language. Return JSON array with format: [{"original": "...", "translated": "..."}]'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.choices[0].message.content;
  return JSON.parse(content);
}

/**
 * Anthropic 翻译
 */
async function translateWithAnthropic(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { apiKey, targetLang, model = 'claude-3-sonnet-20240229' } = options;

  const prompt = buildTranslatePrompt(strings, targetLang);

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model,
      max_tokens: 4096,
      system: 'You are a professional translator. Translate the strings to the target language. Return JSON array with format: [{"original": "...", "translated": "..."}]',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.content[0].text;
  return JSON.parse(content);
}

/**
 * Anthropic 兼容 API 翻译
 */
async function translateWithAnthropicCompatible(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { apiKey, baseUrl, model, targetLang } = options;

  const prompt = buildTranslatePrompt(strings, targetLang);

  const response = await axios.post(
    `${baseUrl}/v1/messages`,
    {
      model: model || 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      system: 'You are a professional translator. Translate the strings to the target language. Return JSON array with format: [{"original": "...", "translated": "..."}]',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.content[0].text;
  return JSON.parse(content);
}

/**
 * DeepL 翻译
 */
async function translateWithDeepL(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { apiKey, targetLang, sourceLang = 'en' } = options;

  const results: TranslationResult[] = [];

  // DeepL 每次最多翻译 50 个字符串
  const batches = chunkArray(strings, 50);

  for (const batch of batches) {
    const response = await axios.post(
      'https://api-free.deepl.com/v2/translate', // 使用 api-free，付费版用 api
      {
        text: batch,
        source_lang: sourceLang.toUpperCase(),
        target_lang: mapLangToDeepL(targetLang)
      },
      {
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    for (let i = 0; i < batch.length; i++) {
      results.push({
        original: batch[i],
        translated: response.data.translations[i].text
      });
    }
  }

  return results;
}

/**
 * DeepLX 翻译
 */
async function translateWithDeepLX(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  const { baseUrl = 'http://localhost:1188', targetLang, sourceLang = 'en' } = options;

  const results: TranslationResult[] = [];

  for (const text of strings) {
    const response = await axios.post(
      `${baseUrl}/translate`,
      {
        text,
        source_lang: sourceLang.toUpperCase(),
        target_lang: mapLangToDeepL(targetLang)
      }
    );

    results.push({
      original: text,
      translated: response.data[0].translated_text
    });
  }

  return results;
}

/**
 * 构建翻译提示
 */
function buildTranslatePrompt(strings: string[], targetLang: string): string {
  const langName = getLangName(targetLang);
  return `Translate the following ${strings.length} strings to ${langName} (${targetLang}). Return a JSON array:

${JSON.stringify(strings.map(s => ({ original: s, translated: '' })), null, 2)}

Translate each string and preserve the JSON structure.`;
}

/**
 * 映射语言代码到 DeepL 格式
 */
function mapLangToDeepL(lang: string): string {
  const mapping: Record<string, string> = {
    'zh-CN': 'ZH',
    'zh-TW': 'ZH',
    'ja': 'JA',
    'ko': 'KO',
    'en': 'EN',
    'fr': 'FR',
    'de': 'DE',
    'es': 'ES',
    'it': 'IT',
    'pt': 'PT',
    'ru': 'RU'
  };
  return mapping[lang] || lang.toUpperCase();
}

/**
 * 获取语言名称
 */
function getLangName(lang: string): string {
  const names: Record<string, string> = {
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian'
  };
  return names[lang] || lang;
}

/**
 * 数组分块
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const results: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    results.push(arr.slice(i, i + size));
  }
  return results;
}

/**
 * 翻译字符串
 */
export async function translate(
  strings: string[],
  options: TranslateOptions
): Promise<TranslationResult[]> {
  if (strings.length === 0) {
    return [];
  }

  return translateWithProvider(strings, options);
}