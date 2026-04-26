import { useCallback, useEffect, useState } from 'react';

import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import { agentApi, agentSkillApi, pluginApi, sessionApi, userApi } from '../lib/api';
import { buildBuiltinSkillItems, partitionSkillPickerItems } from '../lib/chatSkills';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { loadSkillPickerSelection, saveSkillPickerSelection } from '../lib/skillPicker';
import type { AgentSkillItem, InstalledPlugin } from '../types';

export function useChatDetailSkills({
  isGroupSession,
  sessionId,
}: {
  isGroupSession: boolean;
  sessionId?: string;
}) {
  const { t } = useI18n();
  const [skillsSheetVisible, setSkillsSheetVisible] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<
    ReturnType<typeof buildBuiltinSkillItems>
  >([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(() => new Set());
  const [agentId, setAgentId] = useState<string | null>(null);

  const resolveBuiltinText = useCallback(
    (key: string, fallback: string) => {
      const value = (t as Record<string, string | undefined>)[key];
      return typeof value === 'string' ? value : fallback;
    },
    [t],
  );

  useEffect(() => {
    if (!sessionId || isGroupSession) {
      setAgentId(null);
      setEnabledPlugins(new Set());
      return;
    }

    Promise.all([
      agentApi.getConfigBySession(sessionId).catch(() => null),
      loadSkillPickerSelection(),
    ])
      .then(([config, persistedSelection]) => {
        if (config) {
          setAgentId(config.id);
          setEnabledPlugins(
            new Set(Array.isArray(config.plugins) ? config.plugins : persistedSelection),
          );
        } else {
          setAgentId(null);
          setEnabledPlugins(new Set(persistedSelection));
          console.warn('[ChatDetailScreen] no agent config for session:', sessionId);
        }
      })
      .catch((error) => {
        console.error('[ChatDetailScreen] failed to load agent config:', error);
      });
  }, [isGroupSession, sessionId]);

  const openSkillsSheet = useCallback(() => {
    if (isGroupSession) return;

    haptics.light();
    setSkillsSheetVisible(true);
    setBuiltinSkillItems(
      buildBuiltinSkillItems(MOBILE_RECOMMENDED_BUILTIN_SKILLS, resolveBuiltinText),
    );
    setLoadingSkills(true);

    const loadSkills = async (attempt = 0): Promise<void> => {
      const maxAttempts = 2;

      try {
        const [plugins, skills, userState] = await Promise.all([
          pluginApi.list().catch((error) => {
            if (attempt === 0) console.warn('[ChatDetailScreen] pluginApi.list failed:', error);
            return [];
          }),
          agentSkillApi.list().catch((error) => {
            if (attempt === 0) console.warn('[ChatDetailScreen] agentSkillApi.list failed:', error);
            return [];
          }),
          userApi.getState().catch(() => null),
        ]);

        const builtinItems = buildBuiltinSkillItems(
          MOBILE_RECOMMENDED_BUILTIN_SKILLS,
          resolveBuiltinText,
          userState?.settings?.tool?.uninstalledBuiltinTools ?? [],
        );
        const { filteredPlugins, filteredSkills } = partitionSkillPickerItems({
          builtinItems,
          plugins: plugins ?? [],
          skills: skills ?? [],
        });

        setBuiltinSkillItems(builtinItems);
        setAgentSkillItems(filteredSkills);
        setInstalledPlugins(filteredPlugins);
      } catch (error) {
        console.warn('[ChatDetailScreen] loadSkills failed:', error);
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          return loadSkills(attempt + 1);
        }
      }
    };

    void loadSkills().finally(() => setLoadingSkills(false));
  }, [isGroupSession, resolveBuiltinText]);

  const togglePlugin = useCallback(
    (identifier: string) => {
      if (!sessionId) return;

      haptics.light();
      setEnabledPlugins((prev) => {
        const next = new Set(prev);

        if (next.has(identifier)) {
          next.delete(identifier);
        } else {
          next.add(identifier);
        }

        const pluginArr = [...next];
        void saveSkillPickerSelection(pluginArr);

        if (agentId) {
          agentApi.updateConfig(agentId, { plugins: pluginArr }).catch(console.error);
        } else {
          agentApi
            .getConfigBySession(sessionId)
            .then((config) => {
              if (config?.id) {
                setAgentId(config.id);
                agentApi.updateConfig(config.id, { plugins: pluginArr }).catch(console.error);
              } else {
                sessionApi
                  .updateSessionConfig(sessionId, { plugins: pluginArr })
                  .catch(console.error);
              }
            })
            .catch(console.error);
        }

        return next;
      });
    },
    [agentId, sessionId],
  );

  return {
    agentSkillItems,
    builtinSkillItems,
    closeSkillsSheet: () => setSkillsSheetVisible(false),
    enabledPlugins,
    installedPlugins,
    loadingSkills,
    openSkillsSheet,
    skillsSheetVisible,
    togglePlugin,
  };
}
