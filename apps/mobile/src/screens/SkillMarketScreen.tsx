/**
 * SkillMarketScreen — Browse and install skills from the marketplace.
 */
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, Download, Package, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  Linking,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { semanticColors } from '../constants/colors';
import { MOBILE_LOBEHUB_SKILL_PROVIDERS } from '../constants/lobehubSkills';
import {
  agentSkillApi,
  lobehubSkillApi,
  type MarketListItem,
  marketSkillApi,
  pluginApi,
} from '../lib/api';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

function isEmojiAvatar(avatar?: string): boolean {
  if (!avatar) return false;
  if (avatar.startsWith('http')) return false;
  return avatar.length <= 4;
}

function PluginAvatar({ avatar, name }: { avatar?: string; name: string }) {
  const [imgError, setImgError] = useState(false);

  if (avatar && avatar.startsWith('http') && !imgError) {
    return (
      <RNImage
        source={{ uri: avatar }}
        style={{ width: 36, height: 36, borderRadius: 10 }}
        onError={() => setImgError(true)}
      />
    );
  }

  if (isEmojiAvatar(avatar)) {
    return (
      <View className="w-9 h-9 rounded-[10px] bg-foreground/5 items-center justify-center">
        <Text style={{ fontSize: 18 }}>{avatar}</Text>
      </View>
    );
  }

  return (
    <View className="w-9 h-9 rounded-[10px] bg-primary/10 items-center justify-center">
      <Text className="text-primary text-[14px] font-bold">{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function SkillMarketScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const [skills, setSkills] = useState<MarketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(() => new Set());
  const [connectingProviderId, setConnectingProviderId] = useState<string | null>(null);
  const [connectedProviderIds, setConnectedProviderIds] = useState<Set<string>>(() => new Set());

  const featuredProviderIds = useMemo(
    () => new Set(MOBILE_LOBEHUB_SKILL_PROVIDERS.map((provider) => provider.id)),
    [],
  );

  const fetchFeaturedProviderStatus = useCallback(async () => {
    try {
      const connections = await lobehubSkillApi.getConnections();
      setConnectedProviderIds(new Set(connections.map((item) => item.providerId)));
    } catch {
      setConnectedProviderIds(new Set());
    }
  }, []);

  const fetchInstalledSkills = useCallback(async () => {
    try {
      const [plugins, agentSkills] = await Promise.all([pluginApi.list(), agentSkillApi.list()]);
      const nextInstalled = new Set<string>();

      if (Array.isArray(plugins)) {
        for (const plugin of plugins) {
          nextInstalled.add(plugin.identifier);
        }
      }

      if (Array.isArray(agentSkills)) {
        for (const skill of agentSkills) {
          if (skill.identifier) nextInstalled.add(skill.identifier);
        }
      }

      setInstalledIds(nextInstalled);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchSkills = useCallback(async (q?: string) => {
    try {
      const result = await marketSkillApi.getList({
        page: 1,
        pageSize: 50,
        q: q || undefined,
      });
      const merged = (result?.items || []).filter((item, index, all) => {
        if (featuredProviderIds.has(item.identifier)) return false;

        return all.findIndex((candidate) => candidate.identifier === item.identifier) === index;
      });

      setSkills(merged);
    } catch (e) {
      console.warn('[SkillMarket] fetch failed:', e);
      setSkills([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [featuredProviderIds]);

  useEffect(() => {
    fetchSkills();
    fetchInstalledSkills();
    fetchFeaturedProviderStatus();
  }, [fetchFeaturedProviderStatus, fetchSkills, fetchInstalledSkills]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSkills(search);
    fetchInstalledSkills();
    fetchFeaturedProviderStatus();
  }, [fetchFeaturedProviderStatus, fetchSkills, fetchInstalledSkills, search]);

  const handleSearch = useCallback(() => {
    setLoading(true);
    fetchSkills(search);
  }, [fetchSkills, search]);

  const handleInstall = useCallback(
    async (item: MarketListItem) => {
      if (installedIds.has(item.identifier)) return;
      setInstalling(item.identifier);
      try {
        await marketSkillApi.install(item);
        setInstalledIds((prev) => new Set(prev).add(item.identifier));
      } catch {
        Alert.alert(t.errorUnknown, t.skillsImportFailed);
      } finally {
        setInstalling(null);
      }
    },
    [t, installedIds],
  );

  const handleConnectFeaturedProvider = useCallback(
    async (providerId: string) => {
      if (connectedProviderIds.has(providerId)) return;

      setConnectingProviderId(providerId);
      try {
        const { authorizeUrl } = await lobehubSkillApi.getAuthorizeUrl(providerId);
        await Linking.openURL(authorizeUrl);
      } catch {
        Alert.alert(t.errorUnknown, t.errorNetwork);
      } finally {
        setConnectingProviderId(null);
      }
    },
    [connectedProviderIds, t],
  );

  const renderFeaturedProviders = useCallback(
    () => (
      <View className="mb-5">
        <Text className="mb-3 text-[13px] font-semibold text-foreground/55">
          {t.skillsMarketFeatured}
        </Text>
        <View className="gap-3">
          {MOBILE_LOBEHUB_SKILL_PROVIDERS.map((provider) => {
            const connected = connectedProviderIds.has(provider.id);
            const connecting = connectingProviderId === provider.id;

            return (
              <View
                className="flex-row items-center rounded-2xl border border-black/5 px-4 py-3"
                key={provider.id}
                style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
              >
                <View className="mr-3">
                  <PluginAvatar avatar={provider.icon} name={provider.label} />
                </View>
                <View className="flex-1 mr-3">
                  <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                    {provider.label}
                  </Text>
                  <Text className="mt-1 text-[12px] leading-5 text-secondary/60" numberOfLines={2}>
                    {provider.description}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.75}
                  className={`rounded-full px-4 py-2 ${connected ? 'bg-green-500/10' : 'bg-primary/10'}`}
                  disabled={connected || connecting}
                  onPress={() => handleConnectFeaturedProvider(provider.id)}
                >
                  {connecting ? (
                    <ActivityIndicator color={semanticColors.primary} size="small" />
                  ) : (
                    <Text
                      className={`text-[12px] font-semibold ${connected ? 'text-green-600' : 'text-primary'}`}
                    >
                      {connected ? t.skillsMarketConnected : t.skillsMarketConnect}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    ),
    [connectedProviderIds, connectingProviderId, handleConnectFeaturedProvider, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: MarketListItem }) => {
      const title = item.name || item.identifier;
      const desc = item.description || '';
      const isInstalling = installing === item.identifier;
      const isInstalled = installedIds.has(item.identifier);

      return (
        <View className="bg-foreground/[0.02] rounded-2xl p-4 mb-3">
          <View className="flex-row items-start">
            <View className="mr-3 mt-0.5">
              <PluginAvatar avatar={item.avatar} name={title} />
            </View>
            <View className="flex-1 mr-3">
              <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
                {title}
              </Text>
              {desc ? (
                <Text className="text-secondary/60 text-[13px] mt-1 leading-5" numberOfLines={2}>
                  {desc}
                </Text>
              ) : null}
              {item.author && (
                <Text className="text-secondary/40 text-[11px] mt-1">by {item.author}</Text>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isInstalling || isInstalled}
              className={`w-9 h-9 rounded-full items-center justify-center ${
                isInstalled ? 'bg-green-500/10' : 'bg-primary/10'
              }`}
              onPress={() => handleInstall(item)}
            >
              {isInstalling ? (
                <ActivityIndicator color={semanticColors.primary} size="small" />
              ) : isInstalled ? (
                <Check color="#22c55e" size={16} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <Download
                  color={semanticColors.primary}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [installing, installedIds, handleInstall],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ChevronLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.skillsMarketTitle}
        onPressLeft={() => nav.goBack()}
      />

      {/* Search */}
      <View className="flex-row items-center mx-5 mb-3 bg-foreground/[0.03] rounded-xl px-3 py-2">
        <Search color="#9ca3af" size={16} strokeWidth={1.5} />
        <TextInput
          className="flex-1 ml-2 text-sm text-foreground"
          placeholder={t.skillsMarketSearch}
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
        />
        {search ? (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              fetchSkills();
            }}
          >
            <X color="#9ca3af" size={16} strokeWidth={1.5} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        ListHeaderComponent={renderFeaturedProviders}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, paddingTop: 8 }}
        data={skills}
        keyExtractor={(item) => item.identifier}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-20">
              <ActivityIndicator color={semanticColors.primary} size="large" />
            </View>
          ) : (
            <View className="items-center py-16 px-8">
              <Package color="#d1d5db" size={40} strokeWidth={1.2} />
              <Text className="text-secondary/40 text-[15px] font-medium mt-4 text-center">
                {search ? t.skillsMarketEmpty : t.skillsMarketUnavailable}
              </Text>
              {!search && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mt-4 px-5 py-2.5 rounded-full bg-primary/10"
                  onPress={onRefresh}
                >
                  <Text className="text-primary text-[14px] font-semibold">{t.retry}</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={semanticColors.primary}
            onRefresh={onRefresh}
          />
        }
      />
    </View>
  );
}
