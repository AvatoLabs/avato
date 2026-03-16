import { ArrowLeft, Bot, Plus } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { semanticColors } from '../constants/colors';
import { useI18n } from '../lib/i18n';
import { useAgentStore } from '../store/agent';
import { tokens } from '../theme/tokens';

export default function AgentListScreen({ navigation }: any) {
  const { t } = useI18n();
  const agents = useAgentStore((s) => s.agents);
  const initialized = useAgentStore((s) => s.initialized);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);

  useEffect(() => {
    if (!initialized) {
      void loadAgents();
    }
  }, [initialized, loadAgents]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.settingsDefaultAgent}
        leftElement={<ArrowLeft color={semanticColors.foreground} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        rightElement={<Plus color={semanticColors.primary} size={20} strokeWidth={2} />}
        onPressLeft={() => navigation.goBack()}
        onPressRight={() => navigation.navigate('AgentConfig')}
      />

      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 12 }}
        renderItem={({ item }) => (
          <PressableScale
            className="mx-5 mb-2 bg-foreground/[0.02] rounded-2xl px-4 py-3.5"
            onPress={() => navigation.navigate('AgentConfig', { agentId: item.id })}
            onLongPress={() =>
              Alert.alert(t.memoryDeleteConfirm, t.memoryDeleteDesc, [
                { style: 'cancel', text: t.cancel },
                {
                  style: 'destructive',
                  text: t.delete,
                  onPress: () => void deleteAgent(item.id),
                },
              ])
            }
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center mr-3">
                <Text style={{ fontSize: 18 }}>{item.avatar || '🤖'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-secondary/55 text-[12px] mt-0.5" numberOfLines={1}>
                  {item.model || 'default'}
                </Text>
              </View>
              <View className="rounded-full bg-primary/10 px-2.5 py-1">
                <Text className="text-primary text-[11px] font-semibold">
                  {item.sessionIds.length}
                </Text>
              </View>
            </View>
          </PressableScale>
        )}
        ListEmptyComponent={
          <View className="items-center pt-24">
            <Bot color={semanticColors.secondaryText} size={44} strokeWidth={1.4} />
            <Text className="text-secondary/60 text-[14px] mt-4">{t.skillsEmpty}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5"
              onPress={() => navigation.navigate('AgentConfig')}
            >
              <Text className="text-white text-[13px] font-semibold">{t.discoverUseAgent}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
