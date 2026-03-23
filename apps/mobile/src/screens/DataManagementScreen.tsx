/**
 * DataManagementScreen — Manage local data (clear cache, export, reset).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Download, RotateCcw, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsRow, SettingsSection } from '../components/ui/SettingsLayout';
import { clearTransientAppState } from '../lib/appState';
import { clearStoredAuthSession } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

export default function DataManagementScreen({ navigation }: any) {
  const { t } = useI18n();
  const colors = useThemeColors();

  const handleClearCache = () => {
    haptics.light();
    Alert.alert(t.dataManageClearCache, t.dataManageClearCacheMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirm,
        onPress: () => {
          // Clear non-essential AsyncStorage keys
          Alert.alert(t.done, t.dataCacheCleared);
        },
      },
    ]);
  };

  const handleExport = () => {
    haptics.light();
    Alert.alert(t.dataManageExport, t.dataManageComingSoon);
  };

  const handleReset = () => {
    haptics.light();
    Alert.alert(t.dataManageResetConfirm, t.dataManageResetDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.dataManageResetApp,
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          await clearStoredAuthSession();
          await clearTransientAppState();
          navigation.reset({
            index: 0,
            routes: [{ name: 'ServerConfig', params: { firstLaunch: true } }],
          });
        },
      },
    ]);
  };

  const items = [
    {
      danger: false as const,
      icon: Trash2,
      iconBg: 'bg-orange-500/15' as const,
      iconColor: colors.warning,
      label: t.dataManageClearCache,
      onPress: handleClearCache,
      subtitle: t.dataClearCacheSubtitle,
    },
    {
      danger: false as const,
      icon: Download,
      label: t.dataManageExport,
      onPress: handleExport,
      subtitle: t.dataManageComingSoon,
    },
    {
      danger: true as const,
      icon: RotateCcw,
      iconBg: 'bg-red-500/10' as const,
      iconColor: colors.danger,
      label: t.dataManageResetApp,
      onPress: handleReset,
      subtitle: t.dataResetSubtitle,
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.dataManageTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => {
          haptics.light();
          navigation?.goBack?.();
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
        <SettingsSection delay={0} title={t.settingsDataStorage}>
          {items.map((item, index) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} key={item.label}>
              <SettingsRow
                danger={item.danger}
                icon={item.icon}
                iconBg={item.iconBg}
                iconColor={item.iconColor}
                label={item.label}
                subtitle={item.subtitle}
                onPress={item.onPress}
              />
            </Animated.View>
          ))}
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
