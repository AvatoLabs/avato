import { useIsFocused } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import {
  Check,
  ChevronDown,
  Clapperboard,
  Download,
  Play,
  Share2,
  Sparkles,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ComposerPrimaryAction, ComposerShell } from '../components/ui/ComposerShell';
import { CreateConfigBar } from '../components/ui/CreateConfigBar';
import EmptyState from '../components/ui/EmptyState';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { aiProviderApi, fileApi, getApiUrl, videoApi } from '../lib/api';
import { useMainTabBottomInsets } from '../lib/bottomChrome';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { ANDROID_COMPOSER_LIFT_ADJUSTMENT, getKeyboardOffset } from '../lib/keyboard';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { GenerationBatch, GenerationItem, GenerationTopic } from '../types';

const DURATION_OPTIONS = [5, 10];
const RATIO_OPTIONS = ['adaptive', '16:9', '9:16', '1:1'];
const RESOLUTION_OPTIONS = ['480p', '720p', '1080p'];
const SIDEBAR_OPTION_GAP = 8;
const VIDEO_POLL_BASE_DELAY_MS = 3500;
const VIDEO_POLL_MAX_ATTEMPTS = 60;
const VIDEO_POLL_MAX_DELAY_MS = 12000;

interface VideoProviderItem {
  id: string;
  logo?: string;
  models: Array<{ displayName?: string; id: string }>;
  name: string;
}

interface SidebarOptionGridProps<T extends string | number> {
  columns: number;
  containerWidth: number;
  getKey: (item: T) => string;
  items: T[];
  onSelect?: (item: T) => void;
  renderContent: (item: T, active: boolean) => React.ReactNode;
  selectedValue?: T;
}

function normalizeVideoStatus(status?: string) {
  switch (status?.toLowerCase()) {
    case 'success': {
      return 'success';
    }
    case 'error': {
      return 'error';
    }
    case 'processing': {
      return 'processing';
    }
    default: {
      return 'pending';
    }
  }
}

function sortVideoTopics(topics: GenerationTopic[]) {
  return [...topics].sort((left, right) => {
    const leftTs = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    const rightTs = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    return leftTs - rightTs;
  });
}

function sortVideoBatches(batches: GenerationBatch[]) {
  return [...batches].sort((left, right) => {
    const leftTs = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    const rightTs = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    return leftTs - rightTs;
  });
}

function getPendingVideoGenerations(batches: GenerationBatch[]) {
  return batches.flatMap((batch) =>
    batch.generations.filter((generation) => {
      const status = normalizeVideoStatus(generation.task?.status);
      return !!generation.asyncTaskId && (status === 'pending' || status === 'processing');
    }),
  );
}

function getPendingVideoSignature(batches: GenerationBatch[]) {
  return getPendingVideoGenerations(batches)
    .map((generation) => `${generation.id}:${normalizeVideoStatus(generation.task?.status)}`)
    .sort()
    .join('|');
}

function resolveAssetUrl(baseUrl: string, url?: string, fileId?: string) {
  if (url?.startsWith('http://') || url?.startsWith('https://')) return url;
  if (url?.startsWith('/')) return `${baseUrl}${url}`;
  if (fileId) return `${baseUrl}/f/${fileId}`;
  return url;
}

function parseRatio(ratio: string) {
  const [width, height] = ratio.split(':').map(Number);
  return { height: height || 1, width: width || 1 };
}

function RatioIcon({ active, ratio }: { active: boolean; ratio: string }) {
  const colors = useThemeColors();
  const borderColor = active ? colors.iconOnPrimary : colors.muted;

  if (ratio === 'adaptive' || !ratio.includes(':')) {
    return (
      <View style={{ alignItems: 'center', height: 16, justifyContent: 'center', width: 16 }}>
        <View
          style={{
            borderColor,
            borderRadius: 2,
            borderStyle: 'dashed',
            borderWidth: 1.5,
            height: 14,
            width: 14,
          }}
        />
      </View>
    );
  }

  const { width, height } = parseRatio(ratio);
  const isLandscape = width > height;

  return (
    <View style={{ alignItems: 'center', height: 16, justifyContent: 'center', width: 16 }}>
      <View
        style={{
          ...(isLandscape ? { width: 14 } : { height: 14 }),
          aspectRatio: width / height,
          borderColor,
          borderRadius: 2,
          borderWidth: 1.5,
        }}
      />
    </View>
  );
}

function SidebarLabel({ right, text }: { right?: React.ReactNode; text: string }) {
  const colors = useThemeColors();

  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        marginTop: 16,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontSize: 15,
          fontWeight: '600',
          letterSpacing: -0.2,
        }}
      >
        {text}
      </Text>
      {right}
    </View>
  );
}

function SidebarOptionGrid<T extends string | number>({
  columns,
  containerWidth,
  getKey,
  items,
  onSelect,
  renderContent,
  selectedValue,
}: SidebarOptionGridProps<T>) {
  const colors = useThemeColors();
  const itemWidth = (containerWidth - SIDEBAR_OPTION_GAP * (columns - 1)) / columns;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((item, index) => {
        const active = selectedValue === item;
        const isRowEnd = (index + 1) % columns === 0;

        return (
          <View
            key={getKey(item)}
            style={{
              marginBottom: SIDEBAR_OPTION_GAP,
              marginRight: isRowEnd ? 0 : SIDEBAR_OPTION_GAP,
              width: itemWidth,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                alignItems: 'center',
                backgroundColor: active ? colors.primary : colors.fillTertiary,
                borderColor: active ? colors.primary : 'transparent',
                borderRadius: 12,
                borderWidth: active ? 1 : 0,
                justifyContent: 'center',
                minHeight: 46,
                paddingHorizontal: 10,
                paddingVertical: 8,
                width: '100%',
              }}
              onPress={() => onSelect?.(item)}
            >
              {renderContent(item, active)}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function VideoStatusBadge({ status }: { status?: string }) {
  const { t } = useI18n();
  const colors = useThemeColors();

  const normalizedStatus = normalizeVideoStatus(status);
  const config =
    normalizedStatus === 'success'
      ? {
          backgroundColor: colors.successSubtle,
          color: colors.success,
          label: t.videoStatusSuccess,
        }
      : normalizedStatus === 'error'
        ? {
            backgroundColor: colors.dangerSubtle,
            color: colors.danger,
            label: t.videoStatusError,
          }
        : normalizedStatus === 'processing'
          ? {
              backgroundColor: colors.fillTertiary,
              color: colors.primary,
              label: t.videoStatusProcessing,
            }
          : {
              backgroundColor: colors.fillTertiary,
              color: colors.secondaryText,
              label: t.videoStatusPending,
            };

  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: config.backgroundColor }}>
      <Text style={{ color: config.color, fontSize: 11, fontWeight: '600' }}>{config.label}</Text>
    </View>
  );
}

function VideoPreviewCard({
  baseUrl,
  batch,
  generation,
  onDownload,
  onOpen,
  onShare,
}: {
  baseUrl: string;
  batch: GenerationBatch;
  generation: GenerationItem;
  onDownload: () => void;
  onOpen: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const status = normalizeVideoStatus(generation.task?.status);
  const previewUrl = resolveAssetUrl(
    baseUrl,
    generation.asset?.thumbnailUrl || generation.asset?.originalUrl,
    undefined,
  );

  return (
    <Animated.View className="mb-3 rounded-2xl bg-card p-3" entering={FadeInDown.duration(260)}>
      <Text
        numberOfLines={3}
        style={{ color: colors.foreground, fontSize: 14, fontWeight: '600', marginBottom: 10 }}
      >
        {batch.prompt}
      </Text>

      <View className="mb-3 flex-row flex-wrap items-center" style={{ gap: 8 }}>
        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.fillTertiary }}>
          <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: '600' }}>
            {batch.model}
          </Text>
        </View>
        {batch.config?.resolution ? (
          <View
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: colors.fillTertiary }}
          >
            <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: '600' }}>
              {String(batch.config.resolution)}
            </Text>
          </View>
        ) : null}
        {batch.config?.aspectRatio ? (
          <View
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: colors.fillTertiary }}
          >
            <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: '600' }}>
              {String(batch.config.aspectRatio)}
            </Text>
          </View>
        ) : null}
        {batch.config?.duration ? (
          <View
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: colors.fillTertiary }}
          >
            <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: '600' }}>
              {batch.config.duration}s
            </Text>
          </View>
        ) : null}
        <VideoStatusBadge status={generation.task?.status} />
      </View>

      <TouchableOpacity
        activeOpacity={status === 'success' ? 0.82 : 1}
        className="overflow-hidden rounded-3xl"
        disabled={status !== 'success'}
        style={{ backgroundColor: colors.fillTertiary, minHeight: 208 }}
        onPress={status === 'success' ? onOpen : undefined}
      >
        {previewUrl ? (
          <View>
            <ExpoImage
              contentFit="cover"
              source={{ uri: previewUrl }}
              style={{ height: 208, width: '100%' }}
            />
            {status === 'success' ? (
              <View className="absolute inset-0 items-center justify-center">
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    backgroundColor: colors.mediaScrim,
                    height: 52,
                    width: 52,
                  }}
                >
                  <Play
                    color={colors.mediaOnBackdrop}
                    fill={colors.mediaOnBackdrop}
                    size={22}
                    strokeWidth={2.2}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="items-center justify-center py-12">
            {status === 'processing' || status === 'pending' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Clapperboard color={colors.secondaryText} size={30} strokeWidth={1.8} />
            )}
            <Text className="mt-3 text-[12px]" style={{ color: colors.secondaryText }}>
              {status === 'success'
                ? t.videoStatusSuccess
                : status === 'error'
                  ? t.videoStatusError
                  : status === 'processing'
                    ? t.videoStatusProcessing
                    : t.videoStatusPending}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {status === 'success' ? (
        <View className="mt-3 flex-row" style={{ gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center rounded-2xl px-4 py-3"
            style={{ backgroundColor: colors.primary }}
            onPress={onOpen}
          >
            <Play
              color={colors.iconOnPrimary}
              fill={colors.iconOnPrimary}
              size={16}
              strokeWidth={2.2}
            />
            <Text
              className="ml-2 text-[14px] font-semibold"
              style={{ color: colors.iconOnPrimary }}
            >
              {t.videoOpenPreview}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            className="items-center justify-center rounded-2xl px-4 py-3"
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={onShare}
          >
            <Share2 color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            className="items-center justify-center rounded-2xl px-4 py-3"
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={onDownload}
          >
            <Download color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
}

interface VideoScreenProps {
  configOpenVersion?: number;
  hideHeader?: boolean;
}

export default function VideoScreen({
  configOpenVersion = 0,
  hideHeader = false,
}: VideoScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useI18n();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const isScreenFocused = useIsFocused();

  const [apiBase, setApiBase] = useState('');
  const [providers, setProviders] = useState<VideoProviderItem[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [modelName, setModelName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('adaptive');
  const [resolution, setResolution] = useState('720p');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [topics, setTopics] = useState<GenerationTopic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [batches, setBatches] = useState<GenerationBatch[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const bottomChrome = useMainTabBottomInsets(keyboardOffset > 0);
  const animatedKeyboard = useAnimatedKeyboard();
  const composerLiftStyle = useAnimatedStyle(() => {
    const lift =
      Platform.OS === 'android'
        ? Math.max(
            0,
            animatedKeyboard.height.value - insets.bottom - ANDROID_COMPOSER_LIFT_ADJUSTMENT,
          )
        : keyboardOffset;

    return {
      transform: [{ translateY: -lift }],
    };
  }, [insets.bottom, keyboardOffset]);
  const composerActive = keyboardOffset > 0 || Boolean(prompt.trim()) || creating;
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollSessionRef = useRef(0);
  const batchesRef = useRef<GenerationBatch[]>([]);
  const lastConfigOpenVersionRef = useRef(configOpenVersion);

  const activeProvider = useMemo(
    () => providers.find((item) => item.id === provider) ?? null,
    [provider, providers],
  );

  const allModels = useMemo(
    () =>
      providers.flatMap((providerItem) =>
        providerItem.models.map((modelItem) => ({
          ...modelItem,
          providerId: providerItem.id,
          providerName: providerItem.name,
        })),
      ),
    [providers],
  );
  const pendingSignature = useMemo(() => getPendingVideoSignature(batches), [batches]);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const closeSidebar = useCallback(() => {
    setShowPicker(false);
    setShowSidebar(false);
  }, []);

  const openSidebar = useCallback(() => {
    haptics.selection();
    setShowSidebar(true);
  }, []);

  useEffect(() => {
    if (configOpenVersion <= lastConfigOpenVersionRef.current) return;

    lastConfigOpenVersionRef.current = configOpenVersion;
    openSidebar();
  }, [configOpenVersion, openSidebar]);

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const state = await aiProviderApi.getRuntimeState();
      const nextProviders = (state?.enabledVideoAiProviders ?? [])
        .map((providerItem) => {
          const models = (state?.enabledAiModels ?? [])
            .filter(
              (modelItem) => modelItem.providerId === providerItem.id && modelItem.type === 'video',
            )
            .map((modelItem) => ({
              displayName: modelItem.displayName,
              id: modelItem.id,
            }));

          return {
            id: providerItem.id,
            logo: providerItem.logo,
            models,
            name: providerItem.name || providerItem.id,
          };
        })
        .filter((providerItem) => providerItem.models.length > 0);

      setProviders(nextProviders);

      if (nextProviders.length > 0) {
        const matchedProvider =
          nextProviders.find(
            (item) =>
              item.id === provider && item.models.some((candidate) => candidate.id === model),
          ) ?? nextProviders[0];
        const matchedModel =
          matchedProvider.models.find((item) => item.id === model) ?? matchedProvider.models[0];

        setProvider(matchedProvider.id);
        setModel(matchedModel.id);
        setModelName(matchedModel.displayName || matchedModel.id);
      } else {
        setProvider('');
        setModel('');
        setModelName('');
      }
    } catch {
      setProviders([]);
      setProvider('');
      setModel('');
      setModelName('');
    } finally {
      setLoadingModels(false);
    }
  }, [model, provider]);

  const loadTopics = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const base = await getApiUrl();
      if (base) setApiBase(base.replace(/\/$/, ''));

      const nextTopics = sortVideoTopics(await videoApi.getTopics().catch(() => []));
      setTopics(nextTopics);

      const nextActiveTopicId =
        nextTopics.find((topic) => topic.id === activeTopicId)?.id ?? nextTopics[0]?.id ?? null;
      setActiveTopicId(nextActiveTopicId);

      if (nextActiveTopicId) {
        const nextBatches = sortVideoBatches(
          await videoApi.getBatches(nextActiveTopicId).catch(() => []),
        );
        setBatches(nextBatches);
      } else {
        setBatches([]);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [activeTopicId]);

  const loadBatches = useCallback(async (topicId: string) => {
    const nextBatches = sortVideoBatches(await videoApi.getBatches(topicId).catch(() => []));
    setBatches(nextBatches);
  }, []);

  const stopPolling = useCallback(() => {
    pollSessionRef.current += 1;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void loadModels();
    void loadTopics();
  }, [loadModels, loadTopics]);

  useEffect(() => {
    if (!activeTopicId) {
      setBatches([]);
      return;
    }

    void loadBatches(activeTopicId);
  }, [activeTopicId, loadBatches]);

  useEffect(() => {
    if (!activeTopicId || !pendingSignature || !isScreenFocused || !isAppActive) {
      stopPolling();
      return;
    }

    stopPolling();

    const sessionId = pollSessionRef.current;
    let attempt = 0;
    let inFlight = false;
    let scheduledTick: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (sessionId !== pollSessionRef.current || attempt >= VIDEO_POLL_MAX_ATTEMPTS) return;

      const delay =
        attempt === 0
          ? 0
          : Math.min(
              VIDEO_POLL_BASE_DELAY_MS * 1.25 ** Math.floor((attempt - 1) / 5),
              VIDEO_POLL_MAX_DELAY_MS,
            );
      scheduledTick = setTimeout(() => {
        void tick();
      }, delay);
      pollTimerRef.current = scheduledTick;
    };

    const tick = async () => {
      if (sessionId !== pollSessionRef.current || inFlight || !isScreenFocused || !isAppActive) {
        return;
      }

      const pending = getPendingVideoGenerations(batchesRef.current);
      if (pending.length === 0) {
        stopPolling();
        return;
      }

      inFlight = true;
      attempt += 1;

      try {
        const updated = await Promise.all(
          pending.map(async (generation) => {
            try {
              const status = await videoApi.getGenerationStatus(
                generation.id,
                generation.asyncTaskId!,
              );
              return {
                ...generation,
                ...status?.generation,
                task: {
                  ...generation.task,
                  ...status?.generation?.task,
                  error: status?.error ?? status?.generation?.task?.error ?? generation.task?.error,
                  status:
                    status?.status || status?.generation?.task?.status || generation.task?.status,
                },
              };
            } catch {
              return generation;
            }
          }),
        );

        if (sessionId !== pollSessionRef.current) return;

        setBatches((current) =>
          current.map((batch) => ({
            ...batch,
            generations: batch.generations.map(
              (generation) => updated.find((item) => item.id === generation.id) ?? generation,
            ),
          })),
        );

        const hasPending = updated.some((generation) => {
          const status = normalizeVideoStatus(generation.task?.status);
          return status === 'pending' || status === 'processing';
        });

        if (!hasPending || attempt >= VIDEO_POLL_MAX_ATTEMPTS) {
          stopPolling();
          return;
        }
        scheduleNext();
      } finally {
        inFlight = false;
      }
    };

    scheduleNext();

    return () => {
      if (scheduledTick) {
        clearTimeout(scheduledTick);
      }
      stopPolling();
    };
  }, [activeTopicId, isAppActive, isScreenFocused, pendingSignature, stopPolling]);

  useEffect(() => {
    const handleKeyboardShow = (event: any) => {
      setKeyboardOffset(getKeyboardOffset(event, insets.bottom));
    };

    const handleKeyboardHide = () => {
      setKeyboardOffset(0);
    };

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
            Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
            Keyboard.addListener('keyboardWillChangeFrame', (event) => {
              if (getKeyboardOffset(event, insets.bottom) <= 0) {
                handleKeyboardHide();
              } else {
                handleKeyboardShow(event);
              }
            }),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
            Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
          ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [insets.bottom]);

  const handleResetTopic = useCallback(() => {
    haptics.light();
    setActiveTopicId(null);
    setBatches([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || !provider || !model) return;

    setCreating(true);
    try {
      let topicId = activeTopicId;
      if (!topicId) {
        topicId = await videoApi.createTopic();
        const title = nextPrompt.slice(0, 32).trim();
        if (title) {
          await videoApi.updateTopic(topicId, { title }).catch(() => undefined);
        }
        setActiveTopicId(topicId);
      }

      await videoApi.createVideo({
        generationTopicId: topicId,
        model,
        params: {
          aspectRatio,
          duration,
          generateAudio,
          prompt: nextPrompt,
          resolution,
        },
        provider,
      });

      haptics.success();
      setPrompt('');
      await loadTopics();
      if (topicId) {
        await loadBatches(topicId);
      }
    } catch {
      toast.show('error', t.videoCreateFailed);
    } finally {
      setCreating(false);
    }
  }, [
    activeTopicId,
    aspectRatio,
    duration,
    generateAudio,
    loadBatches,
    loadTopics,
    model,
    prompt,
    provider,
    resolution,
    t.videoCreateFailed,
    toast,
  ]);

  const handlePreview = useCallback(
    (generation: GenerationItem) => {
      const url = resolveAssetUrl(
        apiBase,
        generation.asset?.url || generation.asset?.originalUrl,
        generation.fileId,
      );
      if (!url) return;
      haptics.light();
      setPreviewUrl(url);
      setPreviewVisible(true);
    },
    [apiBase],
  );

  const handleShare = useCallback(
    async (generation: GenerationItem) => {
      const url = resolveAssetUrl(
        apiBase,
        generation.asset?.url || generation.asset?.originalUrl,
        generation.fileId,
      );
      if (!url) return;

      try {
        await Share.share({ message: url, title: t.videoTitle, url });
      } catch {
        toast.show('error', t.videoShareFailed);
      }
    },
    [apiBase, t.videoShareFailed, t.videoTitle, toast],
  );

  const handleDownload = useCallback(
    async (generation: GenerationItem) => {
      const url = resolveAssetUrl(
        apiBase,
        generation.asset?.url || generation.asset?.originalUrl,
        generation.fileId,
      );
      if (!url || !generation.fileId) return;

      try {
        await fileApi.download({
          id: generation.fileId,
          name: `${generation.id}.mp4`,
          url,
        });
        haptics.success();
      } catch {
        toast.show('error', t.videoDownloadFailed);
      }
    },
    [apiBase, t.videoDownloadFailed, toast],
  );

  const selectedModelLabel =
    modelName || activeProvider?.models.find((item) => item.id === model)?.displayName || model;
  const summaryParts = [
    activeProvider?.name || undefined,
    resolution,
    aspectRatio,
    `${duration}s`,
    generateAudio ? t.videoGenerateAudio : undefined,
  ].filter(Boolean);
  const sidebarWidth = Math.round(screenWidth * 0.85);
  const sidebarPad = 20;

  return (
    <View className="flex-1 bg-background">
      {!hideHeader ? (
        <ScreenHeader
          title={t.videoTitle}
          titleIcon={
            <Clapperboard color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          }
        />
      ) : null}

      {!hideHeader ? (
        <CreateConfigBar
          label={selectedModelLabel || t.videoSelectModel}
          summary={summaryParts.join(' · ') || t.videoNoModels}
          onPress={openSidebar}
        />
      ) : null}

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          loadingHistory
            ? {
                alignItems: 'center',
                flexGrow: 1,
                justifyContent: 'center',
                paddingBottom: 20,
                paddingHorizontal: 20,
              }
            : batches.length === 0
              ? {
                  alignItems: 'center',
                  flexGrow: 1,
                  justifyContent: 'center',
                  paddingBottom: 20,
                  paddingHorizontal: 20,
                }
              : { paddingBottom: 20, paddingHorizontal: 20 }
        }
      >
        {loadingHistory ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : batches.length > 0 ? (
          batches.flatMap((batch) =>
            batch.generations.map((generation) => (
              <VideoPreviewCard
                baseUrl={apiBase}
                batch={batch}
                generation={generation}
                key={generation.id}
                onDownload={() => void handleDownload(generation)}
                onOpen={() => handlePreview(generation)}
                onShare={() => void handleShare(generation)}
              />
            )),
          )
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <EmptyState
              description={t.videoHistoryEmptyDesc}
              iconVariant="artwork"
              title={t.videoHistoryEmpty}
            />
          </View>
        )}
      </ScrollView>

      <Animated.View
        className="px-4 pt-1"
        style={[{ paddingBottom: bottomChrome.composerPaddingBottom }, composerLiftStyle]}
      >
        <ComposerShell active={composerActive}>
          <View className="flex-row items-end gap-2 px-3 pb-2 pt-2">
            <TextInput
              multiline
              className="min-h-[36px] flex-1"
              placeholder={t.videoPromptPlaceholder}
              placeholderTextColor={colors.secondaryText}
              underlineColorAndroid="transparent"
              value={prompt}
              style={{
                color: colors.foreground,
                fontSize: 16,
                lineHeight: 22,
                maxHeight: 112,
                paddingVertical: 0,
                textAlignVertical: 'top',
              }}
              onChangeText={setPrompt}
            />
            <ComposerPrimaryAction
              active={!!prompt.trim() && !!model}
              disabled={!prompt.trim() || !model || creating}
              onPress={() => void handleGenerate()}
            >
              {creating ? (
                <ActivityIndicator color={colors.iconOnPrimary} size="small" />
              ) : (
                <Sparkles
                  color={prompt.trim() && model ? colors.iconOnPrimary : colors.muted}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              )}
            </ComposerPrimaryAction>
          </View>
        </ComposerShell>
      </Animated.View>

      {showSidebar ? (
        <>
          <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(250)}
            style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ backgroundColor: colors.overlayDark, flex: 1 }}
              onPress={closeSidebar}
            />
          </Animated.View>

          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutRight.duration(300)}
            style={{
              backgroundColor: colors.surface,
              borderBottomLeftRadius: 20,
              borderTopLeftRadius: 20,
              bottom: 0,
              elevation: 12,
              position: 'absolute',
              right: 0,
              shadowColor: colors.shadow,
              shadowOffset: { height: 0, width: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              top: 0,
              width: sidebarWidth,
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: Math.max(bottomChrome.overlayListPaddingBottom, 40),
                paddingHorizontal: sidebarPad,
                paddingTop: 60,
              }}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: '700',
                    letterSpacing: -0.3,
                  }}
                >
                  {t.videoTitle}
                </Text>
                <TouchableOpacity hitSlop={8} onPress={closeSidebar}>
                  <X color={colors.iconMuted} size={20} strokeWidth={tokens.icon.strokeWidth} />
                </TouchableOpacity>
              </View>

              <SidebarLabel text={t.videoSelectModel} />
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.fillTertiary,
                  borderRadius: 16,
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
                onPress={() => setShowPicker((current) => !current)}
              >
                <Sparkles color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.foreground,
                    flex: 1,
                    fontSize: 14,
                    fontWeight: '600',
                    marginLeft: 8,
                  }}
                >
                  {selectedModelLabel || t.videoSelectModel}
                </Text>
                <ChevronDown
                  color={colors.iconMuted}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>

              {showPicker ? (
                <Animated.View
                  entering={FadeInDown.duration(350)}
                  style={{
                    backgroundColor: colors.fillTertiary,
                    borderRadius: 12,
                    marginTop: 8,
                    maxHeight: 240,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {loadingModels ? (
                      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <ActivityIndicator color={colors.primary} size="small" />
                      </View>
                    ) : allModels.length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
                          {t.videoNoModels}
                        </Text>
                        <Text
                          style={{
                            color: colors.secondaryText,
                            fontSize: 12,
                            marginTop: 4,
                            textAlign: 'center',
                          }}
                        >
                          {t.videoNoModelsDesc}
                        </Text>
                      </View>
                    ) : (
                      allModels.map((modelItem) => {
                        const active = provider === modelItem.providerId && model === modelItem.id;

                        return (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            key={`${modelItem.providerId}-${modelItem.id}`}
                            style={{
                              alignItems: 'center',
                              backgroundColor: active ? colors.primarySubtle : 'transparent',
                              flexDirection: 'row',
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                            }}
                            onPress={() => {
                              haptics.light();
                              setProvider(modelItem.providerId);
                              setModel(modelItem.id);
                              setModelName(modelItem.displayName || modelItem.id);
                              setShowPicker(false);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: colors.foreground,
                                  fontSize: 13,
                                  fontWeight: '500',
                                }}
                              >
                                {modelItem.displayName || modelItem.id}
                              </Text>
                              <Text style={{ color: colors.muted, fontSize: 10 }}>
                                {modelItem.providerName}
                              </Text>
                            </View>
                            {active ? (
                              <Check
                                color={colors.primary}
                                size={18}
                                strokeWidth={tokens.icon.strokeWidth}
                              />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </Animated.View>
              ) : null}

              <SidebarLabel
                text={t.videoTitle}
                right={
                  <TouchableOpacity
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: colors.primarySubtle }}
                    onPress={() => {
                      handleResetTopic();
                      closeSidebar();
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                      {t.videoNewTopic}
                    </Text>
                  </TouchableOpacity>
                }
              />

              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    alignItems: 'center',
                    backgroundColor: !activeTopicId ? colors.primarySubtle : colors.fillTertiary,
                    borderRadius: 14,
                    flexDirection: 'row',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                  onPress={() => {
                    handleResetTopic();
                    closeSidebar();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
                      {t.videoTopicReset}
                    </Text>
                    <Text style={{ color: colors.secondaryText, fontSize: 11, marginTop: 2 }}>
                      {t.videoNewTopic}
                    </Text>
                  </View>
                  {!activeTopicId ? (
                    <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  ) : null}
                </TouchableOpacity>

                {topics.map((topic) => {
                  const active = topic.id === activeTopicId;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      key={topic.id}
                      style={{
                        alignItems: 'center',
                        backgroundColor: active ? colors.primarySubtle : colors.fillTertiary,
                        borderRadius: 14,
                        flexDirection: 'row',
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                      }}
                      onPress={() => {
                        haptics.light();
                        setActiveTopicId(topic.id);
                        closeSidebar();
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.foreground,
                            fontSize: 14,
                            fontWeight: '600',
                          }}
                        >
                          {topic.title || t.videoTitle}
                        </Text>
                        <Text style={{ color: colors.secondaryText, fontSize: 11, marginTop: 2 }}>
                          {new Date(topic.updatedAt ?? topic.createdAt ?? Date.now())
                            .toLocaleString()
                            .replace(',', '')}
                        </Text>
                      </View>
                      {active ? (
                        <Check
                          color={colors.primary}
                          size={18}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <SidebarLabel text={t.videoDuration} />
              <SidebarOptionGrid
                columns={2}
                containerWidth={sidebarWidth - sidebarPad * 2}
                getKey={(item) => String(item)}
                items={DURATION_OPTIONS}
                selectedValue={duration}
                renderContent={(item, active) => (
                  <Text
                    style={{
                      color: active ? colors.iconOnPrimary : colors.muted,
                      fontSize: 12,
                      fontWeight: '500',
                    }}
                  >
                    {item}s
                  </Text>
                )}
                onSelect={(item) => {
                  haptics.selection();
                  setDuration(Number(item));
                }}
              />

              <SidebarLabel text={t.videoAspectRatio} />
              <SidebarOptionGrid
                columns={2}
                containerWidth={sidebarWidth - sidebarPad * 2}
                getKey={(item) => String(item)}
                items={RATIO_OPTIONS}
                selectedValue={aspectRatio}
                renderContent={(item, active) => (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ marginBottom: 4 }}>
                      <RatioIcon active={active} ratio={String(item)} />
                    </View>
                    <Text
                      style={{
                        color: active ? colors.iconOnPrimary : colors.muted,
                        fontSize: 11,
                        fontWeight: '500',
                      }}
                    >
                      {String(item)}
                    </Text>
                  </View>
                )}
                onSelect={(item) => {
                  haptics.selection();
                  setAspectRatio(String(item));
                }}
              />

              <SidebarLabel text={t.videoResolution} />
              <SidebarOptionGrid
                columns={3}
                containerWidth={sidebarWidth - sidebarPad * 2}
                getKey={(item) => String(item)}
                items={RESOLUTION_OPTIONS}
                selectedValue={resolution}
                renderContent={(item, active) => (
                  <Text
                    style={{
                      color: active ? colors.iconOnPrimary : colors.muted,
                      fontSize: 12,
                      fontWeight: '500',
                    }}
                  >
                    {String(item)}
                  </Text>
                )}
                onSelect={(item) => {
                  haptics.selection();
                  setResolution(String(item));
                }}
              />

              <SidebarLabel text={t.videoGenerateAudio} />
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.fillTertiary,
                  borderRadius: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
                    {t.videoGenerateAudio}
                  </Text>
                </View>
                <Switch
                  thumbColor={generateAudio ? colors.iconOnPrimary : colors.controlKnob}
                  trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
                  value={generateAudio}
                  onValueChange={setGenerateAudio}
                />
              </View>
            </ScrollView>
          </Animated.View>
        </>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={previewVisible}
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View className="flex-1" style={{ backgroundColor: colors.mediaBackdrop }}>
          <Pressable
            className="absolute right-5 top-14 z-10 rounded-full px-4 py-2"
            style={{ backgroundColor: colors.mediaScrim }}
            onPress={() => setPreviewVisible(false)}
          >
            <Text style={{ color: colors.mediaOnBackdrop, fontSize: 14, fontWeight: '600' }}>
              {t.cancel}
            </Text>
          </Pressable>
          {previewUrl ? (
            <WebView
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              source={{
                html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" /><style>html,body{margin:0;background:${colors.mediaBackdrop};height:100%;overflow:hidden}body{display:flex;align-items:center;justify-content:center}video{width:100%;height:100%;object-fit:contain;background:${colors.mediaBackdrop}}</style></head><body><video controls playsinline src="${previewUrl}"></video></body></html>`,
              }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
