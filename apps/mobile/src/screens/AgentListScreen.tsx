import { ArrowLeft, Bot } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { semanticColors } from '../constants/colors';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function AgentListScreen({ navigation }: any) {
  const { t } = useI18n();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.agentConfigTitle}
        onPressLeft={() => {
          haptics.light();
          navigation?.goBack?.();
        }}
      />

      <View className="flex-1 items-center justify-center px-8">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Bot color={semanticColors.primary} size={28} strokeWidth={1.6} />
        </View>
        <Text className="mt-5 text-center text-[18px] font-semibold text-foreground">
          {t.agentConfigSessionOnlyTitle}
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-6 text-secondary/65">
          {t.agentConfigSessionOnlyDesc}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          className="mt-6 rounded-2xl bg-primary px-5 py-3"
          onPress={() => {
            haptics.light();
            navigation?.navigate?.('Store');
          }}
        >
          <Text className="text-[14px] font-semibold text-white">{t.agentConfigOpenStore}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
