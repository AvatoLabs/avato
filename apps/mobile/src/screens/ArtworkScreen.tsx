/**
 * ArtworkScreen — Image generation aligned with web /image
 *
 * Config panel: Model, Reference Images, Resolution, Aspect Ratio, Image Count
 * Prompt input + generate button
 * Generation results feed with status polling
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image as RNImage,
  Keyboard,
  Platform,
  ScrollView,
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ComposerPrimaryAction, ComposerShell } from '../components/ui/ComposerShell';
import { CreateConfigBar } from '../components/ui/CreateConfigBar';
import EmptyState from '../components/ui/EmptyState';
import PromptModal from '../components/ui/PromptModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { aiProviderApi, artworkApi, fileApi, getApiUrl } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useArtworkStore } from '../store/artwork';
import { useConnectionStore } from '../store/connection';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type {
  GenerationBatch,
  GenerationItem,
  ImageGenerationParams,
  ImageModelItem,
  ImageModelParamsSchema,
  ImageParamSchemaItem,
  ImageProviderWithModels,
} from '../types';

// ── Constants ────────────────────────────────────────────────────────
const IMAGE_COUNTS = [1, 2, 4, 8];
const STORAGE_KEY = 'avato_artwork_config';
const EDITABLE_NUMERIC_PARAM_KEYS = ['width', 'height', 'steps', 'cfg', 'seed'] as const;
const PRESET_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];
const SIDEBAR_OPTION_GAP = 8;
const ARTWORK_POLL_MAX_ATTEMPTS = 60;
const ARTWORK_POLL_MAX_DELAY_MS = 15000;

type ArtworkTaskStatus = 'pending' | 'processing' | 'success' | 'error';

function parseRatio(r: string) {
  const [a, b] = r.split(':').map(Number);
  return { rw: a || 1, rh: b || 1 };
}

function getParamDefinition(
  schema: ImageModelParamsSchema | undefined,
  key: keyof ImageGenerationParams,
) {
  return schema?.[key as string];
}

function getParamEnumOptions(
  schema: ImageModelParamsSchema | undefined,
  key: keyof ImageGenerationParams,
): string[] {
  const item = getParamDefinition(schema, key);
  return Array.isArray(item?.enum) ? item.enum.map(String) : [];
}

function getDefaultParams(schema?: ImageModelParamsSchema): ImageGenerationParams {
  if (!schema) return { prompt: '' };
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, value?.default]),
  ) as ImageGenerationParams;
}

function clampNumericValue(value: number, item?: ImageParamSchemaItem) {
  if (typeof item?.min === 'number' && value < item.min) return item.min;
  if (typeof item?.max === 'number' && value > item.max) return item.max;
  return value;
}

function formatParamLabel(key: string) {
  const labels: Record<string, string> = {
    aspectRatio: 'Aspect Ratio',
    cfg: 'CFG',
    imageUrl: 'Reference Image',
    imageUrls: 'Reference Images',
    quality: 'Quality',
    resolution: 'Resolution',
    seed: 'Seed',
    size: 'Size',
    steps: 'Steps',
    width: 'Width',
    height: 'Height',
  };

  return (
    labels[key] || key.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
  );
}

function normalizeParamsForSchema(
  schema: ImageModelParamsSchema | undefined,
  raw: ImageGenerationParams,
) {
  const allowed = new Set<string>(['prompt', ...(schema ? Object.keys(schema) : [])]);
  const normalized = Object.fromEntries(
    Object.entries(raw).filter(([key, value]) => {
      if (!allowed.has(key)) return false;
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  ) as ImageGenerationParams;

  if (Array.isArray(normalized.imageUrls) && normalized.imageUrls.length > 0) {
    delete normalized.imageUrl;
  } else if (normalized.imageUrl) {
    delete normalized.imageUrls;
  }

  return normalized;
}

function normalizeGenerationTaskStatus(status?: string): ArtworkTaskStatus {
  switch (status?.toLowerCase()) {
    case 'error': {
      return 'error';
    }
    case 'processing': {
      return 'processing';
    }
    case 'success': {
      return 'success';
    }
    default: {
      return 'pending';
    }
  }
}

function getGenerationPreviewSources(generation: GenerationItem) {
  return [
    generation.asset?.thumbnailUrl,
    generation.fileId ? `/f/${generation.fileId}` : undefined,
    generation.asset?.url,
    generation.asset?.originalUrl,
  ].filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);
}

function applyRatioToDimensions(ratio: string, base = 1024) {
  const { rw, rh } = parseRatio(ratio);

  if (!rw || !rh) return { width: base, height: base };

  if (rw >= rh) {
    return { width: base, height: Math.round((base * rh) / rw) };
  }

  return { width: Math.round((base * rw) / rh), height: base };
}

function getAspectRatioSelection(
  params: ImageGenerationParams,
  schema: ImageModelParamsSchema | undefined,
) {
  if (getParamDefinition(schema, 'aspectRatio')) {
    return typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined;
  }

  if (typeof params.width !== 'number' || typeof params.height !== 'number') return undefined;

  const ratio = params.width / params.height;
  return PRESET_ASPECT_RATIOS.find((option) => {
    const { rw, rh } = parseRatio(option);
    return Math.abs(ratio - rw / rh) < 0.02;
  });
}

// Proper aspect ratio preview matching web version
function RatioIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const colors = useThemeColors();
  const borderColor = active ? colors.iconOnPrimary : colors.muted;

  if (ratio === 'auto' || !ratio.includes(':')) {
    return (
      <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderWidth: 1.5,
            borderColor,
            borderStyle: 'dashed',
            borderRadius: 2,
          }}
        />
      </View>
    );
  }

  const { rw, rh } = parseRatio(ratio);
  const isWidthGreater = rw > rh;

  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          aspectRatio: rw / rh,
          ...(isWidthGreater ? { width: 14 } : { height: 14 }),
          borderWidth: 1.5,
          borderColor,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

function SidebarLabel({ text, right }: { right?: React.ReactNode; text: string }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
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

interface SidebarOptionGridProps<T extends string | number> {
  columns: number;
  containerWidth: number;
  getKey: (item: T) => string;
  items: T[];
  onSelect?: (item: T) => void;
  renderContent: (item: T, active: boolean) => React.ReactNode;
  selectedValue?: T;
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

interface SidebarOptionStripProps<T extends string | number> {
  getKey: (item: T) => string;
  items: T[];
  itemWidth: number;
  onSelect?: (item: T) => void;
  renderContent: (item: T, active: boolean) => React.ReactNode;
  selectedValue?: T;
}

function SidebarOptionStrip<T extends string | number>({
  getKey,
  itemWidth,
  items,
  onSelect,
  renderContent,
  selectedValue,
}: SidebarOptionStripProps<T>) {
  const colors = useThemeColors();
  return (
    <ScrollView
      horizontal
      contentContainerStyle={{ paddingBottom: 4, paddingRight: 4 }}
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item, index) => {
        const active = selectedValue === item;

        return (
          <TouchableOpacity
            key={getKey(item)}
            style={{
              alignItems: 'center',
              backgroundColor: active ? colors.primary : colors.fillTertiary,
              borderColor: active ? colors.primary : 'transparent',
              borderRadius: 12,
              borderWidth: active ? 1 : 0,
              justifyContent: 'center',
              marginRight: index === items.length - 1 ? 0 : 8,
              minHeight: 46,
              paddingHorizontal: 10,
              paddingVertical: 8,
              width: itemWidth,
            }}
            onPress={() => onSelect?.(item)}
          >
            {renderContent(item, active)}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const map: Record<ArtworkTaskStatus, { bg: string; fg: string; label: string }> = useMemo(
    () => ({
      pending: {
        bg: `${colors.artworkPending}20`,
        fg: colors.artworkPending,
        label: t.artworkPending,
      },
      processing: {
        bg: `${colors.artworkProcessing}20`,
        fg: colors.artworkProcessing,
        label: t.artworkProcessing,
      },
      success: {
        bg: `${colors.artworkSuccess}20`,
        fg: colors.artworkSuccess,
        label: t.artworkSuccess,
      },
      error: {
        bg: `${colors.artworkError}20`,
        fg: colors.artworkError,
        label: t.artworkError,
      },
    }),
    [colors, t],
  );
  const s = map[normalizeGenerationTaskStatus(status)];
  return (
    <View
      style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}
    >
      <Text style={{ color: s.fg, fontSize: 10, fontWeight: '600' }}>{s.label}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
interface ArtworkScreenProps {
  hideHeader?: boolean;
}

export default function ArtworkScreen({ hideHeader = false }: ArtworkScreenProps) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isConnected = useConnectionStore((s) => s.isConnected);
  const isScreenFocused = useIsFocused();

  // Config state
  const [imageProviders, setImageProviders] = useState<ImageProviderWithModels[]>([]);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [modelName, setModelName] = useState('');
  const [paramsSchema, setParamsSchema] = useState<ImageModelParamsSchema>();
  const [generationParams, setGenerationParams] = useState<ImageGenerationParams>({ prompt: '' });
  const [imgCount, setImgCount] = useState(2);
  const [customCountVisible, setCustomCountVisible] = useState(false);
  const [editingParamKey, setEditingParamKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [refImages, setRefImages] = useState<{ uri: string; url?: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const composerTranslateY = Platform.OS === 'ios' ? -keyboardOffset : 0;
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  // Generation state — topicId only for createImage + polling (ephemeral, not persisted)
  const [topicId, setTopicId] = useState<string | null>(null);
  const batches = useArtworkStore((s) => s.batches);
  const addBatch = useArtworkStore((s) => s.addBatch);
  const removeBatch = useArtworkStore((s) => s.removeBatch);
  const updateBatch = useArtworkStore((s) => s.updateBatch);
  const [baseUrl, setBaseUrl] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollSessionRef = useRef(0);
  const canPollRef = useRef(isScreenFocused && isAppActive);
  const hasHydratedRef = useRef(false);
  const hasRestoredConfigRef = useRef(false);
  const configRef = useRef({
    generationParams: { prompt: '' } as ImageGenerationParams,
    imgCount: 2,
    model: '',
    modelName: '',
    provider: '',
  });

  const applyModelSelection = useCallback(
    (
      modelItem: ImageModelItem,
      providerId: string,
      providerName?: string,
      overrides?: ImageGenerationParams,
    ) => {
      const schema = modelItem.parameters;
      const nextParams = normalizeParamsForSchema(schema, {
        ...getDefaultParams(schema),
        ...overrides,
      });

      setProvider(providerId);
      setModel(modelItem.id);
      setModelName(modelItem.displayName || modelItem.id);
      setParamsSchema(schema);
      setGenerationParams(nextParams);

      if (providerName) {
        void providerName;
      }
    },
    [],
  );

  // ── Load image models ──
  const loadModels = useCallback(
    async (restoredConfig?: {
      generationParams?: ImageGenerationParams;
      model?: string;
      provider?: string;
    }) => {
      if (!isConnected) return;
      try {
        const state = await aiProviderApi.getRuntimeState();
        const enabledModels = state?.enabledAiModels ?? [];
        const enabledProviders = state?.enabledAiProviders ?? [];

        // Filter image models and group by provider
        const imgModels = enabledModels.filter((m: any) => m.type === 'image');
        const providerMap = new Map<string, ImageProviderWithModels>();

        for (const m of imgModels) {
          const pid = m.providerId;
          if (!providerMap.has(pid)) {
            const pInfo = enabledProviders.find((p: any) => p.id === pid);
            providerMap.set(pid, {
              id: pid,
              name: pInfo?.name || pid,
              logo: pInfo?.logo,
              children: [],
            });
          }
          providerMap.get(pid)!.children.push({
            id: m.id,
            displayName: m.displayName || m.id,
            parameters: m.parameters,
            type: 'image',
          });
        }

        const imgProviders = Array.from(providerMap.values());
        setImageProviders(imgProviders);

        const preferredProvider = restoredConfig?.provider || configRef.current.provider;
        const preferredModel = restoredConfig?.model || configRef.current.model;
        const matchedProvider =
          imgProviders.find((item) => item.id === preferredProvider) || imgProviders[0];
        const matchedModel =
          matchedProvider?.children.find((item) => item.id === preferredModel) ||
          matchedProvider?.children[0];

        if (matchedProvider && matchedModel) {
          applyModelSelection(
            matchedModel,
            matchedProvider.id,
            matchedProvider.name,
            restoredConfig?.generationParams || configRef.current.generationParams,
          );
        }
      } catch {
        /* silent */
      }
    },
    [applyModelSelection, isConnected],
  );

  // ── Persist/restore config ──
  const saveConfig = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ provider, model, modelName, imgCount, generationParams }),
      );
    } catch {
      /* */
    }
  }, [generationParams, imgCount, model, modelName, provider]);

  const restoreConfig = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as {
          generationParams?: ImageGenerationParams;
          imgCount?: number;
          model?: string;
          modelName?: string;
          provider?: string;
        };
      }
    } catch {
      /* */
    }
    return undefined;
  }, []);

  useEffect(() => {
    configRef.current = {
      generationParams,
      imgCount,
      model,
      modelName,
      provider,
    };
  }, [generationParams, imgCount, model, modelName, provider]);

  // ── Init ──
  useFocusEffect(
    useCallback(() => {
      void useArtworkStore.getState().hydrate();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      hasHydratedRef.current = false;

      void (async () => {
        const nextBaseUrl = await getApiUrl();
        if (!alive) return;
        setBaseUrl(nextBaseUrl);

        let restoredConfig:
          | {
              generationParams?: ImageGenerationParams;
              imgCount?: number;
              model?: string;
              modelName?: string;
              provider?: string;
            }
          | undefined;

        if (!hasRestoredConfigRef.current) {
          restoredConfig = await restoreConfig();
          if (!alive) return;

          if (typeof restoredConfig?.imgCount === 'number') {
            setImgCount(restoredConfig.imgCount);
          }

          hasRestoredConfigRef.current = true;
        }

        await loadModels(restoredConfig);
        if (!alive) return;

        hasHydratedRef.current = true;
      })();

      return () => {
        alive = false;
      };
    }, [loadModels, restoreConfig]),
  );

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    void saveConfig();
  }, [saveConfig]);

  // ── Cleanup polling ──
  const stopPolling = useCallback(() => {
    pollSessionRef.current += 1;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    canPollRef.current = isScreenFocused && isAppActive;
    if (!canPollRef.current) {
      stopPolling();
    }
  }, [isAppActive, isScreenFocused, stopPolling]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ── Keyboard lift: keep composer close to keyboard without double-counting bottom inset ──
  const inputPaddingBottom = Math.max(insets.bottom, 8);
  useEffect(() => {
    const handleKeyboardShow = (event: any) => {
      const coords = event?.endCoordinates;
      const windowHeight = Dimensions.get('window').height;
      const screenY = Number(coords?.screenY ?? windowHeight);
      const offsetFromBottom = windowHeight - screenY;
      setKeyboardOffset(offsetFromBottom > 0 ? offsetFromBottom : 0);
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
              const windowHeight = Dimensions.get('window').height;
              const screenY = Number(event?.endCoordinates?.screenY ?? windowHeight);
              if (screenY >= windowHeight - 1) {
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
  }, [inputPaddingBottom]);

  // ── Pick reference images ──
  const handlePickRef = useCallback(async () => {
    const allowMultiple = Boolean(getParamDefinition(paramsSchema, 'imageUrls'));
    const maxCount = getParamDefinition(paramsSchema, 'imageUrls')?.maxCount;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: allowMultiple,
    });
    if (!result.canceled) {
      const newImgs = result.assets.map((a) => ({ uri: a.uri }));
      setRefImages((prev) => {
        if (!allowMultiple) return newImgs.slice(0, 1);
        const merged = [...prev, ...newImgs];
        return typeof maxCount === 'number' ? merged.slice(0, maxCount) : merged;
      });
    }
  }, [paramsSchema]);

  // ── Fetch batches from remote (for polling only — history is local) ──
  const fetchBatchesFromRemote = useCallback(async (tid: string) => {
    try {
      return await artworkApi.getBatches(tid);
    } catch {
      return undefined;
    }
  }, []);

  // ── Poll generation status (updates local batch from remote, no remote sync for history) ──
  const startPolling = useCallback(
    (tid: string, batchId: string, batchGenerations: GenerationItem[]) => {
      if (!canPollRef.current) return;

      stopPolling();
      const pendingGenerationIds = new Set(
        batchGenerations
          .filter((g) => {
            const status = normalizeGenerationTaskStatus(g.task?.status);
            return g.asyncTaskId && status !== 'success' && status !== 'error';
          })
          .map((g) => g.id),
      );
      if (pendingGenerationIds.size === 0) return;

      const sessionId = pollSessionRef.current;
      let attempt = 0;
      let inFlight = false;

      const tick = async () => {
        if (sessionId !== pollSessionRef.current || inFlight || !canPollRef.current) return;
        inFlight = true;

        try {
          attempt += 1;

          const latestBatches = await fetchBatchesFromRemote(tid);
          if (sessionId !== pollSessionRef.current || !canPollRef.current) return;

          const remoteBatch = (latestBatches || []).find((b) => b.id === batchId);
          if (remoteBatch) {
            updateBatch(batchId, () => remoteBatch);
          }

          const latestPending = (latestBatches || [])
            .flatMap((batch) => batch.generations)
            .filter((generation) => {
              const status = normalizeGenerationTaskStatus(generation.task?.status);
              return (
                pendingGenerationIds.has(generation.id) &&
                status !== 'success' &&
                status !== 'error'
              );
            });

          const allDone = latestPending.length === 0;
          if (allDone || attempt >= ARTWORK_POLL_MAX_ATTEMPTS) {
            if (sessionId === pollSessionRef.current) {
              stopPolling();
            }
            return;
          }

          const delay = Math.min(2000 * 1.5 ** Math.floor(attempt / 5), ARTWORK_POLL_MAX_DELAY_MS);
          pollRef.current = setTimeout(tick, delay);
        } catch {
          if (sessionId === pollSessionRef.current) {
            stopPolling();
          }
        } finally {
          inFlight = false;
        }
      };

      pollRef.current = setTimeout(tick, 0);
    },
    [fetchBatchesFromRemote, stopPolling, updateBatch],
  );

  const pollableBatch = useMemo(() => {
    if (!topicId) return null;

    for (let index = batches.length - 1; index >= 0; index -= 1) {
      const batch = batches[index];
      if (batch.generationTopicId !== topicId) continue;

      const hasPending = batch.generations.some((generation) => {
        const status = normalizeGenerationTaskStatus(generation.task?.status);
        return !!generation.asyncTaskId && status !== 'success' && status !== 'error';
      });
      if (hasPending) return batch;
    }

    return null;
  }, [batches, topicId]);

  const pollableBatchSignature = useMemo(() => {
    if (!pollableBatch) return '';

    return pollableBatch.generations
      .filter((generation) => {
        const status = normalizeGenerationTaskStatus(generation.task?.status);
        return !!generation.asyncTaskId && status !== 'success' && status !== 'error';
      })
      .map((generation) => `${generation.id}:${normalizeGenerationTaskStatus(generation.task?.status)}`)
      .sort()
      .join('|');
  }, [pollableBatch]);

  const pollableBatchId = pollableBatch?.id ?? null;
  const pollableGenerations = pollableBatch?.generations ?? null;

  useEffect(() => {
    if (
      !topicId ||
      !pollableBatchId ||
      !pollableGenerations ||
      !pollableBatchSignature ||
      !isScreenFocused ||
      !isAppActive
    ) {
      stopPolling();
      return;
    }

    startPolling(topicId, pollableBatchId, pollableGenerations);

    return stopPolling;
  }, [
    isAppActive,
    isScreenFocused,
    pollableGenerations,
    pollableBatchId,
    pollableBatchSignature,
    startPolling,
    stopPolling,
    topicId,
  ]);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !model || generating) return;
    haptics.medium();
    setGenerating(true);

    try {
      // Upload reference images if any
      const uploadedUrls: string[] = [];
      let failedUploadCount = 0;
      const supportsImageUrl = Boolean(getParamDefinition(paramsSchema, 'imageUrl'));
      const supportsImageUrls = Boolean(getParamDefinition(paramsSchema, 'imageUrls'));
      const imagesToUpload = refImages
        .map((image, index) => ({ image, index }))
        .slice(0, supportsImageUrls ? refImages.length : 1);

      for (const { image: img, index } of imagesToUpload) {
        if (img.url) {
          uploadedUrls.push(img.url);
        } else {
          try {
            const uploaded = await fileApi.upload(img.uri, 'reference.jpg', 'image/jpeg');
            uploadedUrls.push(uploaded.url);
            setRefImages((prev) =>
              prev.map((item, itemIndex) =>
                itemIndex === index ? { ...item, url: uploaded.url } : item,
              ),
            );
          } catch {
            failedUploadCount += 1;
          }
        }
      }

      if (failedUploadCount > 0 && uploadedUrls.length === 0 && refImages.length > 0) {
        toast.show('error', t.fileUploadError);
        return;
      }
      if (failedUploadCount > 0) {
        toast.show('info', t.fileUploadFailed);
      }

      // Create topic if needed
      let tid = topicId;
      if (!tid) {
        const newTid = await artworkApi.createTopic();
        if (newTid) {
          tid = newTid;
          setTopicId(newTid);
        }
      }
      if (!tid) throw new Error('Failed to create topic');

      const rawParams: ImageGenerationParams = {
        ...generationParams,
        prompt: prompt.trim(),
      };

      if (supportsImageUrls && uploadedUrls.length > 0) {
        rawParams.imageUrls = uploadedUrls;
      } else if (supportsImageUrl && uploadedUrls.length > 0) {
        rawParams.imageUrl = uploadedUrls[0];
      }

      const nextParams = normalizeParamsForSchema(paramsSchema, rawParams);

      // Create image
      const result = await artworkApi.createImage({
        generationTopicId: tid,
        imageNum: imgCount,
        model,
        provider,
        params: nextParams,
      });

      if (result?.data?.generations) {
        // Fetch batch with task/status for polling; add to local history (no remote sync)
        const loadedBatches = await fetchBatchesFromRemote(tid);
        const newBatch = loadedBatches?.find((b) => b.id === result.data.batch.id);
        const batchToAdd = newBatch ?? {
          ...result.data.batch,
          generations: result.data.generations,
        };
        addBatch(batchToAdd);
      }

      setPrompt('');
    } catch {
      toast.show('error', t.artworkErrorDesc);
    } finally {
      setGenerating(false);
    }
  }, [
    generationParams,
    paramsSchema,
    prompt,
    model,
    provider,
    generating,
    refImages,
    topicId,
    imgCount,
    addBatch,
    fetchBatchesFromRemote,
    t,
    toast,
  ]);

  // ── Resolve image URL ──
  const resolveUrl = useCallback(
    (url?: string) => {
      if (!url) return undefined;
      if (url.startsWith('http')) return url;
      return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    },
    [baseUrl],
  );

  // ── Render ──
  const containerPad = 20;
  const sidebarWidth = Math.round(screenWidth * 0.85);
  const sidebarPad = 20;
  const allModels = imageProviders.flatMap((p) =>
    p.children.map((m) => ({ ...m, providerId: p.id, providerName: p.name })),
  );
  const resolutionOptions = getParamEnumOptions(paramsSchema, 'resolution');
  const sizeOptions = getParamEnumOptions(paramsSchema, 'size');
  const qualityOptions = getParamEnumOptions(paramsSchema, 'quality');
  const aspectRatioOptions = getParamEnumOptions(paramsSchema, 'aspectRatio');
  const supportsImageUrl = Boolean(getParamDefinition(paramsSchema, 'imageUrl'));
  const supportsImageUrls = Boolean(getParamDefinition(paramsSchema, 'imageUrls'));
  const supportsNativeAspectRatio = Boolean(getParamDefinition(paramsSchema, 'aspectRatio'));
  const supportsWidthHeight =
    Boolean(getParamDefinition(paramsSchema, 'width')) &&
    Boolean(getParamDefinition(paramsSchema, 'height'));
  const referenceEnabled = supportsImageUrl || supportsImageUrls;
  const effectiveAspectRatioOptions =
    aspectRatioOptions.length > 0
      ? aspectRatioOptions
      : supportsWidthHeight
        ? PRESET_ASPECT_RATIOS
        : [];
  const currentAspectRatio = getAspectRatioSelection(generationParams, paramsSchema);
  const imageCountSelection: number | string = IMAGE_COUNTS.includes(imgCount)
    ? imgCount
    : 'custom';
  const summaryParts = [
    generationParams.resolution ? String(generationParams.resolution) : undefined,
    generationParams.size ? String(generationParams.size) : undefined,
    generationParams.quality ? String(generationParams.quality) : undefined,
    currentAspectRatio ? String(currentAspectRatio) : undefined,
    typeof generationParams.width === 'number' && typeof generationParams.height === 'number'
      ? `${generationParams.width}×${generationParams.height}`
      : undefined,
    `×${imgCount}`,
  ].filter(Boolean);
  const numericEditorTitle = editingParamKey ? formatParamLabel(editingParamKey) : '';
  const numericEditorDefaultValue =
    editingParamKey && generationParams[editingParamKey] != null
      ? String(generationParams[editingParamKey])
      : '';

  return (
    <View className="flex-1 bg-background">
      {/* ── Header ── */}
      {!hideHeader ? (
        <ScreenHeader
          title={t.artworkTitle}
          titleIcon={
            <Palette color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          }
        />
      ) : null}

      <CreateConfigBar
        label={modelName || t.artworkSelectModel}
        summary={summaryParts.join(' · ')}
        onPress={() => {
          haptics.selection();
          setShowSidebar(true);
        }}
      />

      {/* ── Generation Feed ── */}
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          batches.length === 0
            ? {
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: 20,
                paddingHorizontal: containerPad,
              }
            : { paddingBottom: 20, paddingHorizontal: containerPad }
        }
      >
        {batches.length > 0 ? (
          batches.map((batch) => (
            <BatchCard
              availableWidth={screenWidth - containerPad * 2}
              batch={batch}
              key={batch.id}
              resolveUrl={resolveUrl}
              onCopyPrompt={async () => {
                await Clipboard.setStringAsync(batch.prompt);
                toast.show('success', t.artworkPromptCopied);
              }}
              onDelete={async () => {
                Alert.alert(t.artworkDeleteBatch, t.artworkDeleteBatchConfirm, [
                  { text: t.cancel, style: 'cancel' },
                  {
                    text: t.delete,
                    style: 'destructive',
                    onPress: () => {
                      removeBatch(batch.id);
                    },
                  },
                ]);
              }}
              onReuseSettings={() => {
                const nextProvider = imageProviders.find((item) => item.id === batch.provider);
                const nextModel = nextProvider?.children.find((item) => item.id === batch.model);
                if (!nextProvider || !nextModel) return;

                const { seed, ...configWithoutSeed } = (batch.config ||
                  {}) as ImageGenerationParams;
                void seed;

                applyModelSelection(
                  nextModel,
                  nextProvider.id,
                  nextProvider.name,
                  configWithoutSeed,
                );
                setPrompt(batch.prompt);
                setRefImages([]);
                setImgCount(batch.generations.length);
                setShowSidebar(true);
              }}
            />
          ))
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <EmptyState
              description={t.artworkEmptyDesc}
              iconVariant="artwork"
              title={t.artworkEmpty}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Prompt Bar — aligned with ChatDetail input pill, lifts with keyboard ── */}
      <Animated.View
        className="px-4 pt-1"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          transform: [{ translateY: composerTranslateY }],
        }}
      >
        <ComposerShell active={keyboardOffset > 0}>
          <View className="flex-row items-end gap-2 px-3 pt-2 pb-2">
            <TextInput
              multiline
              className="flex-1 min-h-[36px]"
              maxLength={2000}
              placeholder={t.artworkPromptPlaceholder}
              placeholderTextColor={colors.muted}
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
              disabled={!prompt.trim() || !model || generating}
              onPress={handleGenerate}
            >
              {generating ? (
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

      {/* ── Config Sidebar Overlay ── */}
      {showSidebar && (
        <>
          <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(250)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1, backgroundColor: colors.overlayDark }}
              onPress={() => setShowSidebar(false)}
            />
          </Animated.View>
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutRight.duration(300)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: sidebarWidth,
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderBottomLeftRadius: 20,
              shadowColor: colors.shadow,
              shadowOffset: { width: -4, height: 0 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: sidebarPad,
                paddingTop: 60,
                paddingBottom: 40,
              }}
            >
              {/* Sidebar header */}
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: '700',
                    letterSpacing: -0.3,
                  }}
                >
                  {t.artworkTitle}
                </Text>
                <TouchableOpacity hitSlop={8} onPress={() => setShowSidebar(false)}>
                  <X color={colors.iconMuted} size={20} strokeWidth={tokens.icon.strokeWidth} />
                </TouchableOpacity>
              </View>

              {/* Model Selector */}
              <SidebarLabel text={t.artworkModel} />
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.fillTertiary,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
                onPress={() => setShowPicker(!showPicker)}
              >
                <Sparkles color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: '600',
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  {modelName || t.artworkSelectModel}
                </Text>
                <ChevronDown
                  color={colors.iconMuted}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              {showPicker && (
                <Animated.View
                  entering={FadeInDown.duration(350)}
                  style={{
                    backgroundColor: colors.fillTertiary,
                    borderRadius: 12,
                    marginTop: 8,
                    maxHeight: 208,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {allModels.length === 0 ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <Text style={{ color: colors.muted, fontSize: 14 }}>
                          {t.artworkNoModels}
                        </Text>
                        <Text style={{ color: colors.secondaryText, fontSize: 12, marginTop: 4 }}>
                          {t.artworkNoModelsDesc}
                        </Text>
                      </View>
                    ) : (
                      allModels.map((m) => (
                        <TouchableOpacity
                          key={`${m.providerId}-${m.id}`}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: model === m.id ? colors.fillTertiary : 'transparent',
                          }}
                          onPress={() => {
                            haptics.selection();
                            applyModelSelection(m, m.providerId, m.providerName);
                            setShowPicker(false);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ color: colors.foreground, fontSize: 13, fontWeight: '500' }}
                            >
                              {m.displayName || m.id}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 10 }}>
                              {m.providerName}
                            </Text>
                          </View>
                          {model === m.id && (
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: colors.primary,
                              }}
                            />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </Animated.View>
              )}

              {referenceEnabled && (
                <>
                  <SidebarLabel
                    text={formatParamLabel(supportsImageUrls ? 'imageUrls' : 'imageUrl')}
                  />
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.fillTertiary,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 20,
                    }}
                    onPress={handlePickRef}
                  >
                    {refImages.length > 0 ? (
                      <ScrollView
                        horizontal
                        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                        showsHorizontalScrollIndicator={false}
                      >
                        {refImages.map((img, i) => (
                          <View key={i} style={{ position: 'relative' }}>
                            <RNImage
                              source={{ uri: img.uri }}
                              style={{ width: 64, height: 64, borderRadius: 10 }}
                            />
                            <TouchableOpacity
                              style={{
                                position: 'absolute',
                                top: -5,
                                right: -5,
                                backgroundColor: colors.sliderTrack,
                                borderRadius: 10,
                                padding: 2,
                              }}
                              onPress={() => setRefImages((p) => p.filter((_, idx) => idx !== i))}
                            >
                              <X color={colors.iconMuted} size={10} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <>
                        <ImageIcon color={colors.secondaryText} size={28} strokeWidth={1.5} />
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: 12,
                            marginTop: 6,
                            textAlign: 'center',
                          }}
                        >
                          {t.artworkReferenceImagesDesc}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {resolutionOptions.length > 0 && (
                <>
                  <SidebarLabel text={formatParamLabel('resolution')} />
                  <SidebarOptionStrip
                    getKey={(option) => String(option)}
                    itemWidth={116}
                    items={resolutionOptions}
                    selectedValue={generationParams.resolution as string | undefined}
                    renderContent={(option, active) => (
                      <Text
                        style={{
                          color: active ? colors.iconOnPrimary : colors.muted,
                          fontSize: 12,
                          fontWeight: '500',
                        }}
                      >
                        {option}
                      </Text>
                    )}
                    onSelect={(option) => {
                      haptics.selection();
                      setGenerationParams((state) => ({ ...state, resolution: option }));
                    }}
                  />
                </>
              )}

              {sizeOptions.length > 0 && (
                <>
                  <SidebarLabel text={formatParamLabel('size')} />
                  <SidebarOptionGrid
                    columns={2}
                    containerWidth={sidebarWidth - sidebarPad * 2}
                    getKey={(option) => String(option)}
                    items={sizeOptions}
                    selectedValue={generationParams.size as string | undefined}
                    renderContent={(option, active) => (
                      <Text
                        style={{
                          color: active ? colors.iconOnPrimary : colors.muted,
                          fontSize: 12,
                          fontWeight: '500',
                        }}
                      >
                        {option}
                      </Text>
                    )}
                    onSelect={(option) => {
                      haptics.selection();
                      setGenerationParams((state) => ({ ...state, size: option }));
                    }}
                  />
                </>
              )}

              {qualityOptions.length > 0 && (
                <>
                  <SidebarLabel text={formatParamLabel('quality')} />
                  <SidebarOptionGrid
                    columns={2}
                    containerWidth={sidebarWidth - sidebarPad * 2}
                    getKey={(option) => String(option)}
                    items={qualityOptions}
                    selectedValue={generationParams.quality as string | undefined}
                    renderContent={(option, active) => (
                      <Text
                        style={{
                          color: active ? colors.iconOnPrimary : colors.muted,
                          fontSize: 12,
                          fontWeight: '500',
                        }}
                      >
                        {option}
                      </Text>
                    )}
                    onSelect={(option) => {
                      haptics.selection();
                      setGenerationParams((state) => ({ ...state, quality: option }));
                    }}
                  />
                </>
              )}

              {effectiveAspectRatioOptions.length > 0 && (
                <>
                  <SidebarLabel text={formatParamLabel('aspectRatio')} />
                  <SidebarOptionStrip
                    getKey={(option) => String(option)}
                    itemWidth={86}
                    items={effectiveAspectRatioOptions}
                    selectedValue={currentAspectRatio}
                    renderContent={(option, active) => (
                      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ marginBottom: 2 }}>
                          <RatioIcon active={active} ratio={option} />
                        </View>
                        <Text
                          style={{
                            color: active ? colors.iconOnPrimary : colors.muted,
                            fontSize: 10,
                            fontWeight: '500',
                          }}
                        >
                          {option}
                        </Text>
                      </View>
                    )}
                    onSelect={(option) => {
                      haptics.selection();
                      if (supportsNativeAspectRatio) {
                        setGenerationParams((state) => ({ ...state, aspectRatio: option }));
                        return;
                      }

                      if (supportsWidthHeight) {
                        const widthItem = getParamDefinition(paramsSchema, 'width');
                        const heightItem = getParamDefinition(paramsSchema, 'height');
                        const base =
                          Number(generationParams.width) || Number(generationParams.height) || 1024;
                        const dims = applyRatioToDimensions(option, base);

                        setGenerationParams((state) => {
                          const next = {
                            ...state,
                            width: clampNumericValue(dims.width, widthItem),
                            height: clampNumericValue(dims.height, heightItem),
                          };
                          delete next.aspectRatio;
                          return next;
                        });
                      }
                    }}
                  />
                </>
              )}

              {EDITABLE_NUMERIC_PARAM_KEYS.filter((key) =>
                getParamDefinition(paramsSchema, key),
              ).map((key) => (
                <View key={key}>
                  <SidebarLabel text={formatParamLabel(key)} />
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.fillTertiary,
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                    onPress={() => setEditingParamKey(key)}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
                      {generationParams[key] === null || generationParams[key] === undefined
                        ? 'Auto'
                        : String(generationParams[key])}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {typeof getParamDefinition(paramsSchema, key)?.min === 'number' &&
                      typeof getParamDefinition(paramsSchema, key)?.max === 'number'
                        ? `${getParamDefinition(paramsSchema, key)?.min}-${getParamDefinition(paramsSchema, key)?.max}`
                        : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Number of Images */}
              <SidebarLabel text={t.artworkImageCount} />
              <SidebarOptionStrip
                getKey={(item) => String(item)}
                itemWidth={58}
                items={[...IMAGE_COUNTS, 'custom']}
                selectedValue={imageCountSelection}
                renderContent={(item, active) => (
                  <Text
                    style={{
                      color: active ? colors.iconOnPrimary : colors.muted,
                      fontSize: 12,
                      fontWeight: '500',
                    }}
                  >
                    {item === 'custom' ? '+' : item}
                  </Text>
                )}
                onSelect={(item) => {
                  haptics.selection();
                  if (item === 'custom') {
                    setCustomCountVisible(true);
                    return;
                  }

                  setImgCount(Number(item));
                }}
              />
            </ScrollView>
          </Animated.View>
        </>
      )}

      <PromptModal
        defaultValue={String(imgCount)}
        keyboardType="number-pad"
        submitLabel={t.confirm}
        title={t.artworkImageCountCustom}
        visible={customCountVisible}
        onCancel={() => setCustomCountVisible(false)}
        onSubmit={(val) => {
          setCustomCountVisible(false);
          const n = Number(val);
          if (n > 0 && n <= 16) setImgCount(n);
        }}
      />
      <PromptModal
        defaultValue={numericEditorDefaultValue}
        keyboardType={editingParamKey === 'cfg' ? 'decimal-pad' : 'number-pad'}
        submitLabel={t.confirm}
        title={numericEditorTitle}
        visible={Boolean(editingParamKey)}
        onCancel={() => setEditingParamKey(null)}
        onSubmit={(value) => {
          if (!editingParamKey) return;

          if (value.trim() === '') {
            setGenerationParams((state) => {
              const next = { ...state };
              delete next[editingParamKey];
              return next;
            });
            setEditingParamKey(null);
            return;
          }

          const parsed = Number(value);
          if (Number.isNaN(parsed)) {
            setEditingParamKey(null);
            return;
          }

          const schemaItem = getParamDefinition(
            paramsSchema,
            editingParamKey as keyof ImageGenerationParams,
          );
          const nextValue = clampNumericValue(parsed, schemaItem);

          setGenerationParams((state) => ({
            ...state,
            [editingParamKey]: nextValue,
          }));
          setEditingParamKey(null);
        }}
      />
    </View>
  );
}

function GenerationPreview({
  cols,
  generation,
  imgH,
  imgW,
  resolveUrl,
}: {
  cols: number;
  generation: GenerationItem;
  imgH: number;
  imgW: number;
  resolveUrl: (url?: string) => string | undefined;
}) {
  const candidateUrls = getGenerationPreviewSources(generation)
    .map((url) => resolveUrl(url))
    .filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [
    generation.asset?.originalUrl,
    generation.asset?.thumbnailUrl,
    generation.asset?.url,
    generation.fileId,
  ]);

  const activeUrl = candidateUrls[activeIndex];

  if (!activeUrl) return null;

  return (
    <RNImage
      resizeMode={cols === 1 ? 'contain' : 'cover'}
      source={{ uri: activeUrl }}
      style={{ width: imgW, height: imgH }}
      onError={() => {
        if (activeIndex >= candidateUrls.length - 1) return;
        setActiveIndex((current) => Math.min(current + 1, candidateUrls.length - 1));
      }}
    />
  );
}

// ── BatchCard ────────────────────────────────────────────────────────
function BatchCard({
  batch,
  availableWidth,
  resolveUrl,
  onCopyPrompt,
  onDelete,
  onReuseSettings,
}: {
  availableWidth: number;
  batch: GenerationBatch;
  onCopyPrompt: () => void;
  onDelete: () => void;
  onReuseSettings: () => void;
  resolveUrl: (url?: string) => string | undefined;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const gap = 6;
  const cols = batch.generations.length === 1 ? 1 : 2;
  const cardInnerPadding = 24;
  const gridWidth = Math.max(availableWidth - cardInnerPadding, 0);
  const imgW = Math.floor((gridWidth - gap * (cols - 1)) / cols);
  const previewWidth = batch.width || batch.generations[0]?.asset?.width;
  const previewHeight = batch.height || batch.generations[0]?.asset?.height;
  const imgH =
    cols === 1 && previewWidth && previewHeight
      ? Math.max(Math.round((imgW * previewHeight) / previewWidth), 1)
      : imgW;

  return (
    <Animated.View className="bg-card rounded-2xl p-3 mb-3" entering={FadeInDown.duration(350)}>
      {/* Prompt */}
      <Text numberOfLines={3} style={{ color: colors.foreground, fontSize: 13, marginBottom: 8 }}>
        {batch.prompt}
      </Text>

      {/* Meta */}
      <View className="flex-row items-center gap-2 mb-2">
        <View
          style={{
            backgroundColor: colors.fillTertiary,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: colors.secondaryText, fontSize: 10, fontWeight: '500' }}>
            {batch.model}
          </Text>
        </View>
        {batch.width && batch.height && (
          <View
            style={{
              backgroundColor: colors.fillTertiary,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: colors.secondaryText, fontSize: 10, fontWeight: '500' }}>
              {batch.width}×{batch.height}
            </Text>
          </View>
        )}
        <View
          style={{
            backgroundColor: colors.fillTertiary,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: colors.secondaryText, fontSize: 10, fontWeight: '500' }}>
            ×{batch.generations.length}
          </Text>
        </View>
      </View>

      {/* Generation grid — align with web SuccessState: fileId, asset.url, asset.thumbnailUrl */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {batch.generations.map((gen) => {
          const status = normalizeGenerationTaskStatus(gen.task.status);
          const hasPreview = getGenerationPreviewSources(gen).length > 0;
          const isDone = status === 'success' && hasPreview;
          const isErr = status === 'error';
          return (
            <View
              key={gen.id}
              style={{
                width: imgW,
                height: imgH,
                borderRadius: 12,
                backgroundColor: colors.fillTertiary,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isDone ? (
                <GenerationPreview
                  cols={cols}
                  generation={gen}
                  imgH={imgH}
                  imgW={imgW}
                  resolveUrl={resolveUrl}
                />
              ) : isErr ? (
                <View className="items-center p-2">
                  <Text style={{ color: colors.danger, fontSize: 10, fontWeight: '600' }}>
                    {t.artworkError}
                  </Text>
                </View>
              ) : (
                <View className="items-center">
                  <ActivityIndicator color={colors.iconMuted} size="small" />
                  <StatusBadge status={status} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View className="flex-row items-center justify-end mt-2 gap-3">
        <TouchableOpacity hitSlop={8} onPress={onReuseSettings}>
          <Sparkles color={colors.iconMuted} size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={onCopyPrompt}>
          <Copy color={colors.iconMuted} size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={onDelete}>
          <Trash2 color={colors.danger} size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
