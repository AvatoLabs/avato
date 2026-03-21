/**
 * ChatDetailHeader — Unified header component for ChatDetailScreen.
 * Works for both iOS and Android without Platform.OS branches.
 */
import { BlurView } from 'expo-blur';
import { ArrowLeft, BookOpen, Cpu, MessageCircle, Settings } from 'lucide-react-native';
import React from 'react';
import { Image as RNImage, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { generateBestTitle } from '../lib/titleGeneration';
import type { RootStackNavigationProp } from '../navigation/types';
import { useThemeStore } from '../store/theme';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import PressableScale from './ui/PressableScale';
import { useToast } from './ui/Toast';

export interface ChatDetailHeaderProps {
  /** Active topic ID (for long-press title generation) */
  activeTopic?: string | null;
  /** Active topic title */
  activeTopicTitle?: string;
  /** Whether AI is generating a response */
  generating?: boolean;
  /** Whether this is a group session */
  isGroupSession?: boolean;
  /** Whether AI is in reasoning state */
  isReasoning?: boolean;
  /** Navigation object from React Navigation */
  navigation: RootStackNavigationProp;
  /** Callback to open notebook */
  onOpenNotebook?: () => void;
  /** Session ID */
  sessionId?: string;
  /** Current model name */
  sessionModel?: string;
  /** Current session title */
  sessionTitle?: string;
  /** Provider logo URL */
  toolbarProviderLogo?: string;
}

export default function ChatDetailHeader({
  navigation,
  sessionId,
  sessionTitle,
  activeTopicTitle,
  generating,
  isReasoning,
  isGroupSession,
  sessionModel,
  toolbarProviderLogo,
  activeTopic,
  onOpenNotebook,
}: ChatDetailHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const toast = useToast();
  const { t } = useI18n();
  const [providerLogoError, setProviderLogoError] = React.useState(false);

  const isAndroid = Platform.OS === 'android';

  const title = activeTopicTitle || sessionTitle || t.chatTitle;

  const handleGoBack = () => {
    haptics.light();
    navigation.goBack();
  };

  const handleOpenTopicList = () => {
    if (!sessionId) return;
    haptics.light();
    navigation.navigate('TopicList', { sessionId });
  };

  const handleGenerateTitle = async () => {
    if (!activeTopic || !sessionId) return;

    haptics.medium();
    const failMessage = [t.toastTitleGenerationFailed, t.toastTitleGenerationFailedHint]
      .filter(Boolean)
      .join(' ');
    try {
      const result = await generateBestTitle({
        force: true,
        sessionId,
        topicId: activeTopic,
      });
      if (result?.title) {
        haptics.success();
        toast.show('success', result.target === 'topic' ? t.topicRenamed : t.sessionRenamed);
      } else {
        toast.show('error', failMessage || 'Failed to generate title');
      }
    } catch {
      toast.show('error', failMessage || 'Failed to generate title');
    }
  };

  const handleOpenSettings = () => {
    if (!sessionId) return;
    haptics.light();
    navigation.navigate('ChatSettings', { sessionId });
  };

  const renderSubtitle = () => {
    if (generating) {
      return (
        <Text className="text-[12px] mt-0.5 font-medium" style={{ color: colors.primary }}>
          {isReasoning ? t.chatThinking : t.chatGenerating}
        </Text>
      );
    }

    if (!isGroupSession && sessionModel) {
      return (
        <View className="mt-0.5 flex-row items-center" style={{ minHeight: 14 }}>
          {toolbarProviderLogo && !providerLogoError ? (
            <RNImage
              source={{ uri: toolbarProviderLogo }}
              style={{ borderRadius: 3, height: 13, marginRight: 6, width: 13 }}
              onError={() => setProviderLogoError(true)}
            />
          ) : (
            <Cpu
              color={colors.secondaryText}
              size={13}
              strokeWidth={tokens.icon.strokeWidth}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            className="flex-1 text-[12px] font-medium"
            numberOfLines={1}
            style={{ color: colors.muted, lineHeight: 14 }}
          >
            {sessionModel}
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderTitleSection = () => (
    <View className="flex-1">
      <Text className="text-[16px] font-medium text-foreground tracking-tight" numberOfLines={1}>
        {title}
      </Text>
      {renderSubtitle()}
    </View>
  );

  const renderBackButton = () => (
    <PressableScale
      accessibilityLabel={t.accessibilityGoBack}
      accessibilityRole="button"
      className="w-9 h-9 items-center justify-center rounded-full mr-2"
      onPress={handleGoBack}
    >
      <ArrowLeft color={colors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />
    </PressableScale>
  );

  const renderActionButtons = () => (
    <View className="flex-row items-center gap-1">
      <PressableScale
        accessibilityLabel={t.topicTitle}
        accessibilityRole="button"
        className="w-9 h-9 items-center justify-center rounded-full"
        onLongPress={activeTopic ? handleGenerateTitle : undefined}
        onPress={handleOpenTopicList}
      >
        <MessageCircle color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
      </PressableScale>
      <PressableScale
        accessibilityLabel={t.notebookTitle}
        accessibilityRole="button"
        className="w-9 h-9 items-center justify-center rounded-full"
        onPress={onOpenNotebook}
      >
        <BookOpen color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
      </PressableScale>
      <PressableScale
        accessibilityLabel={t.accessibilitySettings}
        accessibilityRole="button"
        className="w-9 h-9 items-center justify-center rounded-full"
        onPress={handleOpenSettings}
      >
        <Settings color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
      </PressableScale>
    </View>
  );

  const renderHeaderContent = () => (
    <>
      <View className="flex-row items-center flex-1">
        {renderBackButton()}
        {renderTitleSection()}
      </View>
      {renderActionButtons()}
    </>
  );

  // Android uses solid background with border
  if (isAndroid) {
    return (
      <View
        className="z-10"
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          paddingTop: insets.top,
        }}
      >
        <View className="flex-row items-center justify-between px-4 py-2.5">
          {renderHeaderContent()}
        </View>
      </View>
    );
  }

  // iOS uses blur effect
  return (
    <View
      className="z-10"
      style={{
        paddingTop: insets.top,
      }}
    >
      <BlurView intensity={90} tint={effectiveTheme === 'dark' ? 'dark' : 'light'}>
        <View className="flex-row items-center justify-between px-4 py-2.5">
          {renderHeaderContent()}
        </View>
      </BlurView>
    </View>
  );
}
