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
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { SelectionListItem } from '../components/ui/SelectionList';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { aiProviderApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
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
        <Text className="text-[11px] font-semibold" style={{ color: colors.secondaryText }}>
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

  const [providers, setProviders] = useState<AiProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      <SelectionListItem
        className="mx-5 mb-2"
        leading={<ProviderLogo logo={provider.logo} providerId={provider.id} size={36} />}
        subtitle={provider.source === 'custom' ? t.storeCustom : t.storeBuiltIn}
        title={provider.name || provider.id}
        rightAccessory={
          <View className="flex-row items-center">
            <View
              className="mr-2 h-2 w-2 rounded-full"
              style={{ backgroundColor: provider.enabled ? colors.success : colors.borderDefault }}
            />
            <ChevronRight
              color={colors.secondaryText}
              size={18}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </View>
        }
        onPress={() => navigation.navigate('ProviderDetail', { providerId: provider.id })}
      />
    ),
    [colors, navigation, t.storeBuiltIn, t.storeCustom],
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
        <SearchField placeholder={t.search} value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      {/* Summary */}
      <View className="px-5 pb-2">
        <Text className="text-[12px] font-medium" style={{ color: colors.secondaryText }}>
          {t.providerCountActive.replace('{count}', String(enabledCount))}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center pt-20">
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : (
        <FlatList
          ListEmptyComponent={<EmptyState iconVariant="provider" title={t.discoverNoResults} />}
          className="flex-1"
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderProviderItem}
          showsVerticalScrollIndicator={false}
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
