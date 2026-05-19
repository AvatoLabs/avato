/**
 * Display names for builtin tools (Inspector / title fallback).
 * Maps identifier+apiName to i18n keys, with legacy locale maps kept as fallback.
 */

import type { TranslationKeys } from '../../lib/i18n';

export type MobileBuiltinDisplayNameOptions = {
  locale?: string;
  t?: (key: keyof TranslationKeys) => string | undefined;
};

const DISPLAY_NAME_KEYS: Record<string, Record<string, keyof TranslationKeys>> = {
  'lobe-gtd': {
    clearTodos: 'builtinToolGtdClearTodos',
    completeTodos: 'builtinToolGtdCompleteTodos',
    createPlan: 'builtinToolGtdCreatePlan',
    createTodos: 'builtinToolGtdCreateTodos',
    execTask: 'builtinToolGtdExecTask',
    execTasks: 'builtinToolGtdExecTasks',
    removeTodos: 'builtinToolGtdRemoveTodos',
    updatePlan: 'builtinToolGtdUpdatePlan',
    updateTodos: 'builtinToolGtdUpdateTodos',
  },
  'lobe-notebook': { createDocument: 'builtinToolNotebookCreateDocument' },
  'lobe-user-memory': {
    addExperienceMemory: 'builtinToolUserMemoryAddExperienceMemory',
    addPreferenceMemory: 'builtinToolUserMemoryAddPreferenceMemory',
    searchUserMemory: 'builtinToolUserMemorySearchUserMemory',
  },
  'lobe-cloud-sandbox': { executeCode: 'builtinToolCloudSandboxExecuteCode' },
  'lobe-calculator': {
    base: 'builtinToolCalculatorBase',
    calculate: 'builtinToolCalculatorCalculate',
    defintegrate: 'builtinToolCalculatorDefintegrate',
    differentiate: 'builtinToolCalculatorDifferentiate',
    evaluate: 'builtinToolCalculatorEvaluate',
    execute: 'builtinToolCalculatorExecute',
    integrate: 'builtinToolCalculatorIntegrate',
    limit: 'builtinToolCalculatorLimit',
    solve: 'builtinToolCalculatorSolve',
    sort: 'builtinToolCalculatorSort',
  },
  'lobe-web-browsing': { search: 'builtinToolWebBrowsingSearch' },
  'lobe-source-set': {
    readSourceFiles: 'builtinToolSourceSetReadSourceFiles',
    searchSourceSet: 'builtinToolSourceSetSearchSourceSet',
  },
  'lobe-agent-builder': {
    getAvailableModels: 'builtinToolAgentBuilderGetAvailableModels',
    installPlugin: 'builtinToolAgentBuilderInstallPlugin',
    searchMarketTools: 'builtinToolAgentBuilderSearchMarketTools',
    updateAgentConfig: 'builtinToolAgentBuilderUpdateAgentConfig',
    updatePrompt: 'builtinToolAgentBuilderUpdatePrompt',
  },
  'lobe-agent-management': {
    callAgent: 'builtinToolAgentManagementCallAgent',
    createAgent: 'builtinToolAgentManagementCreateAgent',
    deleteAgent: 'builtinToolAgentManagementDeleteAgent',
    searchAgent: 'builtinToolAgentManagementSearchAgent',
    updateAgent: 'builtinToolAgentManagementUpdateAgent',
  },
  'lobe-group-agent-builder': {
    batchCreateAgents: 'builtinToolGroupAgentBuilderBatchCreateAgents',
    createAgent: 'builtinToolGroupAgentBuilderCreateAgent',
    getAgentInfo: 'builtinToolGroupAgentBuilderGetAgentInfo',
    getAvailableModels: 'builtinToolGroupAgentBuilderGetAvailableModels',
    installPlugin: 'builtinToolGroupAgentBuilderInstallPlugin',
    inviteAgent: 'builtinToolGroupAgentBuilderInviteAgent',
    removeAgent: 'builtinToolGroupAgentBuilderRemoveAgent',
    searchAgent: 'builtinToolGroupAgentBuilderSearchAgent',
    searchMarketTools: 'builtinToolGroupAgentBuilderSearchMarketTools',
    updateAgentPrompt: 'builtinToolGroupAgentBuilderUpdateAgentPrompt',
    updateConfig: 'builtinToolGroupAgentBuilderUpdateConfig',
    updateGroup: 'builtinToolGroupAgentBuilderUpdateGroup',
    updateGroupPrompt: 'builtinToolGroupAgentBuilderUpdateGroupPrompt',
  },
  'lobe-local-system': {
    editLocalFile: 'builtinToolLocalSystemEditLocalFile',
    getCommandOutput: 'builtinToolLocalSystemGetCommandOutput',
    globLocalFiles: 'builtinToolLocalSystemGlobLocalFiles',
    grepContent: 'builtinToolLocalSystemGrepContent',
    killCommand: 'builtinToolLocalSystemKillCommand',
    listLocalFiles: 'builtinToolLocalSystemListLocalFiles',
    moveLocalFiles: 'builtinToolLocalSystemMoveLocalFiles',
    readLocalFile: 'builtinToolLocalSystemReadLocalFile',
    renameLocalFile: 'builtinToolLocalSystemRenameLocalFile',
    runCommand: 'builtinToolLocalSystemRunCommand',
    searchLocalFiles: 'builtinToolLocalSystemSearchLocalFiles',
    writeLocalFile: 'builtinToolLocalSystemWriteLocalFile',
  },
  'lobe-group-management': {
    broadcast: 'builtinToolGroupManagementBroadcast',
    executeAgentTask: 'builtinToolGroupManagementExecuteAgentTask',
    executeAgentTasks: 'builtinToolGroupManagementExecuteAgentTasks',
    speak: 'builtinToolGroupManagementSpeak',
    vote: 'builtinToolGroupManagementVote',
  },
  'lobe-skill-store': {
    importFromMarket: 'builtinToolSkillStoreImportFromMarket',
    importSkill: 'builtinToolSkillStoreImportSkill',
    searchSkill: 'builtinToolSkillStoreSearchSkill',
  },
  'lobe-skills': {
    execScript: 'builtinToolSkillsExecScript',
    exportFile: 'builtinToolSkillsExportFile',
    readReference: 'builtinToolSkillsReadReference',
    runSkill: 'builtinToolSkillsRunSkill',
    searchSkill: 'builtinToolSkillsSearchSkill',
  },
};

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
  'lobe-source-set': { readSourceFiles: '读取来源文件', searchSourceSet: '来源集检索' },
  'lobe-agent-builder': {
    getAvailableModels: '获取可用模型',
    installPlugin: '安装插件',
    searchMarketTools: '搜索市场工具',
    updateAgentConfig: '更新 Agent 配置',
    updatePrompt: '更新提示词',
  },
  'lobe-agent-management': {
    callAgent: '调用 Agent',
    createAgent: '创建 Agent',
    deleteAgent: '删除 Agent',
    searchAgent: '搜索 Agent',
    updateAgent: '更新 Agent',
  },
  'lobe-group-agent-builder': {
    batchCreateAgents: '批量创建 Agent',
    createAgent: '创建 Agent',
    getAgentInfo: '获取成员信息',
    getAvailableModels: '获取可用模型',
    installPlugin: '安装插件',
    inviteAgent: '邀请成员',
    removeAgent: '移除成员',
    searchAgent: '搜索 Agent',
    searchMarketTools: '搜索市场工具',
    updateConfig: '更新 Agent 配置',
    updateAgentPrompt: '更新 Agent 提示词',
    updateGroup: '更新群组',
    updateGroupPrompt: '更新群组提示词',
  },
  'lobe-local-system': {
    editLocalFile: '编辑文件',
    getCommandOutput: '获取命令输出',
    globLocalFiles: 'Glob 搜索文件',
    grepContent: '内容搜索',
    killCommand: '终止命令',
    listLocalFiles: '列出文件',
    moveLocalFiles: '移动文件',
    readLocalFile: '读取文件',
    renameLocalFile: '重命名',
    runCommand: '执行命令',
    searchLocalFiles: '搜索文件',
    writeLocalFile: '写入文件',
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
  'lobe-source-set': { readSourceFiles: 'Read source files', searchSourceSet: 'Source set search' },
  'lobe-agent-builder': {
    getAvailableModels: 'Get available models',
    installPlugin: 'Install plugin',
    searchMarketTools: 'Search market tools',
    updateAgentConfig: 'Update agent config',
    updatePrompt: 'Update prompt',
  },
  'lobe-agent-management': {
    callAgent: 'Call agent',
    createAgent: 'Create agent',
    deleteAgent: 'Delete agent',
    searchAgent: 'Search agent',
    updateAgent: 'Update agent',
  },
  'lobe-group-agent-builder': {
    batchCreateAgents: 'Batch create agents',
    createAgent: 'Create agent',
    getAgentInfo: 'Get member info',
    getAvailableModels: 'Get available models',
    installPlugin: 'Install plugin',
    inviteAgent: 'Invite member',
    removeAgent: 'Remove member',
    searchAgent: 'Search agent',
    searchMarketTools: 'Search market tools',
    updateConfig: 'Update agent config',
    updateAgentPrompt: 'Update agent prompt',
    updateGroup: 'Update group',
    updateGroupPrompt: 'Update group prompt',
  },
  'lobe-local-system': {
    editLocalFile: 'Edit file',
    getCommandOutput: 'Get command output',
    globLocalFiles: 'Glob search files',
    grepContent: 'Search content',
    killCommand: 'Kill command',
    listLocalFiles: 'List files',
    moveLocalFiles: 'Move files',
    readLocalFile: 'Read file',
    renameLocalFile: 'Rename',
    runCommand: 'Run command',
    searchLocalFiles: 'Search files',
    writeLocalFile: 'Write file',
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
  optionsOrLocale?: MobileBuiltinDisplayNameOptions | string,
): string | undefined {
  if (!identifier || !apiName) return undefined;
  const options =
    typeof optionsOrLocale === 'string' ? { locale: optionsOrLocale } : optionsOrLocale;
  const i18nKey = DISPLAY_NAME_KEYS[identifier]?.[apiName];
  const localized = i18nKey ? options?.t?.(i18nKey) : undefined;
  if (localized) return localized;

  const locale = options?.locale;
  const isZh = locale?.startsWith('zh');
  const map = isZh ? DISPLAY_NAMES_ZH : DISPLAY_NAMES_EN;
  return map[identifier]?.[apiName];
}
