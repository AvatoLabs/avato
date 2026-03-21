import { BlurView } from 'expo-blur';
import { ChevronDown, Menu } from 'lucide-react-native';
import React from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../lib/i18n';
import { useThemeStore } from '../store/theme';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import PressableScale from './ui/PressableScale';
import { HeaderIconButton } from './ui/ScreenHeader';

interface ChatListHeaderProps {
  avatar: React.ReactNode;
  directoryVisible: boolean;
  onOpenAssistantPicker: () => void;
  onOpenDirectory: () => void;
  subtitle?: string;
  title: string;
}

export default function ChatListHeader({
  avatar,
  directoryVisible,
  subtitle,
  title,
  onOpenAssistantPicker,
  onOpenDirectory,
}: ChatListHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);

  const headerContent = (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingHorizontal: tokens.spacing.md + tokens.spacing.xs,
        paddingVertical: tokens.spacing.sm,
      }}
    >
      <View className="flex-row items-center flex-1">
        <HeaderIconButton
          accessibilityLabel={t.accessibilityChatDirectory}
          active={directoryVisible}
          onPress={onOpenDirectory}
        >
          <Menu
            color={directoryVisible ? colors.primary : colors.foreground}
            size={20}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </HeaderIconButton>
        <PressableScale
          accessibilityLabel={t.chatListAssistants}
          accessibilityRole="button"
          className="ml-2 flex-1 rounded-2xl px-3 py-2"
          style={{
            backgroundColor: colors.fillQuaternary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
          }}
          onPress={onOpenAssistantPicker}
        >
          <View className="flex-row items-center">
            <View className="mr-3">{avatar}</View>
            <View className="flex-1">
              <Text
                className="text-[16px] font-medium text-foreground tracking-tight"
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle ? (
                <View className="mt-0.5 flex-row items-center">
                  <Text
                    className="flex-1 text-[12px] font-medium"
                    numberOfLines={1}
                    style={{ color: colors.muted }}
                  >
                    {subtitle}
                  </Text>
                </View>
              ) : null}
            </View>
            <ChevronDown
              color={colors.secondaryText}
              size={16}
              strokeWidth={tokens.icon.strokeWidth}
              style={{ marginLeft: 8 }}
            />
          </View>
        </PressableScale>
      </View>
    </View>
  );

  if (Platform.OS === 'android') {
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
        {headerContent}
      </View>
    );
  }

  return (
    <View className="z-10" style={{ paddingTop: insets.top }}>
      <BlurView intensity={90} tint={effectiveTheme === 'dark' ? 'dark' : 'light'}>
        {headerContent}
      </BlurView>
    </View>
  );
}
