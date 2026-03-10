/**
 * DiscoverScreen → Studio Capability Hub
 *
 * Always populated. Featured workflows, curated assistants, models, and tools.
 */
import { Bot } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AssistantCard } from '../components/ui/AssistantCard';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { SectionBlock } from '../components/ui/SectionBlock';
import { marketApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { MarketAgent } from '../types';

export default function DiscoverScreen({ navigation: _navigation }: any) {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const result = await marketApi.getAgentList();
      setAgents(result?.agents ?? []);
    } catch (err) {
      console.warn('[Studio] fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgents();
    setRefreshing(false);
  }, [fetchAgents]);

  const displayAssistants = agents.slice(0, 8).map((a) => ({
    key: a.identifier,
    name: a.meta.title,
    description: a.meta.description || '',
    icon: Bot,
  }));

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t.studioTitle} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={['#007aff']}
            refreshing={refreshing}
            tintColor="#007aff"
            onRefresh={onRefresh}
          />
        }
      >
        {/* Search */}
        <View className="px-5 pt-2 pb-4">
          <SearchField
            placeholder={t.discoverSearchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Assistants */}
        {displayAssistants.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <SectionBlock action={t.studioViewAll} title={t.studioAssistants}>
              <ScrollView
                horizontal
                className="px-5"
                contentContainerStyle={{ paddingRight: 20 }}
                showsHorizontalScrollIndicator={false}
              >
                {displayAssistants.map((assistant) => (
                  <AssistantCard
                    description={assistant.description}
                    icon={assistant.icon}
                    key={assistant.key}
                    name={assistant.name}
                  />
                ))}
              </ScrollView>
            </SectionBlock>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
