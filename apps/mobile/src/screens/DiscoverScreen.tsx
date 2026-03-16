/**
 * DiscoverScreen → Tabbed marketplace (Agents / Models / Providers).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, LayoutAnimation, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import AgentCard from '../components/ui/AgentCard';
import ModelCard from '../components/ui/ModelCard';
import PressableScale from '../components/ui/PressableScale';
import ProviderCard from '../components/ui/ProviderCard';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useDiscoverStore } from '../store/discover';

type Tab = 'agents' | 'models' | 'providers';

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="mb-3 px-5">
      <Text className="text-secondary/60 text-[11px] font-semibold uppercase tracking-widest">
        {title}
      </Text>
    </View>
  );
}

export default function DiscoverScreen({ navigation }: any) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [refreshing, setRefreshing] = useState(false);

  const agents = useDiscoverStore((s) => s.agents);
  const models = useDiscoverStore((s) => s.models);
  const providers = useDiscoverStore((s) => s.providers);
  const searchQuery = useDiscoverStore((s) => s.searchQuery);
  const setSearchQuery = useDiscoverStore((s) => s.setSearchQuery);
  const fetchAgents = useDiscoverStore((s) => s.fetchAgents);
  const fetchModels = useDiscoverStore((s) => s.fetchModels);
  const fetchProviders = useDiscoverStore((s) => s.fetchProviders);

  useEffect(() => {
    fetchAgents();
    fetchModels();
    fetchProviders();
  }, [fetchAgents, fetchModels, fetchProviders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAgents(), fetchModels(), fetchProviders()]);
    setRefreshing(false);
  }, [fetchAgents, fetchModels, fetchProviders]);

  const handleAgentPress = (identifier: string) => {
    navigation.navigate('AgentDetail', { identifier });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'agents', label: t.discoverAgents },
    { key: 'models', label: t.discoverModels },
    { key: 'providers', label: t.discoverProviders },
  ];

  const filteredAgents = searchQuery
    ? agents.filter(
        (a) =>
          a.meta.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.meta.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : agents;

  const filteredModels = searchQuery
    ? models.filter((m) => m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    : models;

  const filteredProviders = searchQuery
    ? providers.filter((p) => (p.name || p.id).toLowerCase().includes(searchQuery.toLowerCase()))
    : providers;

  const listHeader = (
    <>
      <View className="px-5 pt-2 pb-3">
        <SearchField
          placeholder={t.discoverSearchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View className="flex-row px-5 mb-4">
        {tabs.map((tab) => (
          <PressableScale
            key={tab.key}
            className={`px-4 py-2 rounded-full mr-2 ${
              activeTab === tab.key ? 'bg-primary' : 'bg-foreground/[0.04]'
            }`}
            onPress={() => {
              haptics.selection();
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveTab(tab.key);
            }}
          >
            <Text
              className={`text-[13px] font-semibold ${
                activeTab === tab.key ? 'text-white' : 'text-secondary/60'
              }`}
            >
              {tab.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t.discoverTitle} />
      {activeTab === 'agents' ? (
        <FlatList
          contentContainerStyle={{ paddingBottom: 30 }}
          data={filteredAgents}
          keyExtractor={(item) => item.identifier}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          windowSize={8}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-secondary/50 text-[14px]">{t.discoverNoResults}</Text>
            </View>
          }
          ListHeaderComponent={
            <>
              {listHeader}
              {filteredAgents.length > 0 && (
                <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                  <View className="mb-6">
                    <SectionHeader title={t.discoverFeatured} />
                    <ScrollView
                      horizontal
                      className="px-5"
                      contentContainerStyle={{ paddingRight: 20 }}
                      showsHorizontalScrollIndicator={false}
                    >
                      {filteredAgents.slice(0, 8).map((agent) => (
                        <AgentCard
                          agent={agent}
                          key={agent.identifier}
                          onPress={() => handleAgentPress(agent.identifier)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                </Animated.View>
              )}
              <Animated.View entering={FadeInDown.delay(200).duration(350)}>
                <SectionHeader title={t.discoverAll} />
              </Animated.View>
            </>
          }
          refreshControl={
            <RefreshControl
              colors={['#007aff']}
              refreshing={refreshing}
              tintColor="#007aff"
              onRefresh={onRefresh}
            />
          }
          renderItem={({ item }) => (
            <PressableScale
              className="flex-row items-center px-5 py-3"
              onPress={() => handleAgentPress(item.identifier)}
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Text className="text-lg">{item.meta.avatar || '🤖'}</Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-foreground text-[15px] font-medium tracking-tight"
                  numberOfLines={1}
                >
                  {item.meta.title}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium" numberOfLines={1}>
                  {item.meta.description}
                </Text>
              </View>
            </PressableScale>
          )}
        />
      ) : activeTab === 'models' ? (
        <FlatList
          contentContainerStyle={{ paddingBottom: 30 }}
          data={filteredModels}
          keyExtractor={(item) => `${item.providerId}-${item.id}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <ModelCard model={item} />}
          showsVerticalScrollIndicator={false}
          windowSize={8}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-secondary/50 text-[14px]">{t.discoverNoResults}</Text>
            </View>
          }
          ListHeaderComponent={
            <>
              {listHeader}
              <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                <SectionHeader title={t.discoverModels} />
              </Animated.View>
            </>
          }
          refreshControl={
            <RefreshControl
              colors={['#007aff']}
              refreshing={refreshing}
              tintColor="#007aff"
              onRefresh={onRefresh}
            />
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 30 }}
          data={filteredProviders}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <ProviderCard provider={item} />}
          showsVerticalScrollIndicator={false}
          windowSize={8}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-secondary/50 text-[14px]">{t.discoverNoResults}</Text>
            </View>
          }
          ListHeaderComponent={
            <>
              {listHeader}
              <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                <SectionHeader title={t.discoverProviders} />
              </Animated.View>
            </>
          }
          refreshControl={
            <RefreshControl
              colors={['#007aff']}
              refreshing={refreshing}
              tintColor="#007aff"
              onRefresh={onRefresh}
            />
          }
        />
      )}
    </View>
  );
}
