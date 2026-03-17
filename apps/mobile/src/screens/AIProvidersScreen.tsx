/**
 * AIProvidersScreen — Server-driven AI provider list.
 *
 * Fetches provider list from the backend via tRPC. Toggle switches call
 * server mutations so changes are immediately reflected in the model
 * selection list (ModelPickerScreen).
 *
 * Aligned with web: /settings/provider/all
 */
import { ArrowLeft, ChevronRight, Search, Server } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import { aiProviderApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useModelStore } from '../store/model';
import { tokens } from '../theme/tokens';
import type { AiProviderListItem } from '../types';

function ProviderLogo({
  providerId,
  logo,
  size = 32,
}: {
  logo?: string;
  providerId: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const url = logo || getProviderIconUrl(providerId);

  if (imgError) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text className="text-foreground/60 text-[11px] font-semibold">
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <RNImage
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setImgError(true)}
    />
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function AIProvidersScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const refreshModelStore = useModelStore((s) => s.fetchModels);

  const [providers, setProviders] = useState<AiProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // ── Fetch from server ────────────────────────────────────────────
  const fetchProviders = useCallback(async () => {
    try {
      const list = await aiProviderApi.list();
      // Sort: enabled first, then by sort order
      const sorted = [...(list ?? [])].sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return (a.sort ?? 0) - (b.sort ?? 0);
      });
      setProviders(sorted);
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchProviders().finally(() => setLoading(false));
  }, [fetchProviders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchProviders();
    setRefreshing(false);
  }, [fetchProviders]);

  // ── Toggle provider enabled ──────────────────────────────────────
  const handleToggle = async (id: string, currentEnabled: boolean) => {
    haptics.selection();
    const newEnabled = !currentEnabled;

    // Optimistic update
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: newEnabled } : p)));
    setTogglingIds((prev) => new Set(prev).add(id));

    try {
      await aiProviderApi.toggleEnabled(id, newEnabled);
      void refreshModelStore(true);
    } catch {
      // Revert
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: currentEnabled } : p)),
      );
      toast.show('error', t.errorNetwork);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── Filter ────────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase();
  const filtered = q
    ? providers.filter(
        (p) => (p.name || p.id).toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
      )
    : providers;

  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.aiProvidersTitle}
        onPressLeft={() => navigation.goBack()}
      />

      {/* Search */}
      <View className="px-5 py-2 bg-background z-10">
        <View className="flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5">
          <Search color={semanticColors.muted} size={16} strokeWidth={2} />
          <TextInput
            className="flex-1 text-foreground text-[14px] ml-2.5"
            placeholder={t.search}
            placeholderTextColor={semanticColors.muted}
            returnKeyType="search"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Summary */}
      <View className="px-5 pb-2">
        <Text className="text-secondary/50 text-[12px] font-medium">
          {t.providerCountActive.replace('{count}', String(enabledCount))}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color={semanticColors.primary} size="small" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              colors={[semanticColors.primary]}
              refreshing={refreshing}
              tintColor={semanticColors.primary}
              onRefresh={onRefresh}
            />
          }
        >
          {filtered.length === 0 ? (
            <View className="items-center pt-16">
              <Server color="#ccc" size={48} strokeWidth={1} />
              <Text className="text-secondary/50 text-[14px] mt-4">{t.discoverNoResults}</Text>
            </View>
          ) : (
            filtered.map((provider, index) => (
              <Animated.View
                entering={FadeInDown.delay(index * 30).duration(200)}
                key={provider.id}
              >
                <PressableScale
                  className="mx-5 mb-2 bg-foreground/[0.02] rounded-2xl overflow-hidden"
                  onPress={() => navigation.navigate('ProviderDetail', { providerId: provider.id })}
                >
                  <View className="flex-row items-center px-4 py-3.5">
                    <ProviderLogo logo={provider.logo} providerId={provider.id} size={36} />
                    <View className="flex-1 ml-3">
                      <Text className="text-foreground font-medium text-[15px] tracking-tight">
                        {provider.name || provider.id}
                      </Text>
                      <Text className="text-secondary/50 text-[11px] font-medium mt-0.5">
                        {provider.source === 'custom' ? 'Custom' : 'Built-in'}
                      </Text>
                    </View>
                    <View
                      className="w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: provider.enabled ? '#34c759' : '#d1d5db' }}
                    />
                    <ChevronRight
                      color={semanticColors.secondaryText}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                </PressableScale>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
