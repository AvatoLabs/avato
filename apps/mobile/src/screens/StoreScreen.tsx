/**
 * StoreScreen — Unified marketplace for MCP servers, Skills, and installed tools.
 *
 * Tabs: MCP | Skills | Installed
 */
import {
  Box,
  Check,
  ChevronRight,
  Download,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import {
  agentSkillApi,
  type MarketListItem,
  marketSkillApi,
  pluginApi,
} from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import type { InstalledPlugin } from '../types';

type StoreTab = 'installed' | 'mcp' | 'skills';

// ── Item Card ─────────────────────────────────────────────────────────

const isEmojiAvatar = (avatar?: string) =>
  avatar && avatar.length <= 4 && /\p{Extended_Pictographic}/u.test(avatar);

const ItemCard = memo<{
  installed?: boolean;
  item: MarketListItem;
  onInstall: (item: MarketListItem) => void;
  onPress: (item: MarketListItem) => void;
}>(({ item, installed, onPress, onInstall }) => (
  <PressableScale
    className="bg-foreground/[0.02] rounded-2xl p-3.5 mb-2.5 mx-5"
    onPress={() => onPress(item)}
  >
    <View className="flex-row items-start">
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3 overflow-hidden"
        style={{ backgroundColor: semanticColors.fillTertiary }}
      >
        {item.avatar && !isEmojiAvatar(item.avatar) ? (
          <RNImage
            resizeMode="cover"
            source={{ uri: item.avatar }}
            style={{ borderRadius: 10, height: 40, width: 40 }}
          />
        ) : isEmojiAvatar(item.avatar) ? (
          <Text style={{ fontSize: 20 }}>{item.avatar}</Text>
        ) : (
          <Box color={semanticColors.secondaryText} size={18} strokeWidth={1.5} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View className="flex-row items-center">
          <Text className="text-foreground text-[14px] font-semibold flex-1" numberOfLines={1}>
            {item.name || item.identifier}
          </Text>
          {item._source === 'mcp' && (
            <View className="ml-2 rounded-md px-1.5 py-0.5" style={{ backgroundColor: 'rgba(0,122,255,0.08)' }}>
              <Text className="text-[9px] font-bold tracking-wide" style={{ color: '#007aff' }}>MCP</Text>
            </View>
          )}
        </View>

        {item.description ? (
          <Text className="text-secondary/45 text-[12px] mt-0.5 leading-4" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View className="flex-row items-center mt-1.5">
          {item.author ? (
            <Text className="text-secondary/30 text-[11px]">{item.author}</Text>
          ) : null}
        </View>
      </View>

      {installed ? (
        <View className="ml-2 mt-1 rounded-full w-7 h-7 items-center justify-center" style={{ backgroundColor: 'rgba(0,122,255,0.08)' }}>
          <Check color={semanticColors.primary} size={14} strokeWidth={2.5} />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.6}
          className="ml-2 mt-1 rounded-full w-7 h-7 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,122,255,0.08)' }}
          onPress={(e) => {
            e.stopPropagation();
            onInstall(item);
          }}
        >
          <Download color="#007aff" size={14} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  </PressableScale>
));
ItemCard.displayName = 'ItemCard';

// ── Installed Item Row ────────────────────────────────────────────────

const InstalledRow = memo<{
  item: InstalledPlugin;
  onPress: () => void;
}>(({ item, onPress }) => (
  <PressableScale
    className="flex-row items-center px-5 py-3 bg-background"
    onPress={onPress}
  >
    <View
      className="w-9 h-9 rounded-xl items-center justify-center mr-3 overflow-hidden"
      style={{ backgroundColor: semanticColors.fillTertiary }}
    >
      {item.avatar && !isEmojiAvatar(item.avatar) ? (
        <RNImage
          resizeMode="cover"
          source={{ uri: item.avatar }}
          style={{ borderRadius: 8, height: 36, width: 36 }}
        />
      ) : isEmojiAvatar(item.avatar) ? (
        <Text style={{ fontSize: 18 }}>{item.avatar}</Text>
      ) : (
        <Box color={semanticColors.secondaryText} size={16} strokeWidth={1.5} />
      )}
    </View>

    <View style={{ flex: 1, minWidth: 0 }}>
      <View className="flex-row items-center">
        <Text className="text-foreground text-[14px] font-semibold" numberOfLines={1}>
          {item.name || item.identifier}
        </Text>
        {item.type === 'customPlugin' && (
          <View className="ml-1.5 rounded-md px-1.5 py-0.5" style={{ backgroundColor: semanticColors.fillTertiary }}>
            <Text className="text-[9px] font-bold text-secondary/40 tracking-wide">CUSTOM</Text>
          </View>
        )}
      </View>
      {item.description ? (
        <Text className="text-secondary/40 text-[11px] mt-0.5" numberOfLines={1}>
          {item.description}
        </Text>
      ) : null}
    </View>

    <ChevronRight color={semanticColors.secondaryText} size={16} strokeWidth={1.5} />
  </PressableScale>
));
InstalledRow.displayName = 'InstalledRow';

// ── Main Screen ───────────────────────────────────────────────────────

export default function StoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<StoreTab>('mcp');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Market data
  const [marketItems, setMarketItems] = useState<MarketListItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketPage, setMarketPage] = useState(1);
  const [marketHasMore, setMarketHasMore] = useState(true);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);

  // Installed data
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [installedSkills, setInstalledSkills] = useState<any[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  const installedIds = useMemo(
    () => new Set([
      ...installedPlugins.map((p) => p.identifier),
      ...installedSkills.map((s) => s.identifier),
    ]),
    [installedPlugins, installedSkills],
  );

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const fetchMarket = useCallback(async (
    source: 'mcp' | 'skill',
    page = 1,
    append = false,
  ) => {
    if (append) {
      setMarketLoadingMore(true);
    } else {
      setMarketLoading(true);
    }

    try {
      const result = source === 'mcp'
        ? await marketSkillApi.getMcpList({
            page,
            pageSize: 40,
            q: debouncedQuery || undefined,
          })
        : await marketSkillApi.getSkillList({
            page,
            pageSize: 40,
            q: debouncedQuery || undefined,
          });

      const nextItems = result.items || [];
      setMarketItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setMarketPage(page);
      setMarketHasMore(nextItems.length >= 40);
    } catch {
      if (!append) {
        setMarketItems([]);
      }
      toast.show('error', t.errorNetwork);
    } finally {
      setMarketLoading(false);
      setMarketLoadingMore(false);
    }
  }, [debouncedQuery, t.errorNetwork, toast]);

  const fetchInstalled = useCallback(async () => {
    setInstalledLoading(true);
    try {
      const [plugins, skills] = await Promise.all([
        pluginApi.list().catch(() => []),
        agentSkillApi.list().catch(() => []),
      ]);
      setInstalledPlugins(Array.isArray(plugins) ? plugins : []);
      setInstalledSkills(Array.isArray(skills) ? skills : []);
    } catch { /* ignore */ } finally {
      setInstalledLoading(false);
    }
  }, []);

  const refreshMarket = useCallback(async () => {
    if (activeTab === 'installed') return;
    const source: 'mcp' | 'skill' = activeTab === 'mcp' ? 'mcp' : 'skill';
    await fetchMarket(source, 1, false);
  }, [activeTab, fetchMarket]);

  const loadMoreMarket = useCallback(async () => {
    if (activeTab === 'installed' || marketLoading || marketLoadingMore || !marketHasMore) return;
    const source: 'mcp' | 'skill' = activeTab === 'mcp' ? 'mcp' : 'skill';
    await fetchMarket(source, marketPage + 1, true);
  }, [activeTab, fetchMarket, marketHasMore, marketLoading, marketLoadingMore, marketPage]);

  useEffect(() => {
    if (activeTab === 'installed') {
      fetchInstalled();
    } else {
      const source: 'mcp' | 'skill' = activeTab === 'mcp' ? 'mcp' : 'skill';
      fetchMarket(source, 1, false);
    }
  }, [activeTab, debouncedQuery, fetchInstalled, fetchMarket]);

  const handleInstall = useCallback(async (item: MarketListItem) => {
    haptics.light();
    try {
      if (item._source === 'mcp' || item.manifestUrl) {
        await pluginApi.createOrInstall({
          identifier: item.identifier,
          manifestUrl: item.manifestUrl,
          type: 'plugin',
        });
      } else {
        await agentSkillApi.importFromUrl(item.manifestUrl || `https://registry.npmmirror.com/@lobehub/chat-plugin-${item.identifier}/latest/files/manifest.json`);
      }
      haptics.success();
      toast.show('success', t.skillsImportSuccess);
      fetchInstalled();
    } catch {
      toast.show('error', t.skillsImportFailed);
    }
  }, [t, toast, fetchInstalled]);

  const handleItemPress = useCallback((item: MarketListItem) => {
    haptics.light();
    navigation.navigate('SkillDetail', {
      skillId: item.identifier,
      skillName: item.name || item.identifier,
      skillType: item._source === 'mcp' ? 'plugin' : 'skill',
    });
  }, [navigation]);

  const handleInstalledPress = useCallback((item: InstalledPlugin) => {
    haptics.light();
    navigation.navigate('SkillDetail', {
      skillId: item.identifier,
      skillName: item.name || item.identifier,
      skillType: item.type === 'customPlugin' ? 'plugin' : 'plugin',
    });
  }, [navigation]);

  const tabs: { key: StoreTab; label: string }[] = [
    { key: 'mcp', label: t.storeMcp },
    { key: 'skills', label: t.storeSkills },
    { key: 'installed', label: t.storeInstalled },
  ];

  const isMarketTab = activeTab !== 'installed';
  const loading = isMarketTab ? marketLoading : installedLoading;
  const isEmpty = isMarketTab ? marketItems.length === 0 : (installedPlugins.length + installedSkills.length) === 0;

  const renderMarketItem = useCallback(({ item, index }: { item: MarketListItem; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(350)} key={`${item._source}-${item.identifier}`}>
      <ItemCard
        installed={installedIds.has(item.identifier)}
        item={item}
        onInstall={handleInstall}
        onPress={handleItemPress}
      />
    </Animated.View>
  ), [installedIds, handleInstall, handleItemPress]);

  const allInstalled = useMemo(() => {
    const plugins: InstalledPlugin[] = installedPlugins.map((p) => ({ ...p }));
    return plugins;
  }, [installedPlugins]);

  const filteredInstalled = useMemo(() => {
    if (!debouncedQuery) return allInstalled;
    const q = debouncedQuery.toLowerCase();
    return allInstalled.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.identifier.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q),
    );
  }, [allInstalled, debouncedQuery]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <ScreenHeader
        title={t.tabStore}
        rightElement={<Plus color={semanticColors.muted} size={20} strokeWidth={2} />}
        onPressRight={() => setShowCreateMenu(true)}
      >
        {/* Search */}
        <View className="mx-5 mb-2 flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5">
          <Search color={semanticColors.muted} size={16} strokeWidth={2} />
          <TextInput
            className="flex-1 text-foreground text-[14px] ml-2.5"
            placeholder={t.storeSearch}
            placeholderTextColor={semanticColors.muted}
            returnKeyType="search"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity hitSlop={8} onPress={() => setSearchQuery('')}>
              <X color={semanticColors.muted} size={16} strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          className="mx-4 mb-2"
          contentContainerStyle={{ gap: 4 }}
          showsHorizontalScrollIndicator={false}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                className="rounded-full px-4 py-1.5"
                key={tab.key}
                style={{
                  backgroundColor: active ? semanticColors.primary : semanticColors.fillTertiary,
                }}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(tab.key);
                }}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: active ? '#fff' : semanticColors.muted }}
                >
                  {tab.label}
                  {tab.key === 'installed' && (installedPlugins.length + installedSkills.length) > 0
                    ? ` ${installedPlugins.length + installedSkills.length}`
                    : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScreenHeader>

      {/* Content */}
      {loading && isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={semanticColors.muted} size="large" />
        </View>
      ) : isEmpty && !loading ? (
        <Animated.View
          className="flex-1 items-center justify-center px-8"
          entering={FadeInDown.duration(350)}
        >
          <View
            className="items-center justify-center rounded-3xl bg-foreground/5 mb-5"
            style={{ width: 80, height: 80 }}
          >
            <Package color={semanticColors.secondaryText} size={36} strokeWidth={1.3} />
          </View>
          <Text className="text-foreground text-[17px] font-semibold text-center">
            {t.storeEmpty}
          </Text>
        </Animated.View>
      ) : isMarketTab ? (
        <FlatList
          data={marketItems}
          keyExtractor={(item) => item.identifier}
          refreshControl={
            <RefreshControl
              refreshing={marketLoading}
              tintColor={semanticColors.primary}
              onRefresh={refreshMarket}
            />
          }
          renderItem={renderMarketItem}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 80 }}
          ListFooterComponent={
            marketLoadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator color={semanticColors.primary} size="small" />
              </View>
            ) : null
          }
          onEndReached={loadMoreMarket}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredInstalled}
          keyExtractor={(item) => item.identifier}
          refreshControl={
            <RefreshControl
              refreshing={installedLoading}
              tintColor={semanticColors.primary}
              onRefresh={fetchInstalled}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 30).duration(350)}>
              <InstalledRow item={item} onPress={() => handleInstalledPress(item)} />
              {index < filteredInstalled.length - 1 && (
                <View className="mx-5 h-px bg-foreground/[0.04]" />
              )}
            </Animated.View>
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        transparent
        animationType="fade"
        visible={showCreateMenu}
        onRequestClose={() => setShowCreateMenu(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/30" onPress={() => setShowCreateMenu(false)}>
          <Pressable
            className="bg-background rounded-t-3xl px-5 pt-4 pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-foreground text-[16px] font-semibold mb-3">{t.skillsCustom}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-2xl bg-foreground/[0.03] px-4 py-3.5 mb-2"
              onPress={() => {
                setShowCreateMenu(false);
                navigation.navigate('SkillSettings');
              }}
            >
              <Text className="text-foreground text-[14px] font-medium">{t.skillsImportUrl}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-2xl bg-foreground/[0.03] px-4 py-3.5"
              onPress={() => {
                setShowCreateMenu(false);
                navigation.navigate('SkillSettings');
              }}
            >
              <Text className="text-foreground text-[14px] font-medium">{t.skillsAddCustomMcp}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
