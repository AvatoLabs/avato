/**
 * AIProvidersScreen — Server-driven AI provider list.
 *
 * Fetches provider list from the backend via tRPC. Toggle switches call
 * server mutations so changes are immediately reflected in the model
 * selection list (ModelPickerScreen).
 *
 * Aligned with web: /settings/provider/all
 */
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { aiProviderApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useModelStore } from '../store/model';
import { useThemeStore } from '../store/theme';
import { useThemeColors } from '../theme/colors';
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
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colors = useThemeColors();
  const url = logo || getProviderIconUrl(providerId, effectiveTheme);

  if (imgError) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text
          className="text-[11px] font-semibold"
          style={{ color: colors.secondaryText }}
        >
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
  const colors = useThemeColors();
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

  // Refetch when screen gains focus (e.g. back from ProviderDetailScreen) to keep list in sync
  useFocusEffect(
    useCallback(() => {
      fetchProviders().finally(() => setLoading(false));
    }, [fetchProviders]),
  );

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

  const renderProviderItem = useCallback(
    ({ item: provider }: { item: AiProviderListItem }) => (
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
            <Text
              className="text-[11px] font-medium mt-0.5"
              style={{ color: colors.secondaryText }}
            >
              {provider.source === 'custom' ? 'Custom' : 'Built-in'}
            </Text>
          </View>
          <View
            className="w-2 h-2 rounded-full mr-1"
            style={{ backgroundColor: provider.enabled ? colors.success : colors.borderDefault }}
          />
          <ChevronRight
            color={colors.secondaryText}
            size={18}
            strokeWidth={tokens.icon.strokeWidth}
            style={{ marginLeft: 8 }}
          />
        </View>
      </PressableScale>
    ),
    [colors, navigation],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.aiProvidersTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      {/* Search */}
      <View className="px-5 py-2 bg-background z-10">
        <View className="flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5">
          <Search color={colors.muted} size={16} strokeWidth={2} />
          <TextInput
            className="flex-1 text-foreground text-[14px] ml-2.5"
            placeholder={t.search}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Summary */}
      <View className="px-5 pb-2">
        <Text
          className="text-[12px] font-medium"
          style={{ color: colors.secondaryText }}
        >
          {t.providerCountActive.replace('{count}', String(enabledCount))}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderProviderItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState iconVariant="provider" title={t.discoverNoResults} />}
          contentContainerStyle={
            filtered.length === 0
              ? { flexGrow: 1, justifyContent: 'center', paddingBottom: 40 }
              : { paddingBottom: 40 }
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={onRefresh}
            />
          }
        />
      )}
    </View>
  );
}
