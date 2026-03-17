/**
 * Fixed category keys for Store Explore (Skill / MCP).
 * Used as fallback when API returns empty or fails.
 * Keys aligned with @lobechat/types SkillCategory and McpCategory.
 */
import type { Locale } from '../lib/i18n';

export const ALL_CATEGORY_KEY = 'all';

/** Skill categories (aligned with SkillCategory enum) */
export const FALLBACK_SKILL_CATEGORY_KEYS = [
  ALL_CATEGORY_KEY,
  'coding-agents-ides',
  'web-frontend-development',
  'devops-cloud',
  'search-research',
  'browser-automation',
  'productivity-tasks',
  'ai-llms',
  'cli-utilities',
  'git-github',
  'image-video-generation',
  'communication',
  'transportation',
  'pdf-documents',
  'marketing-sales',
  'health-fitness',
  'media-streaming',
  'notes-pkm',
  'calendar-scheduling',
  'shopping-ecommerce',
  'security-passwords',
  'personal-development',
  'speech-transcription',
  'apple-apps-services',
  'smart-home-iot',
  'gaming',
  'clawdbot-tools',
  'self-hosted-automation',
  'ios-macos-development',
  'moltbook',
  'data-analytics',
  'finance',
  'agent-to-agent-protocols',
] as const;

/** MCP categories (aligned with McpCategory enum) */
export const FALLBACK_MCP_CATEGORY_KEYS = [
  ALL_CATEGORY_KEY,
  'discover',
  'developer',
  'productivity',
  'tools',
  'web-search',
  'media-generate',
  'business',
  'science-education',
  'stocks-finance',
  'news',
  'social',
  'gaming-entertainment',
  'lifestyle',
  'health-wellness',
  'travel-transport',
  'weather',
] as const;

const CATEGORY_LABELS: Record<string, Partial<Record<Locale, string>>> = {
  [ALL_CATEGORY_KEY]: { 'en-US': 'All', 'zh-CN': '全部', 'zh-TW': '全部' },
  'agent-to-agent-protocols': {
    'en-US': 'Agent-to-Agent',
    'zh-CN': 'Agent 协议',
    'zh-TW': 'Agent 協議',
  },
  'ai-llms': { 'en-US': 'AI & LLMs', 'zh-CN': 'AI 与 LLM', 'zh-TW': 'AI 與 LLM' },
  'apple-apps-services': {
    'en-US': 'Apple Apps',
    'zh-CN': 'Apple 应用',
    'zh-TW': 'Apple 應用',
  },
  'browser-automation': {
    'en-US': 'Browser & Automation',
    'zh-CN': '浏览器与自动化',
    'zh-TW': '瀏覽器與自動化',
  },
  'business': { 'en-US': 'Business', 'zh-CN': '商业', 'zh-TW': '商業' },
  'calendar-scheduling': {
    'en-US': 'Calendar',
    'zh-CN': '日历与日程',
    'zh-TW': '日曆與排程',
  },
  'clawdbot-tools': { 'en-US': 'Clawdbot', 'zh-CN': 'Clawdbot', 'zh-TW': 'Clawdbot' },
  'cli-utilities': { 'en-US': 'CLI', 'zh-CN': '命令行', 'zh-TW': '命令列' },
  'coding-agents-ides': { 'en-US': 'Coding', 'zh-CN': '编程', 'zh-TW': '程式開發' },
  'communication': { 'en-US': 'Communication', 'zh-CN': '沟通协作', 'zh-TW': '溝通協作' },
  'data-analytics': { 'en-US': 'Data', 'zh-CN': '数据分析', 'zh-TW': '資料分析' },
  'developer': { 'en-US': 'Developer', 'zh-CN': '开发者', 'zh-TW': '開發者' },
  'devops-cloud': { 'en-US': 'DevOps & Cloud', 'zh-CN': 'DevOps 与云', 'zh-TW': 'DevOps 與雲' },
  'discover': { 'en-US': 'Discover', 'zh-CN': '发现', 'zh-TW': '發現' },
  'finance': { 'en-US': 'Finance', 'zh-CN': '金融', 'zh-TW': '金融' },
  'gaming': { 'en-US': 'Gaming', 'zh-CN': '游戏', 'zh-TW': '遊戲' },
  'gaming-entertainment': {
    'en-US': 'Gaming & Entertainment',
    'zh-CN': '游戏娱乐',
    'zh-TW': '遊戲娛樂',
  },
  'git-github': { 'en-US': 'Git & GitHub', 'zh-CN': 'Git 与 GitHub', 'zh-TW': 'Git 與 GitHub' },
  'health-fitness': { 'en-US': 'Health', 'zh-CN': '健康健身', 'zh-TW': '健康健身' },
  'health-wellness': { 'en-US': 'Health & Wellness', 'zh-CN': '健康', 'zh-TW': '健康' },
  'image-video-generation': {
    'en-US': 'Image & Video',
    'zh-CN': '图像与视频',
    'zh-TW': '圖像與影片',
  },
  'ios-macos-development': {
    'en-US': 'iOS & macOS',
    'zh-CN': 'iOS 与 macOS',
    'zh-TW': 'iOS 與 macOS',
  },
  'lifestyle': { 'en-US': 'Lifestyle', 'zh-CN': '生活方式', 'zh-TW': '生活方式' },
  'marketing-sales': { 'en-US': 'Marketing', 'zh-CN': '营销销售', 'zh-TW': '行銷銷售' },
  'media-generate': { 'en-US': 'Media', 'zh-CN': '媒体生成', 'zh-TW': '媒體生成' },
  'media-streaming': { 'en-US': 'Media', 'zh-CN': '媒体串流', 'zh-TW': '媒體串流' },
  'moltbook': { 'en-US': 'Moltbook', 'zh-CN': 'Moltbook', 'zh-TW': 'Moltbook' },
  'news': { 'en-US': 'News', 'zh-CN': '新闻', 'zh-TW': '新聞' },
  'notes-pkm': { 'en-US': 'Notes', 'zh-CN': '笔记知识库', 'zh-TW': '筆記知識庫' },
  'pdf-documents': { 'en-US': 'PDF & Docs', 'zh-CN': 'PDF 与文档', 'zh-TW': 'PDF 與文件' },
  'personal-development': {
    'en-US': 'Personal Development',
    'zh-CN': '个人发展',
    'zh-TW': '個人發展',
  },
  'productivity': { 'en-US': 'Productivity', 'zh-CN': '效率工具', 'zh-TW': '效率工具' },
  'productivity-tasks': { 'en-US': 'Tasks', 'zh-CN': '任务效率', 'zh-TW': '任務效率' },
  'science-education': {
    'en-US': 'Education',
    'zh-CN': '科学教育',
    'zh-TW': '科學教育',
  },
  'search-research': { 'en-US': 'Search', 'zh-CN': '搜索研究', 'zh-TW': '搜尋研究' },
  'security-passwords': { 'en-US': 'Security', 'zh-CN': '安全密码', 'zh-TW': '安全密碼' },
  'self-hosted-automation': {
    'en-US': 'Self-Hosted',
    'zh-CN': '自托管自动化',
    'zh-TW': '自託管自動化',
  },
  'shopping-ecommerce': { 'en-US': 'Shopping', 'zh-CN': '电商购物', 'zh-TW': '電商購物' },
  'smart-home-iot': { 'en-US': 'Smart Home', 'zh-CN': '智能家居', 'zh-TW': '智慧家庭' },
  'social': { 'en-US': 'Social', 'zh-CN': '社交', 'zh-TW': '社交' },
  'speech-transcription': {
    'en-US': 'Speech',
    'zh-CN': '语音转写',
    'zh-TW': '語音轉寫',
  },
  'stocks-finance': { 'en-US': 'Stocks', 'zh-CN': '股票金融', 'zh-TW': '股票金融' },
  'tools': { 'en-US': 'Tools', 'zh-CN': '工具', 'zh-TW': '工具' },
  'transportation': { 'en-US': 'Transport', 'zh-CN': '交通出行', 'zh-TW': '交通出行' },
  'travel-transport': { 'en-US': 'Travel', 'zh-CN': '旅行交通', 'zh-TW': '旅行交通' },
  'web-frontend-development': {
    'en-US': 'Web & Frontend',
    'zh-CN': 'Web 前端',
    'zh-TW': 'Web 前端',
  },
  'web-search': { 'en-US': 'Web Search', 'zh-CN': '网络搜索', 'zh-TW': '網路搜尋' },
  'weather': { 'en-US': 'Weather', 'zh-CN': '天气', 'zh-TW': '天氣' },
};

const SPECIAL_CATEGORY_PARTS: Record<string, string> = {
  ai: 'AI',
  cli: 'CLI',
  devops: 'DevOps',
  github: 'GitHub',
  ide: 'IDE',
  ides: 'IDEs',
  ios: 'iOS',
  llms: 'LLMs',
  macos: 'macOS',
  mcp: 'MCP',
  pkm: 'PKM',
};

export const humanizeCategoryKey = (key: string): string =>
  key
    .split('-')
    .map(
      (part) => SPECIAL_CATEGORY_PARTS[part] || `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ');

export const getCategoryLabel = (category: string, locale: Locale): string =>
  CATEGORY_LABELS[category]?.[locale] || humanizeCategoryKey(category);

/** Map manifest category variants to canonical API keys */
export const NORMALIZE_CATEGORY_MAP: Record<string, string> = {
  'coding': 'coding-agents-ides',
  'coding-agents': 'coding-agents-ides',
  'ides': 'coding-agents-ides',
  'web': 'web-frontend-development',
  'frontend': 'web-frontend-development',
  'devops': 'devops-cloud',
  'cloud': 'devops-cloud',
  'search': 'search-research',
  'research': 'search-research',
  'browser': 'browser-automation',
  'automation': 'browser-automation',
  'productivity': 'productivity-tasks',
  'tasks': 'productivity-tasks',
  'ai': 'ai-llms',
  'llms': 'ai-llms',
  'cli': 'cli-utilities',
  'git': 'git-github',
  'github': 'git-github',
  'image': 'image-video-generation',
  'video': 'image-video-generation',
  'communication': 'communication',
  'transport': 'transportation',
  'pdf': 'pdf-documents',
  'documents': 'pdf-documents',
  'marketing': 'marketing-sales',
  'sales': 'marketing-sales',
  'health': 'health-fitness',
  'fitness': 'health-fitness',
  'media': 'media-streaming',
  'streaming': 'media-streaming',
  'notes': 'notes-pkm',
  'pkm': 'notes-pkm',
  'calendar': 'calendar-scheduling',
  'scheduling': 'calendar-scheduling',
  'shopping': 'shopping-ecommerce',
  'ecommerce': 'shopping-ecommerce',
  'security': 'security-passwords',
  'passwords': 'security-passwords',
  'developer': 'developer',
  'tools': 'tools',
  'web-search': 'web-search',
  'media-generate': 'media-generate',
  'business': 'business',
  'science-education': 'science-education',
  'stocks-finance': 'stocks-finance',
  'news': 'news',
  'social': 'social',
  'gaming-entertainment': 'gaming-entertainment',
  'lifestyle': 'lifestyle',
  'health-wellness': 'health-wellness',
  'travel-transport': 'travel-transport',
  'weather': 'weather',
};

/** Builtin skill identifier -> default category when manifest has none */
export const BUILTIN_DEFAULT_CATEGORY: Record<string, string> = {
  'lobe-artifacts': 'image-video-generation',
  'lobe-user-memory': 'ai-llms',
  'lobe-cloud-sandbox': 'devops-cloud',
  'lobe-gtd': 'productivity-tasks',
  'lobe-notebook': 'notes-pkm',
  'lobe-calculator': 'productivity-tasks',
};

/** Normalize raw category string to canonical API key */
export const normalizeCategoryKey = (
  raw: string | undefined,
  validKeys: readonly string[],
): string | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (validKeys.includes(trimmed)) return trimmed;
  const mapped = NORMALIZE_CATEGORY_MAP[trimmed];
  if (mapped && validKeys.includes(mapped)) return mapped;
  return trimmed;
};
