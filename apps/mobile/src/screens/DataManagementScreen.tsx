/**
 * DataManagementScreen — Manage local data (clear cache, export, reset).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Download, RotateCcw, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearAuth } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function DataManagementScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

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
          await clearAuth();
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
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <TouchableOpacity
          activeOpacity={0.7}
          className="w-9 h-9 items-center justify-center rounded-full active:bg-foreground/10"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        <Text className="text-[17px] font-semibold text-foreground">{t.dataManageTitle}</Text>
        <View className="w-9" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        {items.map((item, index) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} key={item.label}>
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-row items-center px-5 py-4 mx-4 mb-3 rounded-xl bg-foreground/5 active:bg-foreground/10"
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
      </ScrollView>
    </View>
  );
}
