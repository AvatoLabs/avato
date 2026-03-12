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
  Lock,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlock,
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

import { useToast } from '../components/ui/Toast';
import { aiProviderApi, artworkApi, fileApi, getApiUrl } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useConnectionStore } from '../store/connection';
import { tokens } from '../theme/tokens';
import type { GenerationBatch, GenerationItem, ImageProviderWithModels } from '../types';

// ── Constants ────────────────────────────────────────────────────────
const ASPECT_RATIOS = [
  'auto',
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
  '1:4',
  '4:1',
  '1:8',
  '8:1',
];

const RESOLUTIONS = [
  { label: '0.5K', w: 512, h: 512 },
  { label: '1K', w: 1024, h: 1024 },
  { label: '2K', w: 2048, h: 2048 },
  { label: '4K', w: 4096, h: 4096 },
];

const IMAGE_COUNTS = [1, 2, 4, 8];
const STORAGE_KEY = 'minkhub_artwork_config';

function parseRatio(r: string) {
  const [a, b] = r.split(':').map(Number);
  return { rw: a || 1, rh: b || 1 };
}

function computeDims(base: { w: number; h: number }, ratio: string) {
  if (ratio === 'auto') return { width: base.w, height: base.h };
  const { rw, rh } = parseRatio(ratio);
  const area = base.w * base.h;
  const w = Math.round(Math.sqrt(area * (rw / rh)));
  const h = Math.round(w * (rh / rw));
  return { width: w, height: h };
}

function getRatioIcon(r: string) {
  if (r === 'auto') return '⊡';
  const { rw, rh } = parseRatio(r);
  if (rw === rh) return '□';
  if (rw > rh) return '▬';
  return '▮';
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

// ── Sub-components ───────────────────────────────────────────────────
function SectionLabel({ text, right }: { right?: React.ReactNode; text: string }) {
  return (
    <View className="flex-row items-center justify-between mb-2 mt-4">
      <Text className="text-foreground text-[15px] font-semibold tracking-tight">{text}</Text>
      {right}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    Pending: { bg: '#f59e0b20', fg: '#f59e0b', label: 'Pending' },
    Processing: { bg: '#3b82f620', fg: '#3b82f6', label: 'Processing' },
    Success: { bg: '#10b98120', fg: '#10b981', label: 'Done' },
    Error: { bg: '#ef444420', fg: '#ef4444', label: 'Failed' },
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
export default function ArtworkScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const isConnected = useConnectionStore((s) => s.isConnected);

  // Config state
  const [imageProviders, setImageProviders] = useState<ImageProviderWithModels[]>([]);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [modelName, setModelName] = useState('');
  const [resIdx, setResIdx] = useState(1);
  const [ratio, setRatio] = useState('auto');
  const [locked, setLocked] = useState(false);
  const [imgCount, setImgCount] = useState(2);
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

  // ── Load image models ──
  const loadModels = useCallback(async () => {
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
          type: 'image',
        });
      }

      const imgProviders = Array.from(providerMap.values());
      setImageProviders(imgProviders);

      // Auto-select first model if none selected
      if (!model && imgProviders.length > 0 && imgProviders[0].children.length > 0) {
        const firstP = imgProviders[0];
        const firstM = firstP.children[0];
        setProvider(firstP.id);
        setModel(firstM.id);
        setModelName(firstM.displayName || firstM.id);
      }
    } catch {
      /* silent */
    }
  }, [isConnected, model]);

  // ── Persist/restore config ──
  const saveConfig = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ provider, model, modelName, resIdx, ratio, locked, imgCount }),
      );
    } catch {
      /* */
    }
  }, [provider, model, modelName, resIdx, ratio, locked, imgCount]);

  const restoreConfig = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (c.provider) setProvider(c.provider);
        if (c.model) setModel(c.model);
        if (c.modelName) setModelName(c.modelName);
        if (c.resIdx !== undefined) setResIdx(c.resIdx);
        if (c.ratio) setRatio(c.ratio);
        if (c.locked !== undefined) setLocked(c.locked);
        if (c.imgCount) setImgCount(c.imgCount);
      }
    } catch {
      /* */
    }
  }, []);

  // ── Init ──
  useFocusEffect(
    useCallback(() => {
      getApiUrl().then(setBaseUrl);
      restoreConfig().then(() => loadModels());
    }, [restoreConfig, loadModels]),
  );

  useEffect(() => {
    saveConfig();
  }, [saveConfig]);

  // ── Cleanup polling ──
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Pick reference images ──
  const handlePickRef = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newImgs = result.assets.map((a) => ({ uri: a.uri }));
      setRefImages((prev) => [...prev, ...newImgs]);
    }
  }, []);

  // ── Load batches for topic ──
  const loadBatches = useCallback(async (tid: string) => {
    try {
      const data = await artworkApi.getBatches(tid);
      if (data) setBatches(data);
    } catch {
      /* */
    }
  }, []);

  // ── Poll generation status ──
  const startPolling = useCallback(
    (tid: string, batchGenerations: GenerationItem[]) => {
      if (pollRef.current) clearInterval(pollRef.current);
      const pending = batchGenerations.filter(
        (g) => g.asyncTaskId && g.task.status !== 'Success' && g.task.status !== 'Error',
      );
      if (pending.length === 0) return;

      let count = 0;
      pollRef.current = setInterval(
        async () => {
          count++;
          try {
            let allDone = true;
            for (const g of pending) {
              if (!g.asyncTaskId) continue;
              const result = await artworkApi.getGenerationStatus(g.id, g.asyncTaskId);
              if (result?.status === 'Success' || result?.status === 'Error') {
                // done
              } else {
                allDone = false;
              }
            }
            // Refresh batches
            await loadBatches(tid);
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
      for (const img of refImages) {
        if (img.url) {
          uploadedUrls.push(img.url);
        } else {
          try {
            const uploaded = await fileApi.upload(img.uri, 'reference.jpg', 'image/jpeg');
            uploadedUrls.push(uploaded.url);
            img.url = uploaded.url;
          } catch {
            /* skip */
          }
        }
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

      // Compute dimensions
      const base = RESOLUTIONS[resIdx];
      const { width, height } = computeDims(base, ratio);

      // Create image
      const result = await artworkApi.createImage({
        generationTopicId: tid,
        imageNum: imgCount,
        model,
        provider,
        params: {
          prompt: prompt.trim(),
          width,
          height,
          ...(uploadedUrls.length > 0 ? { imageUrls: uploadedUrls } : {}),
        },
      });

      if (result?.data?.generations) {
        // Start polling for status
        await loadBatches(tid);
        startPolling(tid, result.data.generations);
      }

      setPrompt('');
    } catch (err: any) {
      toast.show('error', t.artworkErrorDesc);
    } finally {
      setGenerating(false);
    }
  }, [
    prompt,
    model,
    provider,
    generating,
    refImages,
    topicId,
    resIdx,
    ratio,
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
  const ratioColCount = 5;
  const ratioCellGap = 6;
  const ratioCellW = Math.floor(
    (sidebarWidth - sidebarPad * 2 - ratioCellGap * (ratioColCount - 1)) / ratioColCount,
  );
  const allModels = imageProviders.flatMap((p) =>
    p.children.map((m) => ({ ...m, providerId: p.id, providerName: p.name })),
  );

  return (
    <View className="flex-1 bg-background">
      {/* ── Header ── */}
      <View
        className="flex-row items-center pb-3"
        style={{ paddingTop: 60, paddingHorizontal: containerPad }}
      >
        <TouchableOpacity
          className="flex-row items-center bg-card rounded-full px-3 py-2 flex-1 mr-3"
          onPress={() => {
            haptics.selection();
            setShowSidebar(true);
          }}
        >
          <Sparkles color="#f5c542" size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text
            className="text-foreground text-[14px] font-semibold ml-2"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {modelName || t.artworkSelectModel}
          </Text>
          <Text className="text-foreground/40 text-[11px]">
            {RESOLUTIONS[resIdx].label} · {ratio} · ×{imgCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-card rounded-full p-2.5"
          onPress={() => {
            haptics.selection();
            setShowSidebar(true);
          }}
        >
          <SlidersHorizontal color="#999" size={18} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* ── Generation Feed ── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: containerPad }}
        showsVerticalScrollIndicator={false}
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
            />
          ))
        ) : (
          <View className="items-center pt-40">
            <ImageIcon color="#333" size={48} strokeWidth={1.2} />
            <Text className="text-foreground/30 text-[15px] font-medium mt-4">
              {t.artworkEmpty}
            </Text>
            <Text className="text-foreground/20 text-[12px] mt-1 text-center px-8">
              {t.artworkEmptyDesc}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Prompt Bar ── */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-white/5"
        style={{ paddingBottom: 34, paddingTop: 10, paddingHorizontal: containerPad }}
      >
        <View className="flex-row items-end gap-2">
          <TextInput
            multiline
            className="flex-1 bg-card rounded-2xl px-4 py-3 text-foreground text-[14px]"
            maxLength={2000}
            placeholder={t.artworkPromptPlaceholder}
            placeholderTextColor="#666"
            style={{ maxHeight: 100, minHeight: 44 }}
            value={prompt}
            onChangeText={setPrompt}
          />
          <TouchableOpacity
            className={`rounded-2xl items-center justify-center ${prompt.trim() && model ? 'bg-blue-600' : 'bg-white/10'}`}
            disabled={!prompt.trim() || !model || generating}
            style={{ width: 48, height: 48 }}
            onPress={handleGenerate}
          >
            {generating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Sparkles
                color={prompt.trim() && model ? '#fff' : '#555'}
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
              contentContainerStyle={{
                paddingHorizontal: sidebarPad,
                paddingTop: 60,
                paddingBottom: 40,
              }}
              showsVerticalScrollIndicator={false}
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
                            setProvider(m.providerId);
                            setModel(m.id);
                            setModelName(m.displayName || m.id);
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
                                backgroundColor: '#007aff',
                              }}
                            />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </Animated.View>
              )}

              {/* Reference Images */}
              <SidebarLabel text={t.artworkReferenceImages} />
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

              {/* Resolution */}
              <SidebarLabel text={t.artworkResolution} />
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {RESOLUTIONS.map((r, i) => {
                  const active = i === resIdx;
                  return (
                    <TouchableOpacity
                      key={r.label}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 12,
                        backgroundColor: active ? '#007aff' : 'transparent',
                      }}
                      onPress={() => {
                        haptics.selection();
                        setResIdx(i);
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, fontWeight: '500', color: active ? '#fff' : '#555' }}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Aspect Ratio */}
              <SidebarLabel
                text={t.artworkAspectRatio}
                right={
                  <TouchableOpacity
                    onPress={() => {
                      haptics.selection();
                      setLocked(!locked);
                    }}
                  >
                    {locked ? (
                      <Lock color="#666" size={15} strokeWidth={tokens.icon.strokeWidth} />
                    ) : (
                      <Unlock color="#bbb" size={15} strokeWidth={tokens.icon.strokeWidth} />
                    )}
                  </TouchableOpacity>
                }
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ratioCellGap }}>
                {ASPECT_RATIOS.map((r) => {
                  const active = r === ratio;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={{
                        width: ratioCellW,
                        paddingVertical: 8,
                        alignItems: 'center',
                        borderRadius: 10,
                        backgroundColor: active ? '#007aff' : '#f5f5f5',
                      }}
                      onPress={() => {
                        haptics.selection();
                        setRatio(r);
                      }}
                    >
                      <View style={{ marginBottom: 2 }}>
                        <RatioIcon active={active} ratio={r} />
                      </View>
                      <Text
                        style={{ color: active ? '#fff' : '#555', fontSize: 10, fontWeight: '500' }}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Number of Images */}
              <SidebarLabel text={t.artworkImageCount} />
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {IMAGE_COUNTS.map((n) => {
                  const active = n === imgCount;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 12,
                        backgroundColor: active ? '#007aff' : 'transparent',
                      }}
                      onPress={() => {
                        haptics.selection();
                        setImgCount(n);
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, fontWeight: '500', color: active ? '#fff' : '#555' }}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 }}
                  onPress={() => {
                    Alert.prompt?.(
                      t.artworkImageCountCustom,
                      '',
                      (val) => {
                        const n = Number(val);
                        if (n > 0 && n <= 16) setImgCount(n);
                      },
                      'plain-text',
                      String(imgCount),
                    );
                  }}
                >
                  <Text style={{ color: '#555', fontSize: 13, fontWeight: '500' }}>+</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}
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
}: {
  batch: GenerationBatch;
  onCopyPrompt: () => void;
  onDelete: () => void;
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
