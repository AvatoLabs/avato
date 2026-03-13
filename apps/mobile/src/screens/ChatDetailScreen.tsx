/**
 * ChatDetailScreen — Full chat experience with MessageBubble, Topics, and file attachments.
 */
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  BookText,
  Brain,
  BrainCircuit,
  Cpu,
  Eraser,
  Globe,
  Paperclip,
  Puzzle,
  Send,
  Settings,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
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

import FilePreview from '../components/ui/FilePreview';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import MessageBubble from '../components/ui/MessageBubble';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PressableScale from '../components/ui/PressableScale';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import { agentApi, messageApi, pluginApi, sessionApi, topicApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useTopicStore } from '../store/topic';
import { themeColors } from '../theme';
import { tokens } from '../theme/tokens';
import type { ChatMessage, InstalledPlugin, MobileMemoryEffort } from '../types';

const EMPTY_MESSAGES: ChatMessage[] = [];

export default function ChatDetailScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId || 'default';
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();
  const primaryColor = themeColors.light.primary;

  const messages = useChatStore((s) => s.messagesBySession[sessionId] ?? EMPTY_MESSAGES);
  const generating = useChatStore((s) => s.generating);
  const isReasoning = useChatStore((s) => s.isReasoning);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));

  const activeTopic = useTopicStore((s) => s.activeTopic);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);

  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const addFile = useFileStore((s) => s.addFile);

  const [inputText, setInputText] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [providerLogoError, setProviderLogoError] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isScrolledToBottom = useRef(true);

  // Skills drawer
  const [skillsSheetVisible, setSkillsSheetVisible] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());
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
  }, [session?.id, sessionSearchMode, sessionMemoryEnabled, sessionMemoryEffort]);

  const handlePluginsPress = useCallback(() => {
    haptics.light();
    setSkillsSheetVisible(true);
    setLoadingSkills(true);
    pluginApi
      .list()
      .then((list) => {
        setInstalledPlugins(list ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingSkills(false));
  }, []);

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
        if (agentId) {
          const pluginArr = [...next];
          console.info('[ChatDetail] persisting plugins:', pluginArr, 'agentId:', agentId);
          agentApi.updateConfig(agentId, { plugins: pluginArr }).catch((err) => {
            console.error('[ChatDetail] failed to persist plugins:', err);
          });
        } else {
          console.warn('[ChatDetail] agentId is null, cannot persist plugin toggle');
        }
        return next;
      });
    },
    [agentId],
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

  const handleSend = useCallback(() => {
    if ((!inputText.trim() && pendingFiles.length === 0) || generating) return;
    haptics.light();
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    sendMessage(sessionId, inputText.trim(), activeTopic ?? undefined, {
      memoryEffort,
      memoryEnabled,
      plugins: enabledPlugins.size > 0 ? [...enabledPlugins] : undefined,
      searchEnabled,
    });
    setInputText('');
    Keyboard.dismiss();
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

  const handleAttach = useCallback(() => {
    const pickImage = async (source: 'camera' | 'gallery') => {
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
          toast.show('success', t.toastFilePicked);
        }
      } catch {
        // user cancelled permission/system prompt, ignore to avoid unhandled rejection
      }
    };

    const pickDocument = async () => {
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
          toast.show('success', t.toastFilePicked);
        }
      } catch {
        // ignore
      }
    };

    haptics.selection();
    if (Platform.OS === 'ios') {
      // Build options based on model vision capability
      const options = modelSupportsVision
        ? [t.cancel, t.fileCamera, t.fileGallery, t.fileDocument]
        : [t.cancel, t.fileDocument];

      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: t.fileAttach },
        (index) => {
          if (modelSupportsVision) {
            if (index === 1) void pickImage('camera');
            else if (index === 2) void pickImage('gallery');
            else if (index === 3) void pickDocument();
          } else {
            if (index === 1) void pickDocument();
          }
        },
      );
    } else {
      if (modelSupportsVision) {
        Alert.alert(t.fileAttach, undefined, [
          { text: t.fileCamera, onPress: () => void pickImage('camera') },
          { text: t.fileGallery, onPress: () => void pickImage('gallery') },
          { text: t.fileDocument, onPress: () => void pickDocument() },
          { text: t.cancel, style: 'cancel' },
        ]);
      } else {
        Alert.alert(t.fileAttach, undefined, [
          { text: t.fileDocument, onPress: () => void pickDocument() },
          { text: t.cancel, style: 'cancel' },
        ]);
      }
    }
  }, [addFile, t, toast, modelSupportsVision]);

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
      toast.show('info', t.topicTitle);
      return;
    }
    try {
      const topicId = await topicApi.create(sessionId, t.topicTitle);
      if (topicId) {
        haptics.success();
        toast.show('success', t.topicTitle);
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
              <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
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
              accessibilityLabel="Topics"
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full"
              onPress={() => {
                haptics.light();
                navigation.navigate('TopicList', { sessionId });
              }}
            >
              <BookText
                color={semanticColors.muted}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
            <PressableScale
              accessibilityLabel="Settings"
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full ml-1"
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
                  source={require('../../assets/mink-logo.png')}
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
                    className="px-4 py-2.5 rounded-full border border-black/5"
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
          onContentSizeChange={() => {
            if (isScrolledToBottom.current || generating) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onLayout={() => {
            if (isScrolledToBottom.current || generating) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            isScrolledToBottom.current =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
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
              borderWidth: 0.5,
              borderColor: 'rgba(0,0,0,0.06)',
            }}
          >
            {pendingFiles.length > 0 && (
              <View className="px-3 pt-2">
                <FilePreview />
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
                style={{ textAlignVertical: 'top' }}
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
              {/* Send */}
              {inputText.trim() || pendingFiles.length > 0 ? (
                <Animated.View style={sendAnimStyle}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="w-9 h-9 bg-primary rounded-full items-center justify-center"
                    disabled={generating}
                    onPress={handleSend}
                  >
                    {generating ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Send
                        color="#fff"
                        size={16}
                        strokeWidth={tokens.icon.strokeWidth}
                        style={{ marginLeft: 1 }}
                      />
                    )}
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
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => setSkillsSheetVisible(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-black/10" />
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
              ) : installedPlugins.length === 0 ? (
                <View className="items-center py-10">
                  <Text className="text-secondary/50 text-[14px]">{t.skillsEmpty}</Text>
                  <Text className="text-secondary/40 text-[12px] mt-1 text-center px-4">
                    {t.skillsEmptyDesc}
                  </Text>
                </View>
              ) : (
                installedPlugins.map((plugin) => (
                  <View
                    className="flex-row items-center py-3.5 border-b border-black/[0.04]"
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
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
