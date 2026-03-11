/**
 * ModelListScreen — Full list of available AI models.
 */
import { ArrowLeft, Brain } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelCard from '../components/ui/ModelCard';
import PressableScale from '../components/ui/PressableScale';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useDiscoverStore } from '../store/discover';
import { tokens } from '../theme/tokens';

export default function ModelListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  const models = useDiscoverStore((s) => s.models);
  const fetchModels = useDiscoverStore((s) => s.fetchModels);

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetchModels().finally(() => setInitialLoading(false));
  }, [fetchModels]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchModels();
    setRefreshing(false);
  }, [fetchModels]);

  const filtered = search
    ? models.filter((m) => m.displayName.toLowerCase().includes(search.toLowerCase()))
    : models;

  // Group by provider
  const grouped = filtered.reduce<Record<string, typeof models>>((acc, m) => {
    const key = m.providerName || m.providerId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const sections = Object.entries(grouped);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <PressableScale
            className="w-9 h-9 items-center justify-center rounded-full"
            onPress={() => {
              haptics.light();
              navigation.goBack();
            }}
          >
            <ArrowLeft
              color={isDark ? '#fff' : '#111'}
              size={22}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </PressableScale>
          <Text className="text-[17px] font-semibold text-foreground">{t.discoverModels}</Text>
          <View className="w-9" />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(50).duration(300)}>
        <View className="px-4 pb-3">
          <View className="bg-foreground/5 dark:bg-white/5 rounded-xl px-4 py-2.5">
            <TextInput
              className="text-foreground text-[15px]"
              placeholder={t.modelPickerSearch}
              placeholderTextColor={isDark ? '#636366' : '#8c8c8c'}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>
      </Animated.View>

      {initialLoading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color={isDark ? '#0a84ff' : '#007aff'} size="small" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 30 }}
          data={sections}
          keyExtractor={([provider]) => provider}
          ListEmptyComponent={
            <View className="items-center pt-16">
              <Brain color={isDark ? '#555' : '#ccc'} size={48} strokeWidth={1} />
              <Text className="text-secondary/50 text-[14px] mt-4">{t.discoverNoResults}</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              colors={['#007aff']}
              refreshing={refreshing}
              tintColor={isDark ? '#0a84ff' : '#007aff'}
              onRefresh={onRefresh}
            />
          }
          renderItem={({ item: [provider, providerModels] }) => (
            <View className="mb-4">
              <Text className="px-6 py-2 text-secondary/60 text-[12px] font-semibold uppercase tracking-wider">
                {provider}
              </Text>
              {providerModels.map((model) => (
                <ModelCard key={model.id} model={model} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}
