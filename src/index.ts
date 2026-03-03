/**
 * Teslamate Multilingual - 主入口
 * 自动完成：版本检测 → 翻译 → 构建 → 发布
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { extractStrings, uniqueStrings, ExtractedString } from './extract-strings';
import { translate, TranslateOptions, TranslationResult } from './translate';
import { mergeTranslations, loadTranslationMap } from './merge-translations';

// 配置
const CONFIG = {
  teslamateRepo: 'teslamate-org/teslamate',
  dashboardsRepo: 'grafana/dashboards',
  dashboardsPath: 'grafana/dashboards/*.json',
  localDashboardsDir: 'dashboards',
  versionFile: 'VERSION'
};

interface Config {
  targetLangs: string[];
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl?: string;
  aiModel?: string;
  teslamateVersion?: string;
}

/**
 * 加载配置
 */
function loadConfig(): Config {
  const targetLangs = (process.env.TARGET_LANGS || 'zh-CN').split(',').map(s => s.trim());
  const aiProvider = process.env.AI_PROVIDER || 'openai';
  const aiApiKey = process.env.AI_API_KEY || '';
  const aiBaseUrl = process.env.AI_BASE_URL;
  const aiModel = process.env.AI_MODEL;
  const teslamateVersion = process.env.TESLAMATE_VERSION;

  if (!aiApiKey) {
    throw new Error('AI_API_KEY is required');
  }

  return {
    targetLangs,
    aiProvider,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    teslamateVersion
  };
}

/**
 * 获取 teslamate 最新版本
 */
async function getLatestTeslamateVersion(): Promise<string> {
  const response = await axios.get(
    `https://api.github.com/repos/${CONFIG.teslamateRepo}/releases/latest`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );
  return response.data.tag_name.replace(/^v/, '');
}

/**
 * 获取当前版本
 */
async function getCurrentVersion(): Promise<string | null> {
  try {
    const content = await fs.readFile(CONFIG.versionFile, 'utf-8');
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * 克隆 teslamate 仓库获取 dashboards
 */
async function fetchTeslamateDashboards(version: string): Promise<void> {
  const tmpDir = '/tmp/teslamate';

  // 清理并创建临时目录
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  console.log(`Fetching teslamate v${version}...`);

  // 下载 dashboards
  const dashboardsUrl = `https://raw.githubusercontent.com/${CONFIG.teslamateRepo}/${version}/grafana/dashboards/`;

  // 获取 dashboards 列表
  const response = await axios.get(
    `https://api.github.com/repos/${CONFIG.teslamateRepo}/contents/grafana/dashboards`,
    {
      params: { ref: version }
    }
  );

  const files = response.data.filter((f: any) => f.name.endsWith('.json'));

  // 下载每个 dashboard
  for (const file of files) {
    const content = await axios.get(`${dashboardsUrl}${file.name}`);
    await fs.writeFile(path.join(tmpDir, file.name), JSON.stringify(content.data, null, 2));
    console.log(`  Downloaded: ${file.name}`);
  }

  console.log(`Downloaded ${files.length} dashboards`);
}

/**
 * 翻译单个 dashboard 文件
 */
async function translateDashboard(
  inputPath: string,
  outputDir: string,
  lang: string,
  config: Config
): Promise<void> {
  const fileName = path.basename(inputPath);
  const outputPath = path.join(outputDir, fileName);

  // 读取 dashboard
  const content = await fs.readFile(inputPath, 'utf-8');
  const dashboard = JSON.parse(content);

  // 提取字符串
  const strings = extractStrings(dashboard);
  const unique = uniqueStrings(strings);

  console.log(`  Found ${unique.length} translatable strings`);

  if (unique.length === 0) {
    // 无需翻译，直接复制
    await fs.mkdir(outputDir, { recursive: true });
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  // 翻译
  const translateOptions: TranslateOptions = {
    provider: config.aiProvider as any,
    apiKey: config.aiApiKey,
    baseUrl: config.aiBaseUrl,
    model: config.aiModel,
    targetLang: lang
  };

  const originalStrings = unique.map(s => s.value);
  const results = await translate(originalStrings, translateOptions);

  // 创建翻译映射
  const translationMap = loadTranslationMap(results);

  // 合并翻译
  const merged = mergeTranslations(dashboard, translationMap);

  // 保存
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(merged, null, 2));
  console.log(`  Translated to ${lang}: ${fileName}`);
}

/**
 * 主流程
 */
async function main() {
  console.log('=== Teslamate Multilingual Build ===\n');

  const config = loadConfig();
  console.log(`Target languages: ${config.targetLangs.join(', ')}`);
  console.log(`AI Provider: ${config.aiProvider}\n`);

  // 1. 版本检测
  const latestVersion = await getLatestTeslamateVersion();
  const currentVersion = await getCurrentVersion();

  console.log(`Latest teslamate version: ${latestVersion}`);
  console.log(`Current version: ${currentVersion || 'none'}`);

  // 2. 检查是否需要更新
  const needsUpdate = !currentVersion || currentVersion !== latestVersion;

  if (needsUpdate) {
    console.log('\nNew version detected, fetching dashboards...');

    // 获取 dashboards
    await fetchTeslamateDashboards(latestVersion);

    // 翻译 dashboards
    const tmpDir = '/tmp/teslamate';
    const files = await fs.readdir(tmpDir);

    for (const lang of config.targetLangs) {
      console.log(`\nTranslating to ${lang}...`);

      const outputDir = path.join(CONFIG.localDashboardsDir, lang);
      await fs.rm(outputDir, { recursive: true, force: true });

      for (const file of files) {
        if (file.endsWith('.json')) {
          await translateDashboard(
            path.join(tmpDir, file),
            outputDir,
            lang,
            config
          );
        }
      }
    }

    // 保存版本号
    await fs.writeFile(CONFIG.versionFile, latestVersion);
    console.log(`\nUpdated VERSION to ${latestVersion}`);
  } else {
    console.log('\nNo new version, checking for existing translations...');

    // 检查现有翻译
    for (const lang of config.targetLangs) {
      const langDir = path.join(CONFIG.localDashboardsDir, lang);
      try {
        const files = await fs.readdir(langDir);
        console.log(`  ${lang}: ${files.length} dashboards`);
      } catch {
        console.log(`  ${lang}: no existing translations`);
      }
    }
  }

  console.log('\n=== Build complete ===');
}

// 导出函数供 GitHub Action 调用
export { main, loadConfig, translateDashboard, fetchTeslamateDashboards };

// 主入口
if (require.main === module) {
  main().catch(console.error);
}