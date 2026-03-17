import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, RotateCcw, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import { clearAppLogs, formatAppLogs, getAppLogs, type AppLogEntry } from '../lib/logger';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function AppLogsScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
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
        leftElement={<ArrowLeft color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.logsTitle}
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
          <RotateCcw color={semanticColors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-medium text-foreground">{t.errorRetry}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          className="mr-2 flex-row items-center rounded-full bg-foreground/[0.05] px-3.5 py-2"
          onPress={() => void handleCopy()}
        >
          <Copy color={semanticColors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-medium text-foreground">{t.logsCopy}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center rounded-full bg-red-500/10 px-3.5 py-2"
          onPress={() => void handleClear()}
        >
          <Trash2 color={semanticColors.danger} size={16} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-2 text-[13px] font-medium text-red-500">{t.logsClear}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {logs.length === 0 ? (
          <View className="items-center px-4 pt-12">
            <Text className="text-center text-[15px] font-semibold text-foreground">{t.logsEmpty}</Text>
          </View>
        ) : (
          logs.map((entry) => (
            <View
              className="mb-3 rounded-2xl bg-foreground/[0.03] px-4 py-3"
              key={entry.id}
            >
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-secondary/55">
                {entry.level} · {entry.timestamp}
              </Text>
              <Text className="mt-2 text-[13px] leading-5 text-foreground">{entry.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
