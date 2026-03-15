/**
 * ModelPickerScreen — Select model for global default or per-session.
 *
 * Aligns with web: fetches enabled providers + models from server runtime state,
 * groups by provider, and allows selection. Falls back to a static list if the
 * server is unreachable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Check, RefreshCw, WifiOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image as RNImage, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import { aiProviderApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';
import type { ProviderWithModels, RuntimeEnabledModel } from '../types';

const STORAGE_KEY_MODEL = 'avato_default_model';
const STORAGE_KEY_PROVIDER = 'avato_default_provider';

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

  const [selected, setSelected] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [serverModels, setServerModels] = useState<ProviderWithModels[] | null>(null);
  const toast = useToast();

  // ── Load selected model ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (sessionId) {
        const raw = await AsyncStorage.getItem(`avato_chat_settings_${sessionId}`);
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (saved.model) {
              setSelected(saved.model);
              return;
            }
          } catch {
            /* ignore */
          }
        }
      }
      const global = await AsyncStorage.getItem(STORAGE_KEY_MODEL);
      if (global) setSelected(global);
    })();
  }, [sessionId]);

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
  const handleSelect = async (modelId: string, providerId: string) => {
    haptics.selection();
    setSelected(modelId);

    // Resolve vision capability from the loaded model tree
    let supportsVision = false;
    if (serverModels) {
      for (const provider of serverModels) {
        const found = provider.children.find((m) => m.id === modelId && provider.id === providerId);
        if (found) {
          supportsVision = !!found.abilities?.vision;
          break;
        }
      }
    }

    if (sessionId) {
      let existing: Record<string, unknown> = {};
      try {
        const raw = await AsyncStorage.getItem(`avato_chat_settings_${sessionId}`);
        if (raw) existing = JSON.parse(raw);
      } catch {
        /* ignore */
      }
      existing.model = modelId;
      existing.provider = providerId;
      existing.vision = supportsVision;
      await AsyncStorage.setItem(`avato_chat_settings_${sessionId}`, JSON.stringify(existing));

      // Immediately reflect in session store so recent-list logo updates instantly
      useSessionStore
        .getState()
        .updateSessionMeta(sessionId, { model: modelId, provider: providerId });
    } else {
      await AsyncStorage.setItem(STORAGE_KEY_MODEL, modelId);
      await AsyncStorage.setItem(STORAGE_KEY_PROVIDER, providerId);
    }

    toast.show('success', t.settingsSavedModel);
    setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, 200);
  };

  // ── Filter ───────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase();

  // ── Render: Server models (provider-grouped) ─────────────────────
  const renderServerModels = () => {
    if (!serverModels) return null;
    const filtered = serverModels
      .map((p) => ({
        ...p,
        children: p.children.filter(
          (m) =>
            !q ||
            (m.displayName || m.id).toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q),
        ),
      }))
      .filter((p) => p.children.length > 0);

    if (filtered.length === 0) {
      return (
        <View className="items-center py-16">
          <Text className="text-secondary/50 text-[14px]">{t.discoverNoResults}</Text>
        </View>
      );
    }

    return filtered.map((provider, gi) => (
      <Animated.View entering={FadeInDown.delay(gi * 50).duration(250)} key={provider.id}>
        <View className="flex-row items-center px-5 mt-4 mb-2">
          <ProviderLogo logo={provider.logo} providerId={provider.id} size={18} />
          <Text className="ml-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
            {provider.name}
          </Text>
        </View>
        <View className="mx-4 bg-foreground/5 rounded-2xl overflow-hidden">
          {provider.children.map((model) => {
            const tags = getAbilityTags(model);
            return (
              <PressableScale
                accessibilityLabel={model.displayName || model.id}
                accessibilityRole="button"
                className="flex-row items-center px-4 py-3.5"
                key={model.id}
                onPress={() => handleSelect(model.id, provider.id)}
              >
                <View className="mr-3">
                  <ProviderLogo logo={provider.logo} providerId={provider.id} size={28} />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-medium tracking-tight ${selected === model.id ? 'text-primary' : 'text-foreground'}`}
                  >
                    {model.displayName || model.id}
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
                {selected === model.id && (
                  <Check
                    color={semanticColors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                )}
              </PressableScale>
            );
          })}
        </View>
      </Animated.View>
    ));
  };

  // ── Render: Fallback static models ───────────────────────────────
  const renderFallbackModels = () => {
    const groups = groupFallbackByProvider(
      FALLBACK_MODELS.filter(
        (m) =>
          !q || m.displayName.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
      ),
    );

    return (
      <>
        {/* Offline banner */}
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
        {groups.map(([provider, models], gi) => {
          const pid = provider.toLowerCase().replaceAll(/\s+/g, '');
          return (
            <Animated.View entering={FadeInDown.delay(gi * 50).duration(250)} key={provider}>
              <View className="flex-row items-center px-5 mt-4 mb-2">
                <ProviderLogo providerId={pid} size={18} />
                <Text className="ml-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
                  {provider}
                </Text>
              </View>
              <View className="mx-4 bg-foreground/5 rounded-2xl overflow-hidden">
                {models.map((model) => (
                  <PressableScale
                    accessibilityLabel={model.displayName}
                    accessibilityRole="button"
                    className="flex-row items-center px-4 py-3.5"
                    key={model.id}
                    onPress={() => handleSelect(model.id, model.providerId)}
                  >
                    <View className="mr-3">
                      <ProviderLogo providerId={pid} size={28} />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-[15px] font-medium tracking-tight ${selected === model.id ? 'text-primary' : 'text-foreground'}`}
                      >
                        {model.displayName}
                      </Text>
                      {model.tags && model.tags.length > 0 && (
                        <View className="flex-row flex-wrap gap-1 mt-1">
                          {model.tags.map((tag) => (
                            <View className="bg-foreground/5 px-2 py-0.5 rounded-full" key={tag}>
                              <Text className="text-secondary/60 text-[10px] font-medium">
                                {tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    {selected === model.id && (
                      <Check
                        color={semanticColors.primary}
                        size={20}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                    )}
                  </PressableScale>
                ))}
              </View>
            </Animated.View>
          );
        })}
      </>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.modelPickerTitle}
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
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}>
          {serverModels ? renderServerModels() : renderFallbackModels()}
        </ScrollView>
      )}
    </View>
  );
}
