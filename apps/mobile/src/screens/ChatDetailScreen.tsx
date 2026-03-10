/**
 * ChatDetailScreen — Full chat experience matching the PWA.
 */
import { BlurView } from 'expo-blur';
import {
  ArrowLeft,
  PlusCircle,
  Send,
  Settings,
  User,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatStore } from '../store/chat';
import { useI18n } from '../lib/i18n';
import { useSessionStore } from '../store/session';
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

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages(sessionId);
  }, [sessionId, fetchMessages]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleSend = () => {
    if (!inputText.trim() || generating) return;
    sendMessage(sessionId, inputText.trim());
    setInputText('');
    Keyboard.dismiss();
  };

  const markdownStyles = {
    body: {
      color: isDark ? '#e0e0e0' : '#1a1a1a',
      fontSize: 15.5,
      lineHeight: 24,
    },
    code_inline: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      borderRadius: 6,
      color: isDark ? '#5bc0de' : '#e83e8c',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13.5,
      paddingHorizontal: 5,
    },
    fence: {
      backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderRadius: 10,
      borderWidth: 0.5,
      padding: 12,
    },
    code_block: {
      backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
      borderRadius: 10,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      padding: 12,
    },
    paragraph: {
      marginBottom: 4,
      marginTop: 4,
    },
    link: {
      color: '#007aff',
    },
    heading1: {
      color: isDark ? '#fff' : '#111',
      fontSize: 22,
      fontWeight: '700' as const,
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      color: isDark ? '#fff' : '#111',
      fontSize: 18,
      fontWeight: '600' as const,
      marginBottom: 6,
      marginTop: 10,
    },
    list_item: {
      marginBottom: 4,
    },
  };

  const userMarkdownStyles = {
    ...markdownStyles,
    body: { ...markdownStyles.body, color: '#ffffff' },
    code_inline: {
      ...markdownStyles.code_inline,
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: '#ffffff',
    },
    fence: {
      ...markdownStyles.fence,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderColor: 'rgba(255,255,255,0.1)',
    },
    code_block: {
      ...markdownStyles.code_block,
      backgroundColor: 'rgba(255,255,255,0.12)',
      color: '#ffffff',
    },
    link: { color: '#b3d9ff' },
    heading1: { ...markdownStyles.heading1, color: '#fff' },
    heading2: { ...markdownStyles.heading2, color: '#fff' },
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <View
          className={`flex-row w-full mb-5 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}
        >
          {!isUser && (
            <View className="w-9 h-9 mt-0.5 rounded-full bg-foreground/5 dark:bg-white/5 items-center justify-center mr-3 overflow-hidden">
              <RNImage
                className="w-7 h-7 rounded-lg"
                source={require('../../assets/icon.png')}
              />
            </View>
          )}

          <View
            className={`max-w-[78%] px-4 py-3 ${
              isUser
                ? 'bg-primary rounded-[20px] rounded-tr-[6px]'
                : 'bg-foreground/5 dark:bg-white/5 rounded-[20px] rounded-tl-[6px]'
            }`}
          >
            <Markdown style={isUser ? userMarkdownStyles : markdownStyles}>
              {item.content || (generating ? '...' : '')}
            </Markdown>
          </View>

          {isUser && (
            <View className="w-9 h-9 mt-0.5 rounded-full bg-foreground/5 dark:bg-white/5 items-center justify-center ml-3">
              <User color={isDark ? '#ccc' : '#555'} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

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
            <TouchableOpacity
              activeOpacity={0.7}
              className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10 mr-2"
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft color={isDark ? '#fff' : '#111'} size={22} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2.5 overflow-hidden">
              <RNImage
                className="w-6 h-6 rounded-md"
                source={require('../../assets/icon.png')}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-medium text-foreground tracking-tight" numberOfLines={1}>
                {session?.title || t.chatTitle}
              </Text>
              {generating && (
                <Text className="text-primary text-[12px] mt-0.5 font-medium">{t.chatThinking}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
            onPress={() =>
              navigation.navigate('ChatSettings', { sessionId })
            }
          >
            <Settings color={isDark ? '#aaa' : '#666'} size={20} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
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
            <View className="flex-1 items-center justify-center pt-20">
              <RNImage
                className="w-20 h-20 rounded-3xl mb-6"
                source={require('../../assets/mink-logo.png')}
              />
              <Text className="text-foreground font-medium text-xl tracking-tight">
                {t.chatEmptyTitle}
              </Text>
              <Text className="text-secondary/70 text-[15px] mt-3 text-center px-10 leading-6 font-medium">
                {t.chatEmptyDesc}
              </Text>
            </View>
          }
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 12,
            paddingTop: 12,
          }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Input Area */}
        <BlurView
          className="flex-row items-end px-3 pt-3"
          intensity={80}
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          tint={isDark ? 'dark' : 'light'}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            className="p-2 mb-1 opacity-60 active:opacity-100"
          >
            <PlusCircle color={isDark ? '#ccc' : '#555'} size={24} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>

          <View className="flex-1 bg-foreground/5 dark:bg-white/5 rounded-3xl mx-2 min-h-[44px] max-h-32 flex-row items-end px-1">
            <TextInput
              multiline
              className="flex-1 px-4 py-2.5 text-foreground text-[16px] leading-[22px]"
              editable={!generating}
              placeholder={generating ? t.chatGenerating : t.chatAskAnything}
              placeholderTextColor="#8c8c8c"
              style={{ textAlignVertical: 'top' }}
              value={inputText}
              onChangeText={setInputText}
            />
            {inputText.trim() ? (
              <TouchableOpacity
                activeOpacity={0.8}
                className="w-9 h-9 bg-primary rounded-full items-center justify-center mb-1 mr-0.5 active:bg-[#005bb5]"
                onPress={handleSend}
              >
                <Send color="#fff" size={17} strokeWidth={tokens.icon.strokeWidth} style={{ marginLeft: 1 }} />
              </TouchableOpacity>
            ) : (
              <View className="w-9 h-9 mb-1" />
            )}
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}
