/**
 * SkillMarketScreen — Browse and install skills from the marketplace.
 */
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, Download, Package, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { type MarketListItem, marketSkillApi, pluginApi } from '../lib/api';
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
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  const fetchInstalledPlugins = useCallback(async () => {
    try {
      const list = await pluginApi.list();
      if (Array.isArray(list)) {
        setInstalledIds(new Set(list.map((p) => p.identifier)));
      }
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
      setSkills(result?.items || []);
    } catch (e) {
      console.warn('[SkillMarket] fetch failed:', e);
      setSkills([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
    fetchInstalledPlugins();
  }, [fetchSkills, fetchInstalledPlugins]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSkills(search);
    fetchInstalledPlugins();
  }, [fetchSkills, fetchInstalledPlugins, search]);

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
        Alert.alert(t.errorUnknown || 'Error', t.skillsImportFailed || 'Failed to install skill.');
      } finally {
        setInstalling(null);
      }
    },
    [t, installedIds],
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
                <ActivityIndicator color="#007aff" size="small" />
              ) : isInstalled ? (
                <Check color="#22c55e" size={16} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <Download color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
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
        title={t.skillsMarketTitle || 'Skill Store'}
        onPressLeft={() => nav.goBack()}
      />

      {/* Search */}
      <View className="flex-row items-center mx-5 mb-3 bg-foreground/[0.03] rounded-xl px-3 py-2">
        <Search color="#9ca3af" size={16} strokeWidth={1.5} />
        <TextInput
          className="flex-1 ml-2 text-sm text-foreground"
          placeholder={t.skillsMarketSearch || 'Search skills...'}
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
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, paddingTop: 8 }}
        data={skills}
        keyExtractor={(item) => item.identifier}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-20">
              <ActivityIndicator color="#007aff" size="large" />
            </View>
          ) : (
            <View className="items-center py-16 px-8">
              <Package color="#d1d5db" size={40} strokeWidth={1.2} />
              <Text className="text-secondary/40 text-[15px] font-medium mt-4 text-center">
                {search
                  ? t.skillsMarketEmpty || 'No skills found'
                  : t.skillsMarketUnavailable ||
                    'Skill marketplace is unavailable. Check server market configuration.'}
              </Text>
              {!search && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mt-4 px-5 py-2.5 rounded-full bg-primary/10"
                  onPress={onRefresh}
                >
                  <Text className="text-primary text-[14px] font-semibold">
                    {t.retry || 'Retry'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor="#007aff" onRefresh={onRefresh} />
        }
      />
    </View>
  );
}
