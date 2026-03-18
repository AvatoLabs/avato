/**
 * ProviderListScreen — Full list of AI providers.
 */
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/ui/EmptyState';
import PressableScale from '../components/ui/PressableScale';
import ProviderCard from '../components/ui/ProviderCard';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useDiscoverStore } from '../store/discover';
import { tokens } from '../theme/tokens';

export default function ProviderListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const providers = useDiscoverStore((s) => s.providers);
  const fetchProviders = useDiscoverStore((s) => s.fetchProviders);

  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetchProviders().finally(() => setInitialLoading(false));
  }, [fetchProviders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchProviders();
    setRefreshing(false);
  }, [fetchProviders]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <View className="flex-row items-center justify-between px-5 py-3">
          <PressableScale
            className="w-9 h-9 items-center justify-center rounded-full"
            onPress={() => {
              haptics.light();
              navigation.goBack();
            }}
          >
            <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
          </PressableScale>
          <Text className="text-[17px] font-semibold text-foreground">{t.discoverProviders}</Text>
          <View className="w-9" />
        </View>
      </Animated.View>

      {initialLoading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color="#007aff" size="small" />
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProviderCard provider={item} />}
          ListEmptyComponent={<EmptyState iconVariant="provider" title={t.discoverNoResults} />}
          contentContainerStyle={
            providers.length === 0
              ? { flexGrow: 1, justifyContent: 'center', paddingTop: 8, paddingBottom: 30 }
              : { paddingTop: 8, paddingBottom: 30 }
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
