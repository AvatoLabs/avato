import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, RotateCcw, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { type AppLogEntry, clearAppLogs, formatAppLogs, getAppLogs } from '../lib/logger';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

export default function AppLogsScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const [logs, setLogs] = useState<AppLogEntry[]>([]);

  const loadLogs = useCallback(async () => {
    setLogs(await getAppLogs());
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleCopy = useCallback(async () => {
    const entries = await getAppLogs();
    await Clipboard.setStringAsync(formatAppLogs(entries));
    haptics.success();
    toast.show('success', t.logsCopied);
  }, [t.logsCopied, toast]);

  const handleClear = useCallback(async () => {
    await clearAppLogs();
    setLogs([]);
    haptics.success();
  }, []);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.logsTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => {
          haptics.light();
          navigation.goBack();
        }}
      />

      <View className="flex-row px-5 pb-3 pt-4">
        <TouchableOpacity
          activeOpacity={0.7}
          className="mr-2 flex-row items-center rounded-full bg-foreground/[0.05] px-3.5 py-2"
          onPress={() => void loadLogs()}
        >
          <RotateCcw color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-medium text-foreground">{t.errorRetry}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          className="mr-2 flex-row items-center rounded-full bg-foreground/[0.05] px-3.5 py-2"
          onPress={() => void handleCopy()}
        >
          <Copy color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-medium text-foreground">{t.logsCopy}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center rounded-full bg-red-500/10 px-3.5 py-2"
          onPress={() => void handleClear()}
        >
          <Trash2 color={colors.danger} size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-medium text-red-500">{t.logsClear}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        className="flex-1"
        data={logs}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState iconVariant="logs" title={t.logsEmpty} />}
        contentContainerStyle={
          logs.length === 0
            ? {
                flexGrow: 1,
                justifyContent: 'center',
                paddingBottom: 40,
                paddingHorizontal: 20,
              }
            : { paddingBottom: 40, paddingHorizontal: 20 }
        }
        renderItem={({ item: entry }) => (
          <View className="mb-3 rounded-2xl bg-foreground/[0.03] px-4 py-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-secondary/55">
              {entry.level} · {entry.timestamp}
            </Text>
            <Text className="mt-2 text-[13px] leading-5 text-foreground">{entry.message}</Text>
          </View>
        )}
      />
    </View>
  );
}
