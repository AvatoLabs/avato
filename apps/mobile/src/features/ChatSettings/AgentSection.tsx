/**
 * AgentSection — Agent config entry for ChatSettings (single-agent only).
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n } from '../../lib/i18n';

interface AgentSectionProps {
  agentSummary?: {
    avatar?: string;
    description?: string;
    title?: string;
  } | null;
  delay?: number;
  onPress: () => void;
}

export function AgentSection({ agentSummary, delay = 100, onPress }: AgentSectionProps) {
  const { t } = useI18n();

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mx-5 mb-5">
        <Text className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wider text-secondary/60">
          {t.agentConfigTitle}
        </Text>
        <View className="rounded-2xl bg-foreground/[0.02] px-4 py-3">
          <View>
            <Text className="text-[14px] font-medium text-foreground">
              {agentSummary
                ? `${agentSummary.avatar || '🤖'} ${agentSummary.title || t.settingsDefaultAgent}`
                : t.settingsNotConfigured}
            </Text>
            {agentSummary?.description ? (
              <Text className="mt-1 text-[12px] leading-5 text-secondary/60">
                {agentSummary.description}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            className="mt-4 self-start rounded-xl bg-primary/10 px-3 py-2"
            onPress={onPress}
          >
            <Text className="text-[13px] font-semibold text-primary">{t.agentConfigTitle}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
