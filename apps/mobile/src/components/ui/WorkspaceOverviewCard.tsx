import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Image as RNImage, Platform, Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useResolvedRemoteAsset } from '../../lib/remoteAsset';
import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface WorkspaceOverviewCardProps {
  defaultModel?: string;
  isConnected?: boolean;
  onPress?: () => void;
  onPressModel?: () => void;
  onPressProviders?: () => void;
  providerCount?: number;
  serverDisplay?: string;
  userAvatar?: string | null;
  userId?: string;
  userName?: string;
}

/**
 * WorkspaceOverviewCard — Identity + runtime status summary for the Workspace screen.
 *
 * Three independent tap zones:
 *  - Identity area (avatar + name) → onPress (ProfileEdit)
 *  - Model sub-card → onPressModel (ModelPicker)
 *  - Providers sub-card → onPressProviders (AIProviders)
 */
export function WorkspaceOverviewCard({
  userName = 'Avato User',
  defaultModel = 'GPT-4o Mini',
  isConnected = false,
  providerCount = 0,
  serverDisplay,
  userAvatar,
  userId,
  onPress,
  onPressModel,
  onPressProviders,
}: WorkspaceOverviewCardProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const useNativeBlur = Platform.OS !== 'android';
  const resolvedAvatarUri = useResolvedRemoteAsset(userAvatar);
  const blurTint = effectiveTheme === 'dark' ? 'dark' : 'light';
  const infoRows = [
    { label: t.workspaceUserId, value: userId || t.settingsNotConfigured },
    { label: t.workspaceEndpoint, value: serverDisplay || t.settingsNotConfigured },
  ];

  const content = (
    <>
      <PressableScale className="mb-4 flex-row items-center" onPress={onPress}>
        <View
          className="mr-3.5 h-12 w-12 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: colors.primarySubtle }}
        >
          {resolvedAvatarUri ? (
            <RNImage
              source={{ uri: resolvedAvatarUri }}
              style={{ width: 48, height: 48, borderRadius: 24 }}
              onError={() => {}}
            />
          ) : (
            <Text className="text-[16px] font-bold" style={{ color: colors.primary }}>
              {String(userName || 'U')
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-[18px] font-semibold tracking-tight">
            {userName || 'User'}
          </Text>
          <View className="mt-1 flex-row items-center">
            <View
              className="mr-2 h-2 w-2 rounded-full"
              style={{
                backgroundColor: isConnected ? colors.success : colors.tertiaryText,
              }}
            />
            <Text className="text-[12px] font-medium" style={{ color: colors.secondaryText }}>
              {isConnected ? t.workspaceConnected : t.workspaceNotConnected}
            </Text>
          </View>
        </View>
        <ChevronRight color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
      </PressableScale>

      <View
        className="mb-5 rounded-xl px-3.5 py-3"
        style={{
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
        }}
      >
        {infoRows.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? (
              <View className="my-2 h-px" style={{ backgroundColor: colors.borderSubtle }} />
            ) : null}
            <View className="flex-row items-center">
              <Text
                className="mr-3 text-[10px] font-semibold"
                numberOfLines={1}
                style={{ color: colors.primary, letterSpacing: 1.2, minWidth: 68 }}
              >
                {row.label}
              </Text>
              <Text
                className="flex-1 text-right text-[13px] font-medium"
                numberOfLines={1}
                style={{ color: colors.foreground }}
              >
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row gap-3">
        <PressableScale
          className="flex-1 rounded-xl px-3.5 py-3"
          style={{
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
          }}
          onPress={onPressModel}
        >
          <Text className="mb-1 text-[11px] font-semibold" style={{ color: colors.primary }}>
            {t.settingsDefaultModel}
          </Text>
          <Text
            className="text-foreground text-[14px] font-medium tracking-tight"
            numberOfLines={1}
          >
            {defaultModel}
          </Text>
        </PressableScale>
        <PressableScale
          className="flex-1 rounded-xl px-3.5 py-3"
          style={{
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
          }}
          onPress={onPressProviders}
        >
          <Text className="mb-1 text-[11px] font-semibold" style={{ color: colors.primary }}>
            {t.workspaceProviders}
          </Text>
          <Text className="text-foreground text-[14px] font-medium tracking-tight">
            {(t.providerCountActive ?? '{count} active').replace(
              '{count}',
              String(providerCount ?? 0),
            )}
          </Text>
        </PressableScale>
      </View>
    </>
  );

  return (
    <View
      className="mx-6 mb-6 overflow-hidden rounded-2xl"
      style={{
        backgroundColor: colors.fillQuaternary,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
      }}
    >
      {useNativeBlur ? (
        <BlurView className="overflow-hidden rounded-2xl p-5" intensity={80} tint={blurTint}>
          {content}
        </BlurView>
      ) : (
        <View className="overflow-hidden rounded-2xl p-5">{content}</View>
      )}
    </View>
  );
}
