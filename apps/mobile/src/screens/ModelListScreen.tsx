/**
 * ModelListScreen — Full list of available AI models.
 * Aligned with Memory/Settings subpage style: ScreenHeader + consistent content padding.
 */
import { ArrowLeft, Brain } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import ModelCard from '../components/ui/ModelCard';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useDiscoverStore } from '../store/discover';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

export default function ModelListScreen({ navigation }: any) {
  const { t } = useI18n();
  const colors = useThemeColors();

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

  // Group by provider, deduplicate by model id within each group
  const grouped = filtered.reduce<Record<string, typeof models>>((acc, m) => {
    const key = m.providerName || m.providerId;
    if (!acc[key]) acc[key] = [];
    // Skip duplicates within the same provider group
    if (!acc[key].some((existing) => existing.id === m.id)) {
      acc[key].push(m);
    }
    return acc;
  }, {});

  const sections = Object.entries(grouped);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.discoverModels}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => {
          haptics.light();
          navigation.goBack();
        }}
      />

      <Animated.View entering={FadeInDown.delay(50).duration(300)}>
        <View className="px-5 pb-3">
          <View className="bg-foreground/5 rounded-xl px-4 py-2.5">
            <TextInput
              className="text-foreground text-[15px]"
              placeholder={t.modelPickerSearch}
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>
      </Animated.View>

      {initialLoading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color="#007aff" size="small" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingBottom: 30 }}
          data={sections}
          keyExtractor={([provider]) => provider}
          ListEmptyComponent={
            <View className="items-center pt-16">
              <Brain color={colors.secondaryText} size={48} strokeWidth={1} />
              <Text className="text-secondary/50 text-[14px] mt-4">{t.discoverNoResults}</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={onRefresh}
            />
          }
          renderItem={({ item: [provider, providerModels] }) => (
            <View className="mb-4">
              <Text className="px-5 py-2 text-secondary/60 text-[12px] font-medium uppercase tracking-wider">
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
