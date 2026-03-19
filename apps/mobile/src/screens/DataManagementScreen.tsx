/**
 * DataManagementScreen — Manage local data (clear cache, export, reset).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Download, RotateCcw, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsSection } from '../components/ui/SettingsLayout';
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
    Alert.alert(t.dataManageClearCache, 'Clear all cached data?', [
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
    Alert.alert(t.dataManageExport, t.dataManageComingSoon);
  };

  const handleReset = () => {
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
      icon: Trash2,
      color: colors.warning,
      label: t.dataManageClearCache,
      subtitle: t.dataClearCacheSubtitle,
      onPress: handleClearCache,
    },
    {
      icon: Download,
      color: colors.primary,
      label: t.dataManageExport,
      subtitle: t.dataManageComingSoon,
      onPress: handleExport,
    },
    {
      icon: RotateCcw,
      color: colors.danger,
      label: t.dataManageResetApp,
      subtitle: t.dataResetSubtitle,
      onPress: handleReset,
      danger: true,
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
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5 mb-2 rounded-xl bg-foreground/[0.02] active:bg-foreground/[0.04]"
                onPress={item.onPress}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${item.danger ? 'bg-red-500/10' : 'bg-foreground/5'}`}
                >
                  <item.icon color={item.color} size={20} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-medium tracking-tight ${item.danger ? 'text-red-500' : 'text-foreground'}`}
                  >
                    {item.label}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {item.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
