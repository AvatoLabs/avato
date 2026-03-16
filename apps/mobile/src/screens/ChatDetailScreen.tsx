/**
 * ChatDetailScreen — Full chat experience with MessageBubble, Topics, and file attachments.
 */
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Brain,
  BrainCircuit,
  Cpu,
  Eraser,
  Globe,
  Paperclip,
  Puzzle,
  Send,
  Settings,
  Square,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AttachmentSheet from '../components/ui/AttachmentSheet';
import FilePreview from '../components/ui/FilePreview';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import MessageBubble from '../components/ui/MessageBubble';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PressableScale from '../components/ui/PressableScale';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import { agentApi, agentSkillApi, messageApi, pluginApi, sessionApi, topicApi, userApi } from '../lib/api';
import {
  MOBILE_RECOMMENDED_BUILTIN_SKILLS,
} from '../constants/recommendedBuiltins';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useTopicStore } from '../store/topic';
import { themeColors } from '../theme';
import { tokens } from '../theme/tokens';
import type { AgentSkillItem, ChatMessage, InstalledPlugin, MobileMemoryEffort } from '../types';

const EMPTY_MESSAGES: ChatMessage[] = [];

export default function ChatDetailScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId || 'default';
  const initialTopicId = route.params?.topicId ?? null;
  const focusMessageId = route.params?.messageId;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();
  const primaryColor = themeColors.light.primary;

  const messages = useChatStore((s) => s.messagesBySession[sessionId] ?? EMPTY_MESSAGES);
  const generating = useChatStore(
    (s) => s.generating && s.activeStreamingSessionId === sessionId,
  );
  const isReasoning = useChatStore((s) => s.isReasoning);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGenerating = useChatStore((s) => s.stopGenerating);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));

  const activeTopic = useTopicStore((s) => s.activeTopic);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const switchTopic = useTopicStore((s) => s.switchTopic);

  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const addFile = useFileStore((s) => s.addFile);

  const [inputText, setInputText] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [providerLogoError, setProviderLogoError] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isScrolledToBottom = useRef(true);
  const lastAutoScrollAt = useRef(0);

  // Skills drawer
  const [skillsSheetVisible, setSkillsSheetVisible] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<
    { description: string; identifier: string; title: string }[]
  >([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(() => new Set());
  const [agentId, setAgentId] = useState<string | null>(null);

  const sessionModel = useModelStore((s) => s.selectedModel);
  const sessionProvider = useModelStore((s) => s.selectedProvider);
  const modelProviders = useModelStore((s) => s.providers);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const loadSelection = useModelStore((s) => s.loadSelection);
  const modelSupportsVision = useModelStore((s) => {
    if (!s.selectedModel || s.providers.length === 0) return true;
    for (const p of s.providers) {
      const m = p.children.find((c) => c.id === s.selectedModel);
      if (m) return !!m.abilities?.vision;
    }
    return true;
  });

  useEffect(() => {
    fetchModels();
    loadSelection(sessionId);
  }, [fetchModels, loadSelection, sessionId]);

  useEffect(() => {
    switchTopic(initialTopicId);
  }, [initialTopicId, sessionId, switchTopic]);

  // Rotating placeholder hints
  const hints = useMemo(
    () => [t.chatAskAnything, t.chatHint1, t.chatHint2, t.chatHint3, t.chatHint4],
    [t],
  );
  const [hintIndex, setHintIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHintIndex((i) => (i + 1) % hints.length), 4000);
    return () => clearInterval(timer);
  }, [hints.length]);

  useEffect(() => {
    fetchMessages(sessionId, activeTopic ?? undefined);
    fetchTopics(sessionId);
  }, [sessionId, fetchMessages, fetchTopics, activeTopic]);

  useEffect(() => {
    if (!generating) return;
    const WATCHDOG_MS = 180_000;
    const startedAt = useChatStore.getState().generatingStartedAt;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const remaining = Math.max(WATCHDOG_MS - elapsed, 0);
    const timer = setTimeout(() => {
      if (useChatStore.getState().generating) {
        console.warn('[ChatDetail] generating watchdog triggered, force-stopping');
        stopGenerating();
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [generating, stopGenerating]);

  useEffect(() => {
    if (!focusMessageId || messages.length === 0) return;

    const messageIndex = messages.findIndex((message) => message.id === focusMessageId);
    if (messageIndex === -1) return;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        animated: true,
        index: messageIndex,
        viewPosition: 0.5,
      });
    });
  }, [focusMessageId, messages]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    agentApi
      .getConfigBySession(sessionId)
      .then((config) => {
        if (config) {
          setAgentId(config.id);
          setEnabledPlugins(new Set(config.plugins ?? []));
        } else {
          console.warn('[ChatDetail] no agent config for session:', sessionId);
        }
      })
      .catch((err) => {
        console.error('[ChatDetail] failed to load agent config:', err);
      });
  }, [sessionId]);

  const sessionSearchMode = session?.chatConfig?.searchMode;
  const sessionMemoryEnabled = session?.chatConfig?.memory?.enabled;
  const sessionMemoryEffort = session?.chatConfig?.memory?.effort;

  useEffect(() => {
    if (!session?.chatConfig) return;
    setSearchEnabled(sessionSearchMode ? sessionSearchMode !== 'off' : false);
    setMemoryEnabled(sessionMemoryEnabled !== false);
    setMemoryEffort(sessionMemoryEffort || 'medium');
  }, [session?.chatConfig, session?.id, sessionSearchMode, sessionMemoryEnabled, sessionMemoryEffort]);

  const handlePluginsPress = useCallback(() => {
    haptics.light();
    setSkillsSheetVisible(true);
    setLoadingSkills(true);
    Promise.all([pluginApi.list(), agentSkillApi.list(), userApi.getState()])
      .then(([plugins, skills, userState]) => {
        const uninstalled = userState?.settings?.tool?.uninstalledBuiltinTools ?? [];
        const builtins = MOBILE_RECOMMENDED_BUILTIN_SKILLS
          .filter((b) => !uninstalled.includes(b.identifier))
          .map((b) => ({
            description: (t as any)[b.descriptionKey] ?? '',
            identifier: b.identifier,
            title: (t as any)[b.titleKey] ?? b.identifier,
          }));
        setBuiltinSkillItems(builtins);

        const builtinIds = new Set(builtins.map((b) => b.identifier));
        const filteredSkills = (skills ?? []).filter(
          (s) => s.identifier && !builtinIds.has(s.identifier),
        );
        setAgentSkillItems(filteredSkills);

        const skillIds = new Set(filteredSkills.map((s) => s.identifier).filter(Boolean));
        const filteredPlugins = (plugins ?? []).filter(
          (p) => !builtinIds.has(p.identifier) && !skillIds.has(p.identifier),
        );
        setInstalledPlugins(filteredPlugins);
      })
      .catch(() => {})
      .finally(() => setLoadingSkills(false));
  }, [t]);

  const handleTogglePlugin = useCallback(
    (identifier: string) => {
      haptics.light();
      setEnabledPlugins((prev) => {
        const next = new Set(prev);
        if (next.has(identifier)) {
          next.delete(identifier);
        } else {
          next.add(identifier);
        }
        const pluginArr = [...next];
        if (agentId) {
          agentApi.updateConfig(agentId, { plugins: pluginArr }).catch(console.error);
        } else {
          agentApi
            .getConfigBySession(sessionId)
            .then((config) => {
              if (config?.id) {
                setAgentId(config.id);
                agentApi.updateConfig(config.id, { plugins: pluginArr }).catch(console.error);
              }
            })
            .catch(console.error);
        }
        return next;
      });
    },
    [agentId, sessionId],
  );

  const selectedProviderLogo = useMemo(
    () => modelProviders.find((provider) => provider.id === sessionProvider)?.logo,
    [modelProviders, sessionProvider],
  );
  const toolbarProviderLogo =
    selectedProviderLogo || (sessionProvider ? getProviderIconUrl(sessionProvider) : undefined);

  useEffect(() => {
    setProviderLogoError(false);
  }, [toolbarProviderLogo, sessionProvider]);

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const autoScrollToEnd = useCallback(() => {
    if (!isScrolledToBottom.current && !generating) return;

    const now = Date.now();
    const minInterval = generating ? 120 : 0;
    if (now - lastAutoScrollAt.current < minInterval) return;

    lastAutoScrollAt.current = now;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: !generating });
    });
  }, [generating]);

  const handleStop = useCallback(() => {
    haptics.light();
    stopGenerating();
  }, [stopGenerating]);

  const handleSend = useCallback(async () => {
    if ((!inputText.trim() && pendingFiles.length === 0) || generating) return;
    haptics.light();
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const textToSend = inputText.trim();
    setInputText('');
    Keyboard.dismiss();
    const success = await sendMessage(sessionId, textToSend, activeTopic ?? undefined, {
      memoryEffort,
      memoryEnabled,
      plugins: enabledPlugins.size > 0 ? [...enabledPlugins] : undefined,
      searchEnabled,
    });
    if (!success) {
      setInputText(textToSend);
    }
  }, [
    inputText,
    generating,
    sendMessage,
    sessionId,
    enabledPlugins,
    activeTopic,
    pendingFiles.length,
    memoryEffort,
    memoryEnabled,
    searchEnabled,
    sendScale,
  ]);

  const pickImage = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 0.8,
                allowsMultipleSelection: true,
              });

        if (!result.canceled) {
          for (const asset of result.assets) {
            addFile({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: asset.fileName || 'image.jpg',
              type: asset.mimeType || 'image/jpeg',
              size: asset.fileSize || 0,
              uri: asset.uri,
            });
          }
        }
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_CANCELED') return;
        toast.show('error', t.fileUploadError);
      }
    },
    [addFile, t, toast],
  );

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        for (const asset of result.assets) {
          addFile({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
            size: asset.size || 0,
            uri: asset.uri,
          });
        }
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_CANCELED') return;
      toast.show('error', t.fileUploadError);
    }
  }, [addFile, t, toast]);

  const handleAttach = useCallback(() => {
    haptics.selection();
    setAttachmentSheetVisible(true);
  }, []);

  // ── Toolbar: Model ────────────────────────────────────────────────
  const handleModelPress = useCallback(() => {
    haptics.light();
    setModelDrawerVisible(true);
  }, []);

  // ── Toolbar: Search toggle ────────────────────────────────────────
  const handleToggleSearch = useCallback(async () => {
    haptics.light();
    const next = !searchEnabled;
    setSearchEnabled(next);
    try {
      await sessionApi.updateChatConfig(sessionId, { searchMode: next ? 'on' : 'off' });
    } catch {
      /* best-effort */
    }
  }, [searchEnabled, sessionId]);

  const updateMemoryConfig = useCallback(
    async (nextEnabled: boolean, nextEffort: MobileMemoryEffort) => {
      setMemoryEnabled(nextEnabled);
      setMemoryEffort(nextEffort);

      try {
        await sessionApi.updateChatConfig(sessionId, {
          memory: {
            effort: nextEffort,
            enabled: nextEnabled,
          },
        });
      } catch {
        /* best-effort */
      }
    },
    [sessionId],
  );

  // ── Toolbar: Clear messages ───────────────────────────────────────
  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    haptics.warning();
    Alert.alert(t.chatClearTitle, t.chatClearMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.chatClearConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            const ids = messages.map((m) => m.id);
            await messageApi.removeAll(ids);
            fetchMessages(sessionId, activeTopic ?? undefined);
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  }, [messages, t, sessionId, activeTopic, fetchMessages]);

  const handleSaveToTopic = useCallback(async () => {
    if (activeTopic) {
      return;
    }
    try {
      const topicId = await topicApi.create(sessionId, t.topicTitle);
      if (topicId) {
        haptics.success();
        fetchTopics(sessionId);
      }
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [sessionId, activeTopic, t, toast, fetchTopics]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble
        generating={generating}
        message={item}
        sessionId={sessionId}
        onSaveToTopic={handleSaveToTopic}
      />
    ),
    [sessionId, generating, handleSaveToTopic],
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <BlurView className="z-10" intensity={90} style={{ paddingTop: insets.top }} tint="light">
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <View className="flex-row items-center flex-1">
            <PressableScale
              accessibilityLabel="Go back"
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full mr-2"
              onPress={() => {
                haptics.light();
                navigation.goBack();
              }}
            >
              <ArrowLeft color={semanticColors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
            <View className="flex-1">
              <Text
                className="text-[16px] font-medium text-foreground tracking-tight"
                numberOfLines={1}
              >
                {session?.title || t.chatTitle}
              </Text>
              {generating ? (
                <Text className="text-primary text-[12px] mt-0.5 font-medium">
                  {isReasoning ? t.chatThinking : t.chatGenerating}
                </Text>
              ) : sessionModel ? (
                <Text
                  className="text-[12px] mt-0.5 font-medium"
                  numberOfLines={1}
                  style={{ color: semanticColors.muted }}
                >
                  {sessionModel}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="flex-row items-center">
            <PressableScale
              accessibilityLabel="Settings"
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full"
              onPress={() => {
                haptics.light();
                navigation.navigate('ChatSettings', { sessionId });
              }}
            >
              <Settings
                color={semanticColors.muted}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
          </View>
        </View>
      </BlurView>

      {/* Message List */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          ref={flatListRef}
          renderItem={renderMessage}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-16">
              <Animated.View entering={FadeInUp.delay(100).duration(400).springify()}>
                <RNImage
                  className="w-20 h-20 rounded-3xl mb-6"
                  source={require('../../assets/avato-logo.png')}
                />
              </Animated.View>
              <Animated.View entering={FadeInUp.delay(200).duration(400).springify()}>
                <Text className="text-foreground font-extrabold text-xl tracking-tighter">
                  {t.chatEmptyWave}
                </Text>
              </Animated.View>
              <Animated.View entering={FadeInUp.delay(300).duration(400).springify()}>
                <Text className="text-secondary/50 text-[13px] mt-2 text-center px-10 leading-6">
                  {t.chatEmptyDesc}
                </Text>
              </Animated.View>
              {/* Suggestion chips */}
              <Animated.View
                className="flex-row flex-wrap justify-center gap-2 mt-6 px-6"
                entering={FadeInDown.delay(450).duration(350)}
              >
                {[t.chatSuggest1, t.chatSuggest2, t.chatSuggest3, t.chatSuggest4].map((label) => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="px-4 py-2.5 rounded-full bg-foreground/[0.03]"
                    key={label}
                    onPress={() => {
                      haptics.light();
                      setInputText(label);
                    }}
                  >
                    <Text className="text-secondary text-[13px] font-medium">{label}</Text>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            </View>
          }
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 12,
            paddingTop: 12,
          }}
          onContentSizeChange={autoScrollToEnd}
          onLayout={autoScrollToEnd}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            isScrolledToBottom.current =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
          }}
          onScrollToIndexFailed={({ index }) => {
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToOffset({
                animated: true,
                offset: Math.max(index, 0) * 120,
              });
            });
          }}
        />

        {/* Input Area — Floating Pill */}
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: 16,
            paddingTop: 4,
          }}
        >
          <BlurView
            className="rounded-[26px] overflow-hidden"
            intensity={80}
            tint="light"
            style={{
              backgroundColor: 'rgba(255,255,255,0.72)',
              borderColor: 'rgba(15,23,42,0.08)',
              borderWidth: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            {pendingFiles.length > 0 && (
              <View className="px-3 pt-2">
                <FilePreview sessionId={sessionId} />
              </View>
            )}
            {/* Text input — full width */}
            <View className="px-3 pt-2">
              <TextInput
                multiline
                className="text-foreground text-[16px] leading-[22px] min-h-[36px] max-h-28"
                editable={!generating}
                placeholder={generating ? t.chatGenerating : hints[hintIndex]}
                placeholderTextColor={semanticColors.muted}
                style={{ paddingVertical: 0, textAlignVertical: 'top' }}
                underlineColorAndroid="transparent"
                value={inputText}
                onChangeText={setInputText}
              />
            </View>
            {/* Action toolbar row */}
            <View className="flex-row items-center px-2 pb-1.5 pt-1">
              {/* Model */}
              <TouchableOpacity
                accessibilityLabel="Select model"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full"
                onPress={handleModelPress}
              >
                {toolbarProviderLogo && !providerLogoError ? (
                  <RNImage
                    style={{ width: 20, height: 20, borderRadius: 4 }}
                    source={{
                      uri: toolbarProviderLogo,
                    }}
                    onError={() => setProviderLogoError(true)}
                  />
                ) : (
                  <Cpu
                    color={semanticColors.muted}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                )}
              </TouchableOpacity>
              {/* Search */}
              <TouchableOpacity
                accessibilityLabel="Toggle search"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handleToggleSearch}
              >
                <Globe
                  color={searchEnabled ? primaryColor : semanticColors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              {/* Attach */}
              <TouchableOpacity
                accessibilityLabel="Attach file"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handleAttach}
              >
                <View className="relative items-center justify-center">
                  <Paperclip
                    color={pendingFiles.length > 0 ? primaryColor : semanticColors.muted}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  {pendingFiles.length > 0 && (
                    <View
                      className="absolute -right-2 -top-1 rounded-full bg-primary items-center justify-center"
                      style={{ minWidth: 14, height: 14, paddingHorizontal: 3 }}
                    >
                      <Text className="text-[9px] font-semibold text-white">
                        {pendingFiles.length > 9 ? '9+' : pendingFiles.length}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {/* Tools */}
              <TouchableOpacity
                accessibilityLabel="Toggle tools"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handlePluginsPress}
              >
                <Puzzle
                  color={enabledPlugins.size > 0 ? primaryColor : semanticColors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              {/* Memory */}
              <TouchableOpacity
                accessibilityLabel="Toggle memory"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={() => {
                  haptics.light();
                  setMemorySheetVisible(true);
                }}
              >
                {memoryEnabled ? (
                  <BrainCircuit
                    color={primaryColor}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                ) : (
                  <Brain
                    color={semanticColors.muted}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                )}
              </TouchableOpacity>
              {/* Separator */}
              <View className="w-px h-4 bg-black/10 mx-1" />
              {/* Clear */}
              <TouchableOpacity
                accessibilityLabel="Clear messages"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full"
                onPress={handleClear}
              >
                <Eraser
                  color={semanticColors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              {/* Spacer */}
              <View className="flex-1" />
              {/* Send / Stop */}
              {generating ? (
                <Animated.View style={sendAnimStyle}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{ backgroundColor: semanticColors.muted }}
                    onPress={handleStop}
                  >
                    <Square color="#fff" fill="#fff" size={12} strokeWidth={0} />
                  </TouchableOpacity>
                </Animated.View>
              ) : inputText.trim() || pendingFiles.length > 0 ? (
                <Animated.View style={sendAnimStyle}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="w-9 h-9 bg-primary rounded-full items-center justify-center"
                    onPress={handleSend}
                  >
                    <Send
                      color="#fff"
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginLeft: 1 }}
                    />
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <View className="w-9 h-9" />
              )}
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>

      <ModelDrawer
        sessionId={sessionId}
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
        onSelect={() => setProviderLogoError(false)}
      />
      <AttachmentSheet
        visible={attachmentSheetVisible}
        onCamera={modelSupportsVision ? () => void pickImage('camera') : undefined}
        onClose={() => setAttachmentSheetVisible(false)}
        onDocument={() => void pickDocument()}
        onGallery={modelSupportsVision ? () => void pickImage('gallery') : undefined}
      />
      <MemoryToolSheet
        effort={memoryEffort}
        enabled={memoryEnabled}
        visible={memorySheetVisible}
        onClose={() => setMemorySheetVisible(false)}
        onChangeEffort={(value) => {
          void updateMemoryConfig(true, value);
        }}
        onChangeEnabled={(value) => {
          void updateMemoryConfig(value, memoryEffort);
        }}
      />

      {/* Skills Drawer */}
      <Modal
        transparent
        animationType="slide"
        visible={skillsSheetVisible}
        onRequestClose={() => setSkillsSheetVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSkillsSheetVisible(false)}
        >
          <Pressable
            className="bg-white rounded-t-2xl max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="px-5 pb-3 pt-2 flex-row items-center justify-between">
              <Text className="text-foreground text-[18px] font-bold tracking-tight">
                {t.skillsTitle}
              </Text>
            </View>
            <ScrollView className="px-5 pb-8" style={{ maxHeight: 400 }}>
              {loadingSkills ? (
                <View className="items-center py-10">
                  <ActivityIndicator color={semanticColors.primary} size="small" />
                </View>
              ) : builtinSkillItems.length === 0 &&
                agentSkillItems.length === 0 &&
                installedPlugins.length === 0 ? (
                <View className="items-center py-10">
                  <Text className="text-secondary/50 text-[14px]">{t.skillsEmpty}</Text>
                  <Text className="text-secondary/40 text-[12px] mt-1 text-center px-4">
                    {t.skillsEmptyDesc}
                  </Text>
                </View>
              ) : (
                <>
                  {builtinSkillItems.map((item) => (
                    <View
                      className="flex-row items-center py-3.5"
                      key={`builtin-${item.identifier}`}
                    >
                      <View className="flex-1 mr-3">
                        <Text
                          className="text-foreground text-[15px] font-medium tracking-tight"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {item.description ? (
                          <Text className="text-secondary/50 text-[12px] mt-0.5" numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      <Switch
                        trackColor={{ false: '#e5e5e5', true: semanticColors.primary }}
                        value={enabledPlugins.has(item.identifier)}
                        onValueChange={() => handleTogglePlugin(item.identifier)}
                      />
                    </View>
                  ))}
                  {agentSkillItems.map((skill) => (
                    <View
                      className="flex-row items-center py-3.5"
                      key={`skill-${skill.id}`}
                    >
                      <View className="flex-1 mr-3">
                        <Text
                          className="text-foreground text-[15px] font-medium tracking-tight"
                          numberOfLines={1}
                        >
                          {skill.name || skill.identifier || skill.id}
                        </Text>
                        {skill.description ? (
                          <Text className="text-secondary/50 text-[12px] mt-0.5" numberOfLines={1}>
                            {skill.description}
                          </Text>
                        ) : null}
                      </View>
                      <Switch
                        trackColor={{ false: '#e5e5e5', true: semanticColors.primary }}
                        value={enabledPlugins.has(skill.identifier ?? skill.id)}
                        onValueChange={() => handleTogglePlugin(skill.identifier ?? skill.id)}
                      />
                    </View>
                  ))}
                  {installedPlugins.map((plugin) => (
                    <View
                      className="flex-row items-center py-3.5"
                      key={plugin.identifier}
                    >
                      <View className="flex-1 mr-3">
                        <Text
                          className="text-foreground text-[15px] font-medium tracking-tight"
                          numberOfLines={1}
                        >
                          {plugin.manifest?.meta?.title || plugin.identifier}
                        </Text>
                        {plugin.manifest?.meta?.description ? (
                          <Text className="text-secondary/50 text-[12px] mt-0.5" numberOfLines={1}>
                            {plugin.manifest.meta.description}
                          </Text>
                        ) : null}
                      </View>
                      <Switch
                        trackColor={{ false: '#e5e5e5', true: semanticColors.primary }}
                        value={enabledPlugins.has(plugin.identifier)}
                        onValueChange={() => handleTogglePlugin(plugin.identifier)}
                      />
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
