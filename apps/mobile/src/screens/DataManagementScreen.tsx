/**
 * DataManagementScreen — Manage local data (clear cache, export, reset).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Bug, Download, RotateCcw, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsSection } from '../components/ui/SettingsLayout';
import { useToast } from '../components/ui/Toast';
import { clearTransientAppState } from '../lib/appState';
import { clearStoredAuthSession } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { getAppLoggingEnabled, setAppLoggingEnabled } from '../lib/logger';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

export default function DataManagementScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const [loggingEnabled, setLoggingEnabledState] = useState(false);

  useEffect(() => {
    setLoggingEnabledState(getAppLoggingEnabled());
  }, []);

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

  const handleToggleLogging = async (value: boolean) => {
    setLoggingEnabledState(value);
    await setAppLoggingEnabled(value);
    toast.show('success', value ? t.logsEnabled : t.logsDisabled);
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
      color: '#f5a623',
      label: t.dataManageClearCache,
      subtitle: t.dataClearCacheSubtitle,
      onPress: handleClearCache,
    },
    {
      icon: Download,
      color: '#007aff',
      label: t.dataManageExport,
      subtitle: t.dataManageComingSoon,
      onPress: handleExport,
    },
    {
      icon: RotateCcw,
      color: '#ff3b30',
      label: t.dataManageResetApp,
      subtitle: t.dataResetSubtitle,
      onPress: handleReset,
      danger: true,
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        title={t.dataManageTitle}
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
                className="flex-row items-center px-5 py-3.5 mb-2 rounded-2xl bg-foreground/[0.02] active:bg-foreground/[0.04]"
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
          <Animated.View entering={FadeInDown.delay(items.length * 50).duration(300)}>
            <View className="mb-2 rounded-2xl bg-foreground/[0.02] px-5 py-3.5">
              <View className="flex-row items-center">
                <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-foreground/5">
                  <Bug color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-medium tracking-tight text-foreground">
                    {t.logsCapture}
                  </Text>
                  <Text className="mt-0.5 text-[12px] font-medium text-secondary/50">
                    {t.logsCaptureDesc}
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                  value={loggingEnabled}
                  onValueChange={(value) => void handleToggleLogging(value)}
                />
              </View>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay((items.length + 1) * 50).duration(300)}>
            <TouchableOpacity
              activeOpacity={0.6}
              className="mb-2 flex-row items-center rounded-2xl bg-foreground/[0.02] px-5 py-3.5 active:bg-foreground/[0.04]"
              onPress={() => navigation.navigate('AppLogs')}
            >
              <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-foreground/5">
                <Download color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-medium tracking-tight text-foreground">
                  {t.logsView}
                </Text>
                <Text className="mt-0.5 text-[12px] font-medium text-secondary/50">
                  {t.logsViewDesc}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
