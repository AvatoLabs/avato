/**
 * Display names for builtin tools (Inspector / title fallback).
 * Maps identifier+apiName to user-friendly labels.
 * TODO: migrate to i18n keys for full locale support.
 */

const DISPLAY_NAMES_ZH: Record<string, Record<string, string>> = {
  'lobe-gtd': {
    clearTodos: '清除待办',
    completeTodos: '完成待办',
    createPlan: '创建计划',
    createTodos: '创建待办',
    execTask: '执行任务',
    execTasks: '执行任务',
    removeTodos: '删除待办',
    updatePlan: '更新计划',
    updateTodos: '更新待办',
  },
  'lobe-notebook': { createDocument: '创建文档' },
  'lobe-user-memory': {
    addExperienceMemory: '添加经历记忆',
    addPreferenceMemory: '添加偏好记忆',
    searchUserMemory: '搜索记忆',
  },
  'lobe-cloud-sandbox': { executeCode: '执行代码' },
  'lobe-calculator': {
    base: '进制转换',
    calculate: '计算',
    defintegrate: '定积分',
    differentiate: '求导',
    evaluate: '求值',
    execute: '执行',
    integrate: '积分',
    limit: '求极限',
    solve: '求解',
    sort: '排序',
  },
  'lobe-web-browsing': { search: '网页搜索' },
  'lobe-knowledge-base': { searchKnowledgeBase: '知识库检索' },
  'lobe-agent-builder': {
    getAvailableModels: '获取可用模型',
    installPlugin: '安装插件',
    searchMarketTools: '搜索市场工具',
    updateAgentConfig: '更新 Agent 配置',
    updatePrompt: '更新提示词',
  },
  'lobe-group-management': {
    broadcast: '广播',
    executeAgentTask: '执行任务',
    executeAgentTasks: '执行任务',
    speak: '发言',
    vote: '投票',
  },
  'lobe-skill-store': {
    importFromMarket: '从市场导入',
    importSkill: '导入技能',
    searchSkill: '搜索技能',
  },
  'lobe-skills': {
    execScript: '执行脚本',
    exportFile: '导出文件',
    readReference: '读取引用',
    runSkill: '运行技能',
    searchSkill: '搜索技能',
  },
};

const DISPLAY_NAMES_EN: Record<string, Record<string, string>> = {
  'lobe-gtd': {
    clearTodos: 'Clear todos',
    completeTodos: 'Complete todos',
    createPlan: 'Create plan',
    createTodos: 'Create todos',
    execTask: 'Exec task',
    execTasks: 'Exec tasks',
    removeTodos: 'Remove todos',
    updatePlan: 'Update plan',
    updateTodos: 'Update todos',
  },
  'lobe-notebook': { createDocument: 'Create document' },
  'lobe-user-memory': {
    addExperienceMemory: 'Add experience',
    addPreferenceMemory: 'Add preference',
    searchUserMemory: 'Search memory',
  },
  'lobe-cloud-sandbox': { executeCode: 'Execute code' },
  'lobe-calculator': {
    base: 'Base conversion',
    calculate: 'Calculate',
    defintegrate: 'Definite integral',
    differentiate: 'Differentiate',
    evaluate: 'Evaluate',
    execute: 'Execute',
    integrate: 'Integrate',
    limit: 'Limit',
    solve: 'Solve',
    sort: 'Sort',
  },
  'lobe-web-browsing': { search: 'Web search' },
  'lobe-knowledge-base': { searchKnowledgeBase: 'Knowledge base' },
  'lobe-agent-builder': {
    getAvailableModels: 'Get available models',
    installPlugin: 'Install plugin',
    searchMarketTools: 'Search market tools',
    updateAgentConfig: 'Update agent config',
    updatePrompt: 'Update prompt',
  },
  'lobe-group-management': {
    broadcast: 'Broadcast',
    executeAgentTask: 'Execute task',
    executeAgentTasks: 'Execute tasks',
    speak: 'Speak',
    vote: 'Vote',
  },
  'lobe-skill-store': {
    importFromMarket: 'Import from market',
    importSkill: 'Import skill',
    searchSkill: 'Search skill',
  },
  'lobe-skills': {
    execScript: 'Exec script',
    exportFile: 'Export file',
    readReference: 'Read reference',
    runSkill: 'Run skill',
    searchSkill: 'Search skill',
  },
};

export function getMobileBuiltinDisplayName(
  identifier?: string,
  apiName?: string,
  locale?: string,
): string | undefined {
  if (!identifier || !apiName) return undefined;
  const isZh = locale?.startsWith('zh');
  const map = isZh ? DISPLAY_NAMES_ZH : DISPLAY_NAMES_EN;
  return map[identifier]?.[apiName];
}
