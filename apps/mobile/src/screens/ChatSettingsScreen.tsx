/**
 * ChatSettingsScreen — Agent/chat settings for a specific session.
 */
import {
  ArrowLeft,
  Bot,
  Brain,
  MessageSquare,
  Sliders,
  Thermometer,
  Trash2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

export default function ChatSettingsScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId;
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const removeSession = useSessionStore((s) => s.removeSession);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState('0.7');
  const [systemPrompt, setSystemPrompt] = useState('');

  const handleDeleteChat = () => {
    Alert.alert(
      t.chatSettingsDeleteConfirm,
      t.chatSettingsDeleteDesc,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            clearMessages(sessionId);
            await removeSession(sessionId);
            navigation.navigate('MainTabs');
          },
        },
      ],
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      t.chatSettingsClearConfirm,
      t.chatSettingsClearDesc,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.chatSettingsClearConfirm,
          style: 'destructive',
          onPress: () => {
            clearMessages(sessionId);
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.chatSettingsTitle}
        leftElement={
          <ArrowLeft color={isDark ? '#fff' : '#111'} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Session Info */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View className="mx-5 mt-5 mb-6 rounded-[20px] bg-foreground/5 dark:bg-white/5 p-5 flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-4">
              <Bot color="#007aff" size={22} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-semibold text-foreground tracking-tight">
                {session?.title || 'Chat'}
              </Text>
              <Text className="text-secondary/70 text-[13px] mt-0.5 font-medium">
                Session ID: {sessionId?.slice(0, 8)}...
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Model Selection */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View className="mx-5 mb-5">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsModel}
            </Text>
            <View className="bg-foreground/5 dark:bg-white/5 rounded-2xl">
              <View className="flex-row items-center px-4 py-4">
                <Brain color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} style={{ marginRight: 12 }} />
                <TextInput
                  className="flex-1 text-foreground text-[15px]"
                  placeholder="gpt-4o-mini"
                  placeholderTextColor="#8c8c8c"
                  value={model}
                  onChangeText={setModel}
                />
              </View>

              <View className="px-4 py-3">
                <Text className="text-secondary/60 text-[12px] font-medium">
                  {t.chatSettingsModelHint}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Temperature */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <View className="mx-5 mb-5">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsTemperature}
            </Text>
            <View className="bg-foreground/5 dark:bg-white/5 rounded-2xl px-4 py-4 flex-row items-center">
              <Thermometer color="#f5a623" size={18} strokeWidth={tokens.icon.strokeWidth} style={{ marginRight: 12 }} />
              <TextInput
                className="flex-1 text-foreground text-[15px]"
                keyboardType="decimal-pad"
                placeholder="0.7"
                placeholderTextColor="#8c8c8c"
                value={temperature}
                onChangeText={setTemperature}
              />
              <Text className="text-secondary/60 text-[13px] font-medium">0.0 – 2.0</Text>
            </View>
          </View>
        </Animated.View>

        {/* System Prompt */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View className="mx-5 mb-5">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsSystemPrompt}
            </Text>
            <View className="bg-foreground/5 dark:bg-white/5 rounded-2xl px-4 py-3">
              <View className="flex-row items-center mb-2">
                <Sliders color={isDark ? '#aaa' : '#666'} size={16} strokeWidth={tokens.icon.strokeWidth} style={{ marginRight: 8 }} />
                <Text className="text-foreground text-[14px] font-medium tracking-tight">{t.chatSettingsCustomInstructions}</Text>
              </View>
              <TextInput
                multiline
                className="text-foreground text-[14px] leading-5 min-h-[100px]"
                placeholder={t.chatSettingsSystemPromptPlaceholder}
                placeholderTextColor="#8c8c8c"
                style={{ textAlignVertical: 'top' }}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
              />
            </View>
          </View>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <View className="mx-5 mt-4">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsDangerZone}
            </Text>
            <View className="bg-foreground/5 dark:bg-white/5 rounded-2xl overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-4 active:bg-foreground/5"
                onPress={handleClearHistory}
              >
                <MessageSquare color="#f5a623" size={17} strokeWidth={tokens.icon.strokeWidth} style={{ marginRight: 12 }} />
                <Text className="text-foreground text-[15px] flex-1 font-medium">{t.chatSettingsClearHistory}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-4 active:bg-foreground/5"
                onPress={handleDeleteChat}
              >
                <Trash2 color="#ff3b30" size={17} strokeWidth={tokens.icon.strokeWidth} style={{ marginRight: 12 }} />
                <Text className="text-[#ff3b30] text-[15px] flex-1 font-medium">
                  {t.chatSettingsDeleteConversation}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
