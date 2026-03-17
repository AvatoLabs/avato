/**
 * ModelPickerScreen — Select model for global default or per-session.
 *
 * Aligns with web: fetches enabled providers + models from server runtime state,
 * groups by provider, and allows selection. Falls back to a static list if the
 * server is unreachable.
 */
import { ArrowLeft, Check, RefreshCw, WifiOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image as RNImage, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import { agentApi, agentGroupApi, aiProviderApi, sessionApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { isGroupSessionLike } from '../lib/session';
import { useAgentStore } from '../store/agent';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';
import type { ProviderWithModels, RuntimeEnabledModel } from '../types';

// ── Fallback static list (used when server is unreachable) ─────────
interface FallbackModel {
  displayName: string;
  id: string;
  provider: string;
  /** The actual provider id used in API calls (e.g. 'openai', 'anthropic') */
  providerId: string;
  tags?: string[];
}

const FALLBACK_MODELS: FallbackModel[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'OpenAI',
    providerId: 'openai',
    tags: ['Popular', 'Multimodal'],
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    tags: ['Fast', 'Affordable'],
  },
  {
    id: 'o3-mini',
    displayName: 'o3 Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    tags: ['Reasoning'],
  },
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'Anthropic',
    providerId: 'anthropic',
    tags: ['Popular'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    providerId: 'anthropic',
    tags: ['Fast'],
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'Google',
    providerId: 'google',
    tags: ['Fast'],
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Google',
    providerId: 'google',
    tags: ['Powerful'],
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek V3',
    provider: 'DeepSeek',
    providerId: 'deepseek',
    tags: ['Affordable'],
  },
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek R1',
    provider: 'DeepSeek',
    providerId: 'deepseek',
    tags: ['Reasoning'],
  },
];

function groupFallbackByProvider(models: FallbackModel[]) {
  const map: Record<string, FallbackModel[]> = {};
  for (const m of models) {
    (map[m.provider] ??= []).push(m);
  }
  return Object.entries(map);
}

interface ServerModelSection {
  data: RuntimeEnabledModel[];
  logo?: string;
  providerId: string;
  title: string;
}

interface FallbackModelSection {
  data: FallbackModel[];
  providerId: string;
  title: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function buildProviderModelTree(
  providers: { id: string; name?: string; logo?: string }[],
  models: RuntimeEnabledModel[],
): ProviderWithModels[] {
  // Deduplicate providers by id (server may return duplicates)
  const seen = new Set<string>();
  const uniqueProviders = providers.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return uniqueProviders
    .map((p) => {
      // Deduplicate models within each provider by model id
      const childSeen = new Set<string>();
      const children = models.filter((m) => {
        if (m.providerId !== p.id || m.type !== 'chat') return false;
        if (childSeen.has(m.id)) return false;
        childSeen.add(m.id);
        return true;
      });
      return { id: p.id, name: p.name || p.id, logo: p.logo, children };
    })
    .filter((p) => p.children.length > 0);
}

function getAbilityTags(m: RuntimeEnabledModel): string[] {
  const tags: string[] = [];
  if (m.abilities?.vision) tags.push('Vision');
  if (m.abilities?.functionCall) tags.push('Tools');
  if (m.abilities?.reasoning) tags.push('Reasoning');
  if (m.abilities?.search) tags.push('Search');
  if (m.contextWindowTokens) {
    const k = Math.round(m.contextWindowTokens / 1000);
    tags.push(k >= 1000 ? `${Math.round(k / 1000)}M` : `${k}K`);
  }
  return tags;
}

function providerInitials(id: string): string {
  const map: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AN',
    google: 'GE',
    azure: 'AZ',
    deepseek: 'DS',
    openrouter: 'OR',
    ollama: 'OL',
    groq: 'GQ',
    mistral: 'MI',
    perplexity: 'PX',
    together: 'TG',
    fireworks: 'FW',
    bedrock: 'BK',
    zhipu: 'ZP',
    minimax: 'MX',
    moonshot: 'MS',
    qwen: 'QW',
    stepfun: 'SF',
    baichuan: 'BC',
  };
  return map[id] ?? id.slice(0, 2).toUpperCase();
}

/** Renders a provider logo as a round Image with initials fallback */
function ProviderLogo({
  providerId,
  logo,
  size = 28,
}: {
  providerId: string;
  logo?: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const url = logo || getProviderIconUrl(providerId);

  if (imgError) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text className="text-foreground/60 text-[10px] font-semibold">
          {providerInitials(providerId)}
        </Text>
      </View>
    );
  }

  return (
    <RNImage
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setImgError(true)}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────

export default function ModelPickerScreen({ navigation, route }: any) {
  const sessionId: string | undefined = route.params?.sessionId;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const sessionType = useSessionStore(
    (s) => s.sessions.find((item) => item.id === sessionId)?.type,
  );
  const isGroupSession = isGroupSessionLike(sessionId, sessionType);

  const [selected, setSelected] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [serverModels, setServerModels] = useState<ProviderWithModels[] | null>(null);
  const toast = useToast();

  // ── Load selected model from Agent Config or default Agent ─────────
  useEffect(() => {
    (async () => {
      if (sessionId && !isGroupSession) {
        try {
          const config = await agentApi.getConfigBySession(sessionId);
          if (config?.model) {
            setSelected(config.model);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      if (sessionId && isGroupSession) {
        try {
          const groupDetail = await agentGroupApi.getGroupDetail(sessionId);
          const supervisor = groupDetail?.agents?.find(
            (agent: { id: string; model?: string; provider?: string }) =>
              agent.id === groupDetail?.supervisorAgentId,
          );
          if (supervisor?.model) {
            setSelected(supervisor.model);
            return;
          }
        } catch {
          /* ignore */
        }

        const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
        if (session?.model) setSelected(session.model);
        return;
      }

      const agentStore = useAgentStore.getState();
      if (!agentStore.initialized) await agentStore.loadAgents();
      const agent = agentStore.getCurrentAgent();
      if (agent?.model) setSelected(agent.model);
    })();
  }, [isGroupSession, sessionId]);

  // ── Fetch provider→model tree from server ────────────────────────
  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const state = await aiProviderApi.getRuntimeState();
      if (state?.enabledChatAiProviders && state?.enabledAiModels) {
        const tree = buildProviderModelTree(state.enabledChatAiProviders, state.enabledAiModels);
        setServerModels(tree);
      }
    } catch {
      // Server unreachable — will use fallback
      setServerModels(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // ── Selection handler ────────────────────────────────────────────
  const handleSelect = useCallback(
    async (modelId: string, providerId: string) => {
      haptics.selection();
      setSelected(modelId);

      if (sessionId && isGroupSession) {
        try {
          const groupDetail = await agentGroupApi.getGroupDetail(sessionId);
          if (groupDetail?.supervisorAgentId) {
            await agentApi.updateConfig(groupDetail.supervisorAgentId, {
              model: modelId,
              provider: providerId,
            });
          }
        } catch {
          /* best-effort */
        }
        useSessionStore
          .getState()
          .updateSessionMeta(sessionId, { model: modelId, provider: providerId });
        toast.show('success', t.settingsSavedModel);
        setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 200);
        return;
      }

      if (sessionId && !isGroupSession) {
        try {
          const config = await agentApi.getConfigBySession(sessionId);
          if (config?.id) {
            await agentApi.updateConfig(config.id, { model: modelId, provider: providerId });
          } else {
            await sessionApi.updateSessionConfig(sessionId, {
              model: modelId,
              provider: providerId,
            });
          }
        } catch {
          /* best-effort */
        }
        useSessionStore
          .getState()
          .updateSessionMeta(sessionId, { model: modelId, provider: providerId });
      } else {
        const agentStore = useAgentStore.getState();
        if (!agentStore.initialized) await agentStore.loadAgents();
        let current = agentStore.getCurrentAgent();
        if (!current && agentStore.agents.length === 0) {
          const newId = await agentStore.createAgent({
            model: modelId,
            provider: providerId,
            title: 'Default',
          });
          current = agentStore.agents.find((a) => a.id === newId) ?? null;
        }
        if (current) {
          await agentStore.updateAgent(current.id, { model: modelId, provider: providerId });
        }
      }

      toast.show('success', t.settingsSavedModel);
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 200);
    },
    [isGroupSession, navigation, sessionId, t.settingsSavedModel, toast],
  );

  // ── Filter ───────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase();

  const serverSections = useMemo<ServerModelSection[]>(() => {
    if (!serverModels) return [];

    return serverModels
      .map((p) => ({
        data: p.children.filter(
          (m) =>
            !q ||
            (m.displayName || m.id).toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q),
        ),
        logo: p.logo,
        providerId: p.id,
        title: p.name,
      }))
      .filter((section) => section.data.length > 0);
  }, [q, serverModels]);

  const fallbackSections = useMemo<FallbackModelSection[]>(() => {
    return groupFallbackByProvider(
      FALLBACK_MODELS.filter(
        (m) =>
          !q || m.displayName.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
      ),
    ).map(([provider, models]) => ({
      data: models,
      providerId: provider.toLowerCase().replaceAll(/\s+/g, ''),
      title: provider,
    }));
  }, [q]);

  const renderServerItem = useCallback(
    ({ item, section }: { item: RuntimeEnabledModel; section: ServerModelSection }) => {
      const tags = getAbilityTags(item);
      return (
        <PressableScale
          accessibilityLabel={item.displayName || item.id}
          accessibilityRole="button"
          className="mx-4 mb-px bg-foreground/5 flex-row items-center px-4 py-3.5"
          style={{ borderRadius: 16 }}
          onPress={() => handleSelect(item.id, section.providerId)}
        >
          <View className="mr-3">
            <ProviderLogo logo={section.logo} providerId={section.providerId} size={28} />
          </View>
          <View className="flex-1">
            <Text
              className={`text-[15px] font-medium tracking-tight ${selected === item.id ? 'text-primary' : 'text-foreground'}`}
            >
              {item.displayName || item.id}
            </Text>
            {tags.length > 0 && (
              <View className="flex-row flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <View className="bg-foreground/5 px-2 py-0.5 rounded-full" key={tag}>
                    <Text className="text-secondary/60 text-[10px] font-medium">{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {selected === item.id && (
            <Check color={semanticColors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          )}
        </PressableScale>
      );
    },
    [handleSelect, selected],
  );

  const renderFallbackItem = useCallback(
    ({ item, section }: { item: FallbackModel; section: FallbackModelSection }) => (
      <PressableScale
        accessibilityLabel={item.displayName}
        accessibilityRole="button"
        className="mx-4 mb-px bg-foreground/5 flex-row items-center px-4 py-3.5"
        style={{ borderRadius: 16 }}
        onPress={() => handleSelect(item.id, item.providerId)}
      >
        <View className="mr-3">
          <ProviderLogo providerId={section.providerId} size={28} />
        </View>
        <View className="flex-1">
          <Text
            className={`text-[15px] font-medium tracking-tight ${selected === item.id ? 'text-primary' : 'text-foreground'}`}
          >
            {item.displayName}
          </Text>
          {item.tags && item.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {item.tags.map((tag) => (
                <View className="bg-foreground/5 px-2 py-0.5 rounded-full" key={tag}>
                  <Text className="text-secondary/60 text-[10px] font-medium">{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {selected === item.id && (
          <Check color={semanticColors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        )}
      </PressableScale>
    ),
    [handleSelect, selected],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.modelPickerTitle}
        leftElement={
          <ArrowLeft
            color={semanticColors.primary}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        }
        onPressLeft={() => navigation.canGoBack() && navigation.goBack()}
      />

      {/* Search */}
      <View className="px-5 py-2 bg-background z-10">
        <SearchField
          placeholder={t.modelPickerSearch}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={semanticColors.primary} size="large" />
          <Text className="text-secondary/50 text-[13px] mt-3 font-medium">{t.loading}</Text>
        </View>
      ) : serverModels ? (
        <SectionList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24), paddingTop: 8 }}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderServerItem}
          sections={serverSections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          windowSize={8}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-secondary/50 text-[14px]">{t.discoverNoResults}</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center px-5 mt-4 mb-2">
              <ProviderLogo logo={section.logo} providerId={section.providerId} size={18} />
              <Text className="ml-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
                {section.title}
              </Text>
            </View>
          )}
        />
      ) : (
        <SectionList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24), paddingTop: 8 }}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderFallbackItem}
          sections={fallbackSections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          windowSize={8}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-secondary/50 text-[14px]">{t.discoverNoResults}</Text>
            </View>
          }
          ListHeaderComponent={
            <View className="mx-5 mb-3 flex-row items-center bg-foreground/5 rounded-xl px-4 py-3">
              <WifiOff color="#999" size={14} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-2 text-secondary/60 text-[12px] font-medium flex-1">
                {t.modelPickerOffline}
              </Text>
              <PressableScale onPress={fetchModels}>
                <RefreshCw
                  color={semanticColors.primary}
                  size={14}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </PressableScale>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center px-5 mt-4 mb-2">
              <ProviderLogo providerId={section.providerId} size={18} />
              <Text className="ml-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
                {section.title}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
