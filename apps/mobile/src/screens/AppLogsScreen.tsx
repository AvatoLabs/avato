import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, RotateCcw, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, useWindowDimensions, View } from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsRow, SettingsSection } from '../components/ui/SettingsLayout';
import { useToast } from '../components/ui/Toast';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { type AppLogEntry, clearAppLogs, formatAppLogs, getAppLogs } from '../lib/logger';
import { getResponsiveLayoutMetrics } from '../lib/responsiveLayout';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

export default function AppLogsScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const contentWidth = Math.min(Math.max(screenWidth - 40, 0), responsiveMetrics.settingsMaxWidth);
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    setLogs(await getAppLogs());
  }, []);

  const handleRefreshLogs = useCallback(() => {
    haptics.light();
    void loadLogs();
  }, [loadLogs]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }, [loadLogs]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleCopy = useCallback(async () => {
    haptics.light();
    const entries = await getAppLogs();
    await Clipboard.setStringAsync(formatAppLogs(entries));
    haptics.success();
    toast.show('success', t.logsCopied);
  }, [t.logsCopied, toast]);

  const handleClear = useCallback(async () => {
    haptics.light();
    await clearAppLogs();
    setLogs([]);
    haptics.success();
  }, []);

  const listHeader = useMemo(
    () => (
      <View className="pb-1">
        <SettingsSection delay={0} title={t.logsActions}>
          <SettingsRow icon={RotateCcw} label={t.logsRefresh} onPress={handleRefreshLogs} />
          <SettingsRow icon={Copy} label={t.logsCopy} onPress={() => void handleCopy()} />
          <SettingsRow
            danger
            icon={Trash2}
            iconBg="bg-red-500/10"
            iconColor={colors.danger}
            label={t.logsClear}
            onPress={() => void handleClear()}
          />
        </SettingsSection>
      </View>
    ),
    [colors.danger, handleClear, handleCopy, handleRefreshLogs, t],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.logsTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => {
          haptics.light();
          navigation?.goBack?.();
        }}
      />

      <FlatList
        ListHeaderComponent={listHeader}
        className="flex-1"
        data={logs}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 justify-center pb-10 pt-6" style={{ width: contentWidth }}>
            <EmptyState iconVariant="logs" title={t.logsEmpty} />
          </View>
        }
        contentContainerStyle={
          logs.length === 0
            ? { alignItems: 'center', flexGrow: 1, paddingBottom: 40 }
            : { alignItems: 'center', paddingBottom: 40, paddingTop: 8 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => void onPullRefresh()}
          />
        }
        renderItem={({ item: entry }) => (
          <View style={{ width: contentWidth }}>
            <View className="mb-3 rounded-2xl bg-foreground/[0.03] px-4 py-3">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-secondary/55">
                {entry.level} · {entry.timestamp}
              </Text>
              <Text className="mt-2 text-[13px] leading-5 text-foreground">{entry.message}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
