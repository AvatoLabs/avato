/**
 * ChatDetailScreen — Full chat experience with MessageBubble, Topics, and file attachments.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, BookText, Paperclip, Send, Settings } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
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
import MessageBubble from '../components/ui/MessageBubble';
import PressableScale from '../components/ui/PressableScale';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useSessionStore } from '../store/session';
import { useTopicStore } from '../store/topic';
import { tokens } from '../theme/tokens';
import type { ChatMessage } from '../types';

const EMPTY_MESSAGES: ChatMessage[] = [];

export default function ChatDetailScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId || 'default';
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  const messages = useChatStore((s) => s.messagesBySession[sessionId] ?? EMPTY_MESSAGES);
  const generating = useChatStore((s) => s.generating);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));

  const activeTopic = useTopicStore((s) => s.activeTopic);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);

  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const addFile = useFileStore((s) => s.addFile);

  const [inputText, setInputText] = useState('');
  const [sessionModel, setSessionModel] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);

  // Load per-session model name for header display
  useEffect(() => {
    (async () => {
      let modelName = '';
      try {
        const raw = await AsyncStorage.getItem(`minkhub_chat_settings_${sessionId}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.model) modelName = saved.model;
        }
      } catch {
        /* ignore */
      }
      if (!modelName) {
        try {
          const global = await AsyncStorage.getItem('minkhub_default_model');
          if (global) modelName = global;
        } catch {
          /* ignore */
        }
      }
      setSessionModel(modelName);
    })();
  }, [sessionId]);

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

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const handleSend = useCallback(() => {
    if (!inputText.trim() || generating) return;
    haptics.light();
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    sendMessage(sessionId, inputText.trim(), activeTopic ?? undefined);
    setInputText('');
    Keyboard.dismiss();
  }, [inputText, generating, sendMessage, sessionId, activeTopic, sendScale]);

  const handleAttach = useCallback(() => {
    const options = [t.cancel, t.fileCamera, t.fileGallery, t.fileDocument];
    const pickImage = async (source: 'camera' | 'gallery') => {
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
    };

    const pickDocument = async () => {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true });
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
    };

    haptics.selection();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: t.fileAttach },
        (index) => {
          if (index === 1) pickImage('camera');
          else if (index === 2) pickImage('gallery');
          else if (index === 3) pickDocument();
        },
      );
    } else {
      // Android: directly open gallery as primary action
      pickImage('gallery');
    }
  }, [addFile, t]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble generating={generating} message={item} sessionId={sessionId} />
    ),
    [sessionId, generating],
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <BlurView
        className="z-10"
        intensity={90}
        style={{ paddingTop: insets.top }}
        tint={isDark ? 'dark' : 'light'}
      >
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
              <ArrowLeft
                color={isDark ? '#fff' : '#111'}
                size={22}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2.5 overflow-hidden">
              <RNImage className="w-6 h-6 rounded-md" source={require('../../assets/icon.png')} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[16px] font-medium text-foreground tracking-tight"
                numberOfLines={1}
              >
                {session?.title || t.chatTitle}
              </Text>
              {generating ? (
                <Text className="text-primary text-[12px] mt-0.5 font-medium">
                  {t.chatThinking}
                </Text>
              ) : sessionModel ? (
                <Text
                  className="text-secondary/50 text-[12px] mt-0.5 font-medium"
                  numberOfLines={1}
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
                color={isDark ? '#aaa' : '#666'}
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
                color={isDark ? '#aaa' : '#666'}
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
                    className="px-4 py-2.5 rounded-full border border-black/5 dark:border-white/[0.06]"
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
            tint={isDark ? 'dark' : 'light'}
            style={{
              borderWidth: 0.5,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            {pendingFiles.length > 0 && (
              <View className="px-3 pt-2">
                <FilePreview />
              </View>
            )}
            <View className="flex-row items-end px-2 py-1.5">
              <TouchableOpacity
                accessibilityLabel="Attach file"
                accessibilityRole="button"
                activeOpacity={0.7}
                className="w-9 h-9 items-center justify-center rounded-full mb-0.5 opacity-60 active:opacity-100"
                onPress={handleAttach}
              >
                <Paperclip
                  color={isDark ? '#ccc' : '#555'}
                  size={22}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              <TextInput
                multiline
                className="flex-1 px-2 py-2 text-foreground text-[16px] leading-[22px] min-h-[36px] max-h-28"
                editable={!generating}
                placeholder={generating ? t.chatGenerating : hints[hintIndex]}
                placeholderTextColor={isDark ? '#636366' : '#8c8c8c'}
                style={{ textAlignVertical: 'top' }}
                value={inputText}
                onChangeText={setInputText}
              />
              {inputText.trim() ? (
                <Animated.View style={sendAnimStyle}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="w-9 h-9 bg-primary rounded-full items-center justify-center mb-0.5"
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
                <View className="w-9 h-9 mb-0.5" />
              )}
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
