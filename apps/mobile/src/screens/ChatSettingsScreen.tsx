/**
 * ChatSettingsScreen — Agent/chat settings for a specific session.
 * Includes model parameters, system prompt, and danger zone actions.
 */
import { ArrowLeft, Bot, MessageSquare, Pencil, Sliders, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SliderWithInput } from '../components/ui/SliderWithInput';
import { semanticColors } from '../constants/colors';
import { agentApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

// Remove ParamRow component, we'll use SliderWithInput instead

export default function ChatSettingsScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const removeSession = useSessionStore((s) => s.removeSession);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const [temperature, setTemperature] = useState('1.0');
  const [topP, setTopP] = useState('1.0');
  const [frequencyPenalty, setFrequencyPenalty] = useState('0.0');
  const [presencePenalty, setPresencePenalty] = useState('0.0');
  const [maxTokens, setMaxTokens] = useState('');
  const [enableMaxTokens, setEnableMaxTokens] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [title, setTitle] = useState(session?.title || '');
  const [description, setDescription] = useState(session?.description || '');
  const renameSession = useSessionStore((s) => s.renameSession);

  const loadSettings = useCallback(async () => {
    try {
      const config = await agentApi.getConfigBySession(sessionId);
      if (config) {
        setAgentId(config.id);
        if (config.params?.temperature != null) setTemperature(String(config.params.temperature));
        if (config.params?.top_p != null) setTopP(String(config.params.top_p));
        if (config.params?.frequency_penalty != null)
          setFrequencyPenalty(String(config.params.frequency_penalty));
        if (config.params?.presence_penalty != null)
          setPresencePenalty(String(config.params.presence_penalty));
        if (config.params?.max_tokens != null) {
          setMaxTokens(String(config.params.max_tokens));
          setEnableMaxTokens(true);
        }
        if (config.systemRole) setSystemPrompt(config.systemRole);
      }
    } catch {
      /* fallback silently */
    }
  }, [sessionId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!agentId) return;
    try {
      const params: Record<string, number | undefined> = {
        temperature: parseFloat(temperature) || 1,
        top_p: parseFloat(topP) || 1,
        frequency_penalty: parseFloat(frequencyPenalty) || 0,
        presence_penalty: parseFloat(presencePenalty) || 0,
      };
      if (enableMaxTokens && maxTokens) {
        params.max_tokens = parseInt(maxTokens, 10) || undefined;
      }
      await agentApi.updateConfig(agentId, {
        systemRole: systemPrompt || undefined,
        params,
      });
    } catch {
      /* best-effort */
    }

    const newTitle = title.trim();
    if (newTitle && newTitle !== session?.title) {
      try {
        await renameSession(sessionId, newTitle);
      } catch {
        /* best-effort */
      }
    }
  };

  const handleDeleteChat = () => {
    Alert.alert(t.chatSettingsDeleteConfirm, t.chatSettingsDeleteDesc, [
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
    ]);
  };

  const handleClearHistory = () => {
    Alert.alert(t.chatSettingsClearConfirm, t.chatSettingsClearDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.chatSettingsClearConfirm,
        style: 'destructive',
        onPress: () => {
          clearMessages(sessionId);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color={semanticColors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        rightElement={<Text className="text-primary font-medium text-[15px]">{t.save}</Text>}
        title={t.chatSettingsTitle}
        onPressLeft={() => {
          saveSettings();
          navigation.goBack();
        }}
        onPressRight={async () => {
          await saveSettings();
          haptics.success();
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        {/* Agent Profile */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View className="mx-5 mt-5 mb-5">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsAgentProfile || 'Agent Profile'}
            </Text>
            <View className="bg-foreground/5 rounded-2xl px-4 py-3">
              <View className="flex-row items-center mb-3">
                <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-4">
                  <Bot color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <TextInput
                    className="text-[16px] font-semibold text-foreground tracking-tight"
                    placeholder={t.chatSettingsAgentTitlePlaceholder || 'Agent name'}
                    placeholderTextColor={semanticColors.secondaryText}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>
                <Pencil color={semanticColors.secondaryText} size={14} strokeWidth={1.5} />
              </View>
              <View className="pt-3">
                <TextInput
                  multiline
                  className="text-foreground text-[14px] leading-5"
                  placeholder={t.chatSettingsAgentDescPlaceholder || 'Add a description...'}
                  placeholderTextColor={semanticColors.secondaryText}
                  style={{ minHeight: 40, textAlignVertical: 'top' }}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Model Parameters */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View className="mx-5 mb-5">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsModelParams}
            </Text>
            <View className="bg-foreground/5 rounded-2xl px-4 gap-4 py-3">
              {/* Frequency Penalty */}
              <View>
                <Text className="text-foreground text-[13px] font-medium mb-2">
                  {t.chatSettingsFrequencyPenalty}
                </Text>
                <SliderWithInput
                  max={2}
                  min={-2}
                  step={0.1}
                  value={parseFloat(frequencyPenalty) || 0}
                  onChange={(val) => setFrequencyPenalty(String(val))}
                />
              </View>

              {/* Presence Penalty */}
              <View>
                <Text className="text-foreground text-[13px] font-medium mb-2">
                  {t.chatSettingsPresencePenalty}
                </Text>
                <SliderWithInput
                  max={2}
                  min={-2}
                  step={0.1}
                  value={parseFloat(presencePenalty) || 0}
                  onChange={(val) => setPresencePenalty(String(val))}
                />
              </View>

              {/* Temperature */}
              <View>
                <Text className="text-foreground text-[13px] font-medium mb-2">
                  {t.chatSettingsTemperature}
                </Text>
                <SliderWithInput
                  max={2}
                  min={0}
                  step={0.1}
                  value={parseFloat(temperature) || 1}
                  onChange={(val) => setTemperature(String(val))}
                />
              </View>

              {/* Top P */}
              <View>
                <Text className="text-foreground text-[13px] font-medium mb-2">
                  {t.chatSettingsTopP}
                </Text>
                <SliderWithInput
                  max={1}
                  min={0}
                  step={0.1}
                  value={parseFloat(topP) || 1}
                  onChange={(val) => setTopP(String(val))}
                />
              </View>

              {/* Max Tokens Toggle */}
              <View className="flex-row items-center justify-between py-2 pt-3 mt-1">
                <Text className="text-foreground text-[13px] font-medium">
                  {t.chatSettingsEnableMaxTokens}
                </Text>
                <Switch
                  style={{ transform: [{ scale: 0.8 }] }}
                  trackColor={{ false: '#e0e0e0', true: semanticColors.primary }}
                  value={enableMaxTokens}
                  onValueChange={setEnableMaxTokens}
                />
              </View>

              {/* Max Tokens Slider (conditional) */}
              {enableMaxTokens && (
                <View className="pt-3">
                  <Text className="text-foreground text-[13px] font-medium mb-2">
                    {t.chatSettingsMaxTokens}
                  </Text>
                  <SliderWithInput
                    max={32000}
                    min={0}
                    step={100}
                    value={parseInt(maxTokens) || 0}
                    onChange={(val) => setMaxTokens(String(val))}
                  />
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* System Prompt */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <View className="mx-5 mb-5">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsSystemPrompt}
            </Text>
            <View className="bg-foreground/5 rounded-2xl px-4 py-3">
              <View className="flex-row items-center mb-2">
                <Sliders
                  color={semanticColors.muted}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 8 }}
                />
                <Text className="text-foreground text-[14px] font-medium tracking-tight">
                  {t.chatSettingsCustomInstructions}
                </Text>
              </View>
              <TextInput
                multiline
                className="text-foreground text-[14px] leading-5 min-h-[100px]"
                placeholder={t.chatSettingsSystemPromptPlaceholder}
                placeholderTextColor={semanticColors.muted}
                style={{ textAlignVertical: 'top' }}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
              />
            </View>
          </View>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View className="mx-5 mt-4">
            <Text className="text-secondary/60 text-[12px] font-medium mb-2 ml-1 uppercase tracking-wider">
              {t.chatSettingsDangerZone}
            </Text>
            <View className="bg-foreground/5 rounded-2xl overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-4 active:bg-foreground/5"
                onPress={handleClearHistory}
              >
                <MessageSquare
                  color="#f5a623"
                  size={17}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground text-[15px] flex-1 font-medium">
                  {t.chatSettingsClearHistory}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-4 active:bg-foreground/5"
                onPress={handleDeleteChat}
              >
                <Trash2
                  color={semanticColors.danger}
                  size={17}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 12 }}
                />
                <Text className="text-[15px] flex-1 font-medium" style={{ color: semanticColors.danger }}>
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
