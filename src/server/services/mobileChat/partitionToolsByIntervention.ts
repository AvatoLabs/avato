import {
  createDefaultGlobalAudits,
  DEFAULT_SECURITY_BLACKLIST,
  InterventionChecker,
} from '@lobechat/agent-runtime';
import type {
  ChatToolPayload,
  ExtendedHumanInterventionConfig,
  HumanInterventionConfig,
  HumanInterventionPolicy,
  LobeToolManifest,
  UserInterventionConfig,
} from '@lobechat/types';

/**
 * Partition tool calls by intervention requirement.
 * Mirrors GeneralChatAgent.checkInterventionNeeded for mobile chat flow.
 */
export function partitionToolsByIntervention(
  toolsCalling: ChatToolPayload[],
  userInterventionConfig: UserInterventionConfig | undefined,
  manifestMap: Record<string, LobeToolManifest>,
): [ChatToolPayload[], ChatToolPayload[]] {
  const toolsNeedingIntervention: ChatToolPayload[] = [];
  const toolsToExecute: ChatToolPayload[] = [];

  const userConfig = userInterventionConfig || { approvalMode: 'manual' };
  const { approvalMode, allowList = [] } = userConfig;
  const globalResolvers = createDefaultGlobalAudits();

  for (const toolCalling of toolsCalling) {
    const { identifier, apiName } = toolCalling;
    const toolKey = `${identifier}/${apiName}`;

    let toolArgs: Record<string, any> = {};
    try {
      toolArgs = JSON.parse(toolCalling.arguments || '{}');
    } catch {
      //
    }

    let globalBlocked = false;
    let globalPolicy: HumanInterventionPolicy = 'always';
    for (const audit of globalResolvers) {
      const resolverFn = typeof audit.resolver === 'function' ? audit.resolver : undefined;
      if (resolverFn?.(toolArgs, {})) {
        globalBlocked = true;
        globalPolicy = (audit as any).policy ?? 'always';
        break;
      }
    }

    if (approvalMode === 'headless') {
      if (globalBlocked && globalPolicy === 'always') continue;
      toolsToExecute.push(toolCalling);
      continue;
    }

    if (globalBlocked && globalPolicy === 'always') {
      toolsNeedingIntervention.push(toolCalling);
      continue;
    }

    const config = getToolInterventionConfig(toolCalling, manifestMap);
    const isDynamicConfig = isDynamicInterventionConfig(config);
    const staticConfig = isDynamicConfig
      ? undefined
      : (config as HumanInterventionConfig | undefined);

    if (isDynamicConfig && config) {
      // Dynamic config without resolver: default to required (safe)
      toolsNeedingIntervention.push(toolCalling);
      continue;
    }

    if (globalBlocked && globalPolicy !== 'always') {
      toolsNeedingIntervention.push(toolCalling);
      continue;
    }

    if (matchesAlwaysPolicy(staticConfig, toolArgs)) {
      toolsNeedingIntervention.push(toolCalling);
      continue;
    }

    if (approvalMode === 'auto-run') {
      toolsToExecute.push(toolCalling);
      continue;
    }

    if (approvalMode === 'allow-list') {
      if (allowList.includes(toolKey)) {
        toolsToExecute.push(toolCalling);
      } else {
        toolsNeedingIntervention.push(toolCalling);
      }
      continue;
    }

    const policy = InterventionChecker.shouldIntervene({
      config: staticConfig,
      securityBlacklist: DEFAULT_SECURITY_BLACKLIST,
      toolArgs,
    });

    if (policy === 'never') {
      toolsToExecute.push(toolCalling);
    } else {
      toolsNeedingIntervention.push(toolCalling);
    }
  }

  return [toolsNeedingIntervention, toolsToExecute];
}

function getToolInterventionConfig(
  toolCalling: ChatToolPayload,
  manifestMap: Record<string, LobeToolManifest>,
): ExtendedHumanInterventionConfig | undefined {
  const { identifier, apiName } = toolCalling;
  const manifest = manifestMap[identifier];
  if (!manifest) return undefined;

  const api = manifest.api?.find((a: any) => a.name === apiName);
  return api?.humanIntervention ?? manifest.humanIntervention;
}

function isDynamicInterventionConfig(config: ExtendedHumanInterventionConfig | undefined): boolean {
  return !!(config && typeof config === 'object' && !Array.isArray(config) && 'dynamic' in config);
}

function matchesAlwaysPolicy(
  config: HumanInterventionConfig | undefined,
  toolArgs: Record<string, any>,
): boolean {
  if (!config) return false;
  if (config === 'always') return true;
  if (!Array.isArray(config)) return false;

  return config.some((rule) => {
    if (rule.policy !== 'always') return false;
    if (!rule.match) return true;
    return Object.entries(rule.match).every(([paramName, matcher]) => {
      const paramValue = toolArgs[paramName];
      if (paramValue === undefined) return false;
      if (typeof matcher === 'string') {
        return String(paramValue).includes(matcher) || matcher.includes('*');
      }
      return true;
    });
  });
}
