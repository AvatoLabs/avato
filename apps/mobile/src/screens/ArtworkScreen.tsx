/**
 * ArtworkScreen — Image generation aligned with web /image
 *
 * Config panel: Model, Reference Images, Resolution, Aspect Ratio, Image Count
 * Prompt input + generate button
 * Generation results feed with status polling
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronDown,
  Copy,
  Image as ImageIcon,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
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

import PromptModal from '../components/ui/PromptModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import { aiProviderApi, artworkApi, fileApi, getApiUrl } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useConnectionStore } from '../store/connection';
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
const SECONDARY_BAR_HEIGHT = 48;
const SIDEBAR_OPTION_GAP = 8;

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

function sanitizeParams(params: ImageGenerationParams) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
    ),
  ) as ImageGenerationParams;
}

// Proper aspect ratio preview matching web version
function RatioIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const borderColor = active ? '#fff' : '#555';

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
      <Text style={{ color: '#333', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>
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
                backgroundColor: active ? semanticColors.primary : '#f5f5f5',
                borderColor: active ? semanticColors.primary : '#e7e7e7',
                borderRadius: 12,
                borderWidth: 1,
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

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    Pending: { bg: '#f59e0b20', fg: '#f59e0b', label: t.artworkPending },
    Processing: { bg: '#3b82f620', fg: '#3b82f6', label: t.artworkProcessing },
    Success: { bg: '#10b98120', fg: '#10b981', label: t.artworkSuccess },
    Error: { bg: '#ef444420', fg: '#ef4444', label: t.artworkError },
  };
  const s = map[status] || map.Pending;
  return (
    <View
      style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}
    >
      <Text style={{ color: s.fg, fontSize: 10, fontWeight: '600' }}>{s.label}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function ArtworkScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isConnected = useConnectionStore((s) => s.isConnected);

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

  // Generation state
  const [topicId, setTopicId] = useState<string | null>(null);
  const [batches, setBatches] = useState<GenerationBatch[]>([]);
  const [baseUrl, setBaseUrl] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasHydratedRef = useRef(false);
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
      const nextParams = sanitizeParams({
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

  const hydrateScreen = useCallback(async () => {
    hasHydratedRef.current = false;

    const nextBaseUrl = await getApiUrl();
    setBaseUrl(nextBaseUrl);

    const restoredConfig = await restoreConfig();

    if (restoredConfig?.imgCount) setImgCount(restoredConfig.imgCount);

    await loadModels(restoredConfig);
    hasHydratedRef.current = true;
  }, [loadModels, restoreConfig]);

  // ── Init ──
  useFocusEffect(
    useCallback(() => {
      void hydrateScreen();
    }, [hydrateScreen]),
  );

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    void saveConfig();
  }, [saveConfig]);

  // ── Cleanup polling ──
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
      toast.show('success', t.toastFilePicked);
    }
  }, [paramsSchema, t, toast]);

  // ── Load batches for topic ──
  const loadBatches = useCallback(async (tid: string) => {
    try {
      const data = await artworkApi.getBatches(tid);
      if (data) setBatches(data);
      return data;
    } catch {
      /* */
    }
    return undefined;
  }, []);

  // ── Poll generation status ──
  const startPolling = useCallback(
    (tid: string, batchGenerations: GenerationItem[]) => {
      if (pollRef.current) clearInterval(pollRef.current);
      const pendingGenerationIds = new Set(
        batchGenerations
          .filter((g) => g.asyncTaskId && g.task.status !== 'Success' && g.task.status !== 'Error')
          .map((g) => g.id),
      );
      if (pendingGenerationIds.size === 0) return;

      let count = 0;
      pollRef.current = setInterval(
        async () => {
          count++;
          try {
            const latestBatches = await loadBatches(tid);
            const latestPending = (latestBatches || [])
              .flatMap((batch) => batch.generations)
              .filter(
                (generation) =>
                  pendingGenerationIds.has(generation.id) &&
                  generation.task.status !== 'Success' &&
                  generation.task.status !== 'Error',
              );

            const allDone = latestPending.length === 0;
            if (allDone || count > 60) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        },
        Math.min(2000 * Math.pow(1.5, Math.floor(count / 5)), 15000),
      );
    },
    [loadBatches],
  );

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
      const imagesToUpload = supportsImageUrls ? refImages : refImages.slice(0, 1);

      for (const img of imagesToUpload) {
        if (img.url) {
          uploadedUrls.push(img.url);
        } else {
          try {
            const uploaded = await fileApi.upload(img.uri, 'reference.jpg', 'image/jpeg');
            uploadedUrls.push(uploaded.url);
            img.url = uploaded.url;
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

      const nextParams = sanitizeParams({
        ...generationParams,
        prompt: prompt.trim(),
        ...(supportsImageUrls && uploadedUrls.length > 0 ? { imageUrls: uploadedUrls } : {}),
        ...(supportsImageUrl && uploadedUrls.length > 0 ? { imageUrl: uploadedUrls[0] } : {}),
      });

      // Create image
      const result = await artworkApi.createImage({
        generationTopicId: tid,
        imageNum: imgCount,
        model,
        provider,
        params: nextParams,
      });

      if (result?.data?.generations) {
        // Start polling for status
        await loadBatches(tid);
        startPolling(tid, result.data.generations);
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
    loadBatches,
    startPolling,
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
  const referenceEnabled = supportsImageUrl || supportsImageUrls;
  const effectiveAspectRatioOptions =
    aspectRatioOptions.length > 0
      ? aspectRatioOptions
      : getParamDefinition(paramsSchema, 'width') && getParamDefinition(paramsSchema, 'height')
        ? PRESET_ASPECT_RATIOS
        : [];
  const summaryParts = [
    generationParams.resolution ? String(generationParams.resolution) : undefined,
    generationParams.size ? String(generationParams.size) : undefined,
    generationParams.quality ? String(generationParams.quality) : undefined,
    generationParams.aspectRatio ? String(generationParams.aspectRatio) : undefined,
    typeof generationParams.width === 'number' && typeof generationParams.height === 'number'
      ? `${generationParams.width}×${generationParams.height}`
      : undefined,
    `×${imgCount}`,
  ].filter(Boolean);
  const numericEditorTitle = editingParamKey ? formatParamLabel(editingParamKey) : '';
  const numericEditorDefaultValue =
    editingParamKey && generationParams[editingParamKey] !== undefined
      ? String(generationParams[editingParamKey])
      : '';

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* ── Header ── */}
      <ScreenHeader title={t.artworkTitle} />

      {/* ── Model & Config Bar (matches ResourceScreen tab bar height) ── */}
      <View className="border-b border-gray-100 dark:border-gray-800">
        <View
          className="flex-row items-center px-4"
          style={{ minHeight: SECONDARY_BAR_HEIGHT, paddingVertical: 6 }}
        >
          <TouchableOpacity
            className="flex-1 mr-3 rounded-2xl px-1 py-1"
            onPress={() => {
              haptics.selection();
              setShowSidebar(true);
            }}
          >
            <View className="flex-row items-center">
              <Sparkles color="#f5c542" size={16} strokeWidth={tokens.icon.strokeWidth} />
              <View className="ml-2 flex-1">
                <Text
                  className="text-[14px] font-semibold text-gray-900 dark:text-gray-100"
                  numberOfLines={1}
                >
                  {modelName || t.artworkSelectModel}
                </Text>
                <Text
                  className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500"
                  numberOfLines={1}
                >
                  {summaryParts.join(' · ')}
                </Text>
              </View>
              <ChevronDown
                color="#9ca3af"
                size={16}
                strokeWidth={tokens.icon.strokeWidth}
                style={{ marginLeft: 10 }}
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center justify-center rounded-full p-2"
            onPress={() => {
              haptics.selection();
              setShowSidebar(true);
            }}
          >
            <SlidersHorizontal color="#6b7280" size={20} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Generation Feed ── */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          batches.length === 0
            ? {
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: 120,
                paddingHorizontal: containerPad,
              }
            : { paddingBottom: 120, paddingHorizontal: containerPad }
        }
      >
        {batches.length > 0 ? (
          batches.map((batch) => (
            <BatchCard
              batch={batch}
              key={batch.id}
              resolveUrl={resolveUrl}
              screenWidth={screenWidth}
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
                    onPress: async () => {
                      await artworkApi.deleteBatch(batch.id);
                      if (topicId) loadBatches(topicId);
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
          <View className="items-center px-8">
            <View
              className="mb-4 items-center justify-center rounded-3xl bg-gray-100 dark:bg-gray-800"
              style={{ width: 80, height: 80 }}
            >
              <ImageIcon color="#9ca3af" size={36} strokeWidth={1.5} />
            </View>
            <Text className="text-center text-[17px] font-semibold text-gray-700 dark:text-gray-300">
              {t.artworkEmpty}
            </Text>
            <Text className="mt-2 text-center text-[14px] text-gray-400 dark:text-gray-500">
              {t.artworkEmptyDesc}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Prompt Bar ── */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-gray-100 dark:border-gray-800"
        style={{
          paddingBottom: insets.bottom + 12,
          paddingTop: 10,
          paddingHorizontal: containerPad,
          backgroundColor: 'rgba(255,255,255,0.97)',
        }}
      >
        <View className="flex-row items-end gap-2">
          <TextInput
            multiline
            className="flex-1 rounded-2xl px-4 py-3 text-[14px] text-gray-900 dark:text-gray-100"
            maxLength={2000}
            placeholder={t.artworkPromptPlaceholder}
            placeholderTextColor="#9ca3af"
            style={{ maxHeight: 100, minHeight: 44, backgroundColor: '#f3f4f6' }}
            value={prompt}
            onChangeText={setPrompt}
          />
          <TouchableOpacity
            className={`rounded-2xl items-center justify-center ${prompt.trim() && model ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            disabled={!prompt.trim() || !model || generating}
            style={{ width: 48, height: 48 }}
            onPress={handleGenerate}
          >
            {generating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Sparkles
                color={prompt.trim() && model ? '#fff' : '#9ca3af'}
                size={20}
                strokeWidth={2}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Config Sidebar Overlay ── */}
      {showSidebar && (
        <>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              onPress={() => setShowSidebar(false)}
            />
          </Animated.View>
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutRight.duration(250)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: sidebarWidth,
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 20,
              borderBottomLeftRadius: 20,
              shadowColor: '#000',
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
                  style={{ color: '#1a1a1a', fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}
                >
                  {t.artworkTitle}
                </Text>
                <TouchableOpacity hitSlop={8} onPress={() => setShowSidebar(false)}>
                  <X color="#999" size={20} strokeWidth={tokens.icon.strokeWidth} />
                </TouchableOpacity>
              </View>

              {/* Model Selector */}
              <SidebarLabel text={t.artworkModel} />
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
                onPress={() => setShowPicker(!showPicker)}
              >
                <Sparkles color="#f5c542" size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#1a1a1a',
                    fontSize: 14,
                    fontWeight: '600',
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  {modelName || t.artworkSelectModel}
                </Text>
                <ChevronDown color="#999" size={16} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>
              {showPicker && (
                <Animated.View
                  entering={FadeInDown.duration(200)}
                  style={{
                    backgroundColor: '#f5f5f5',
                    borderRadius: 12,
                    marginTop: 8,
                    maxHeight: 208,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {allModels.length === 0 ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <Text style={{ color: '#999', fontSize: 14 }}>{t.artworkNoModels}</Text>
                        <Text style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>
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
                            backgroundColor: model === m.id ? '#e8e8e8' : 'transparent',
                          }}
                          onPress={() => {
                            haptics.selection();
                            applyModelSelection(m, m.providerId, m.providerName);
                            setShowPicker(false);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#1a1a1a', fontSize: 13, fontWeight: '500' }}>
                              {m.displayName || m.id}
                            </Text>
                            <Text style={{ color: '#999', fontSize: 10 }}>{m.providerName}</Text>
                          </View>
                          {model === m.id && (
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: semanticColors.primary,
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
                      backgroundColor: '#f5f5f5',
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
                                backgroundColor: '#e0e0e0',
                                borderRadius: 10,
                                padding: 2,
                              }}
                              onPress={() => setRefImages((p) => p.filter((_, idx) => idx !== i))}
                            >
                              <X color="#666" size={10} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <>
                        <ImageIcon color="#bbb" size={28} strokeWidth={1.5} />
                        <Text
                          style={{ color: '#999', fontSize: 12, marginTop: 6, textAlign: 'center' }}
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
                  <SidebarOptionGrid
                    columns={2}
                    containerWidth={sidebarWidth - sidebarPad * 2}
                    getKey={(option) => String(option)}
                    items={resolutionOptions}
                    selectedValue={generationParams.resolution as string | undefined}
                    renderContent={(option, active) => (
                      <Text
                        style={{
                          color: active ? '#fff' : '#555',
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
                          color: active ? '#fff' : '#555',
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
                          color: active ? '#fff' : '#555',
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
                  <SidebarOptionGrid
                    columns={3}
                    containerWidth={sidebarWidth - sidebarPad * 2}
                    getKey={(option) => String(option)}
                    items={effectiveAspectRatioOptions}
                    selectedValue={generationParams.aspectRatio as string | undefined}
                    renderContent={(option, active) => (
                      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ marginBottom: 2 }}>
                          <RatioIcon active={active} ratio={option} />
                        </View>
                        <Text
                          style={{
                            color: active ? '#fff' : '#555',
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
                      setGenerationParams((state) => ({ ...state, aspectRatio: option }));
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
                      backgroundColor: '#f5f5f5',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                    onPress={() => setEditingParamKey(key)}
                  >
                    <Text style={{ color: '#1a1a1a', fontSize: 14, fontWeight: '600' }}>
                      {generationParams[key] === null || generationParams[key] === undefined
                        ? 'Auto'
                        : String(generationParams[key])}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 12 }}>
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
              <SidebarOptionGrid
                columns={5}
                containerWidth={sidebarWidth - sidebarPad * 2}
                getKey={(item) => String(item)}
                items={[...IMAGE_COUNTS, 'custom']}
                selectedValue={imgCount}
                renderContent={(item, active) => (
                  <Text
                    style={{
                      color: active ? '#fff' : '#555',
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

                  setImgCount(item);
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
            [editingParamKey]: editingParamKey === 'seed' && value.trim() === '' ? null : nextValue,
          }));
          setEditingParamKey(null);
        }}
      />
    </View>
  );
}

// ── BatchCard ────────────────────────────────────────────────────────
function BatchCard({
  batch,
  resolveUrl,
  screenWidth,
  onCopyPrompt,
  onDelete,
  onReuseSettings,
}: {
  batch: GenerationBatch;
  onCopyPrompt: () => void;
  onDelete: () => void;
  onReuseSettings: () => void;
  resolveUrl: (url?: string) => string | undefined;
  screenWidth: number;
}) {
  const { t } = useI18n();
  const imgPad = 40;
  const gap = 6;
  const cols = batch.generations.length === 1 ? 1 : 2;
  const imgW = Math.floor((screenWidth - imgPad - gap * (cols - 1)) / cols);

  return (
    <Animated.View className="bg-card rounded-2xl p-3 mb-3" entering={FadeInDown.duration(300)}>
      {/* Prompt */}
      <Text className="text-foreground text-[13px] mb-2" numberOfLines={3}>
        {batch.prompt}
      </Text>

      {/* Meta */}
      <View className="flex-row items-center gap-2 mb-2">
        <View className="bg-white/10 px-2 py-0.5 rounded-md">
          <Text className="text-foreground/60 text-[10px]">{batch.model}</Text>
        </View>
        {batch.width && batch.height && (
          <View className="bg-white/10 px-2 py-0.5 rounded-md">
            <Text className="text-foreground/60 text-[10px]">
              {batch.width}×{batch.height}
            </Text>
          </View>
        )}
        <View className="bg-white/10 px-2 py-0.5 rounded-md">
          <Text className="text-foreground/60 text-[10px]">×{batch.generations.length}</Text>
        </View>
      </View>

      {/* Generation grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {batch.generations.map((gen) => {
          const url = resolveUrl(gen.asset?.url || gen.asset?.thumbnailUrl);
          const isDone = gen.task.status === 'Success' && url;
          const isErr = gen.task.status === 'Error';
          return (
            <View
              key={gen.id}
              style={{
                width: imgW,
                height: imgW,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isDone ? (
                <RNImage
                  resizeMode="cover"
                  source={{ uri: url }}
                  style={{ width: imgW, height: imgW }}
                />
              ) : isErr ? (
                <View className="items-center p-2">
                  <Text className="text-red-400 text-[10px]">{t.artworkError}</Text>
                </View>
              ) : (
                <View className="items-center">
                  <ActivityIndicator color="#666" size="small" />
                  <StatusBadge status={gen.task.status} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View className="flex-row items-center justify-end mt-2 gap-3">
        <TouchableOpacity hitSlop={8} onPress={onReuseSettings}>
          <Sparkles color="#666" size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={onCopyPrompt}>
          <Copy color="#666" size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={onDelete}>
          <Trash2 color="#ef4444" size={16} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
