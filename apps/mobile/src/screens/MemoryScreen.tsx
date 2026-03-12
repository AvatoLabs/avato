/**
 * MemoryScreen — Main memory management screen.
 *
 * Aligns 1:1 with web /memory/* pages:
 *   Home tab   → Persona + Role tag cloud
 *   Identity   → Identity list
 *   Context    → Context list
 *   Activity   → Activity list
 *   Experience → Experience list
 *   Preference → Preference list
 */
import { useNavigation } from '@react-navigation/native';
import {
  Brain,
  BrainCircuit,
  Calendar,
  ChevronLeft,
  Lightbulb,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memoryApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type {
  MemoryActivityItem,
  MemoryContextItem,
  MemoryExperienceItem,
  MemoryIdentityItem,
  MemoryLayer,
  MemoryPersona,
  MemoryPreferenceItem,
} from '../types';

// ── Tab Definitions ──────────────────────────────────────────────────
const TAB_DEFS: { icon: typeof Brain; key: MemoryLayer | 'home'; labelKey: string }[] = [
  { icon: Sparkles, key: 'home', labelKey: 'memoryHome' },
  { icon: User, key: 'identity', labelKey: 'memoryIdentity' },
  { icon: Settings2, key: 'context', labelKey: 'memoryContext' },
  { icon: Calendar, key: 'activity', labelKey: 'memoryActivity' },
  { icon: Lightbulb, key: 'experience', labelKey: 'memoryExperience' },
  { icon: BrainCircuit, key: 'preference', labelKey: 'memoryPreference' },
];

// ── Layer colors ──────────────────────────────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  activity: '#f59e0b',
  context: '#8b5cf6',
  experience: '#10b981',
  identity: '#3b82f6',
  preference: '#ec4899',
};

type AnyMemoryItem =
  | MemoryActivityItem
  | MemoryContextItem
  | MemoryExperienceItem
  | MemoryIdentityItem
  | MemoryPreferenceItem;

// ── Helper: get display text for a memory item ──────────────────────
function getItemTitle(item: AnyMemoryItem, layer: MemoryLayer): string {
  switch (layer) {
    case 'identity': {
      return (
        (item as MemoryIdentityItem).title || (item as MemoryIdentityItem).summary || 'Identity'
      );
    }
    case 'context': {
      return (
        (item as MemoryContextItem).title || (item as MemoryContextItem).description || 'Context'
      );
    }
    case 'activity': {
      return (
        (item as MemoryActivityItem).narrative || (item as MemoryActivityItem).notes || 'Activity'
      );
    }
    case 'experience': {
      return (
        (item as MemoryExperienceItem).situation ||
        (item as MemoryExperienceItem).keyLearning ||
        'Experience'
      );
    }
    case 'preference': {
      return (
        (item as MemoryPreferenceItem).conclusionDirectives ||
        (item as MemoryPreferenceItem).suggestions ||
        'Preference'
      );
    }
  }
}

function getItemSubtext(item: AnyMemoryItem, layer: MemoryLayer): string {
  switch (layer) {
    case 'identity': {
      return (item as MemoryIdentityItem).summary || '';
    }
    case 'context': {
      return (item as MemoryContextItem).description || '';
    }
    case 'activity': {
      return (item as MemoryActivityItem).feedback || (item as MemoryActivityItem).notes || '';
    }
    case 'experience': {
      return (
        (item as MemoryExperienceItem).keyLearning || (item as MemoryExperienceItem).action || ''
      );
    }
    case 'preference': {
      return (item as MemoryPreferenceItem).suggestions || '';
    }
  }
}

function getItemDate(item: AnyMemoryItem): string | undefined {
  return (item as any).capturedAt || (item as any).createdAt || (item as any).updatedAt;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Home Tab Component ──────────────────────────────────────────────
function HomeTab() {
  const { t } = useI18n();
  const [persona, setPersona] = useState<MemoryPersona | null>(null);
  const [roles, setRoles] = useState<Array<{ count: number; role: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        memoryApi.getPersona().catch(() => null),
        memoryApi
          .queryIdentityRoles({ page: 0, pageSize: 50 })
          .catch(() => ({ items: [], total: 0 })),
      ]);
      setPersona(p);
      setRoles((r as any)?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20, paddingTop: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Role Tag Cloud */}
      {roles.length > 0 && (
        <View className="mb-6">
          <Text className="text-base font-semibold text-gray-800 mb-3">{t.memoryRoles}</Text>
          <View className="flex-row flex-wrap gap-2">
            {roles.map((r, i) => (
              <View
                className="px-3 py-1.5 rounded-full"
                key={`${r.role}-${i}`}
                style={{ backgroundColor: `${LAYER_COLORS.identity}18` }}
              >
                <Text className="text-sm font-medium" style={{ color: LAYER_COLORS.identity }}>
                  {r.role}
                  {r.count > 1 ? ` (${r.count})` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Persona Card */}
      <View className="mb-6">
        <Text className="text-base font-semibold text-gray-800 mb-3">{t.memoryPersona}</Text>
        {persona?.content || persona?.summary ? (
          <View
            className="bg-white rounded-2xl p-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {persona.summary ? (
              <Text className="text-sm text-gray-700 leading-5 mb-2">{persona.summary}</Text>
            ) : null}
            {persona.content ? (
              <Text className="text-sm text-gray-500 leading-5">{persona.content}</Text>
            ) : null}
          </View>
        ) : (
          <View className="bg-gray-50 rounded-2xl p-6 items-center">
            <Brain color="#9ca3af" size={32} strokeWidth={1.5} />
            <Text className="text-sm text-gray-400 mt-3 text-center">{t.memoryPersonaEmpty}</Text>
          </View>
        )}
      </View>

      {/* Extract Memories card */}
      <View className="mb-6">
        <View
          className="bg-white rounded-2xl p-4"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text className="text-base font-semibold text-gray-800 mb-2">{t.memoryExtractTitle}</Text>
          <Text className="text-sm text-gray-500 leading-5">{t.memoryExtractDesc}</Text>
        </View>
      </View>

      {/* Empty state if nothing at all */}
      {!persona?.content && !persona?.summary && roles.length === 0 && (
        <View className="items-center py-10">
          <Brain color="#d1d5db" size={48} strokeWidth={1.2} />
          <Text className="text-base font-medium text-gray-400 mt-4">{t.memoryEmpty}</Text>
          <Text className="text-sm text-gray-300 mt-1 text-center px-8">{t.memoryEmptyDesc}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Memory List Tab Component ────────────────────────────────────────
function MemoryListTab({ layer }: { layer: MemoryLayer }) {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const [items, setItems] = useState<AnyMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSummary, setCreateSummary] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      let data: AnyMemoryItem[];
      switch (layer) {
        case 'identity': {
          data = await memoryApi.getIdentities().catch(() => []);
          break;
        }
        case 'context': {
          data = await memoryApi.getContexts().catch(() => []);
          break;
        }
        case 'activity': {
          data = await memoryApi.getActivities().catch(() => []);
          break;
        }
        case 'experience': {
          data = await memoryApi.getExperiences().catch(() => []);
          break;
        }
        case 'preference': {
          data = await memoryApi.getPreferences().catch(() => []);
          break;
        }
      }
      setItems(data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [layer]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchItems();
  }, [fetchItems]);

  const handleCreateSubmit = useCallback(async () => {
    const title = createTitle.trim();
    if (!title) return;
    setCreateSubmitting(true);
    try {
      await memoryApi.createIdentity({ title, summary: createSummary.trim() || undefined });
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateSummary('');
      fetchItems();
    } catch {
      /* ignore */
    } finally {
      setCreateSubmitting(false);
    }
  }, [createTitle, createSummary, fetchItems]);

  const handleDelete = useCallback(
    (item: AnyMemoryItem) => {
      Alert.alert(t.memoryDeleteConfirm, t.memoryDeleteDesc, [
        { style: 'cancel', text: t.cancel },
        {
          style: 'destructive',
          text: t.delete,
          onPress: async () => {
            try {
              switch (layer) {
                case 'identity': {
                  await memoryApi.deleteIdentity(item.id);
                  break;
                }
                case 'context': {
                  await memoryApi.deleteContext(item.id);
                  break;
                }
                case 'activity': {
                  await memoryApi.deleteActivity(item.id);
                  break;
                }
                case 'experience': {
                  await memoryApi.deleteExperience(item.id);
                  break;
                }
                case 'preference': {
                  await memoryApi.deletePreference(item.id);
                  break;
                }
              }
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch {
              /* ignore */
            }
          },
        },
      ]);
    },
    [layer, t],
  );

  // Filtered items
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const title = getItemTitle(item, layer).toLowerCase();
      const sub = getItemSubtext(item, layer).toLowerCase();
      const tags = ((item as any).tags || []).join(' ').toLowerCase();
      return title.includes(q) || sub.includes(q) || tags.includes(q);
    });
  }, [items, searchQuery, layer]);

  const layerColor = LAYER_COLORS[layer] || '#6b7280';

  const renderItem = useCallback(
    ({ item }: { item: AnyMemoryItem }) => {
      const title = getItemTitle(item, layer);
      const subtext = getItemSubtext(item, layer);
      const date = formatDate(getItemDate(item));
      const type = (item as any).type;
      const tags: string[] = (item as any).tags || [];

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-white rounded-2xl p-4 mb-3"
          style={{
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
          }}
          onLongPress={() => handleDelete(item)}
          onPress={() => nav.navigate('MemoryDetail', { item, layer })}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-[15px] font-semibold text-gray-800 leading-5" numberOfLines={2}>
                {title}
              </Text>
              {subtext && title !== subtext ? (
                <Text className="text-sm text-gray-500 mt-1 leading-5" numberOfLines={2}>
                  {subtext}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              onPress={() => handleDelete(item)}
            >
              <Trash2 color="#d1d5db" size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Meta row: type badge + tags + date */}
          <View className="flex-row items-center mt-2.5 flex-wrap gap-1.5">
            {type ? (
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${layerColor}15` }}
              >
                <Text className="text-xs font-medium" style={{ color: layerColor }}>
                  {type}
                </Text>
              </View>
            ) : null}
            {tags.slice(0, 3).map((tag, i) => (
              <View className="px-2 py-0.5 rounded-full bg-gray-100" key={`${tag}-${i}`}>
                <Text className="text-xs text-gray-500">{tag}</Text>
              </View>
            ))}
            {date ? <Text className="text-xs text-gray-300 ml-auto">{date}</Text> : null}
          </View>
        </TouchableOpacity>
      );
    },
    [layer, handleDelete, layerColor, nav],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator color={layerColor} size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Search toggle + count + Create Identity (when identity tab) */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <Text className="text-sm text-gray-400">
          {t.memoryTotalCount.replace('{count}', String(filtered.length))}
        </Text>
        <View className="flex-row items-center gap-3">
          {layer === 'identity' ? (
            <TouchableOpacity onPress={() => setShowCreateModal(true)}>
              <Plus color={layerColor} size={20} strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setShowSearch((prev) => !prev)}>
            <Search color="#9ca3af" size={18} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Identity Modal */}
      {layer === 'identity' ? (
        <Modal
          transparent
          animationType="fade"
          visible={showCreateModal}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1 justify-center bg-black/40 px-5"
            onPress={() => setShowCreateModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-white rounded-2xl p-5"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-semibold text-gray-900">
                  {t.memoryCreateIdentity}
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  onPress={() => setShowCreateModal(false)}
                >
                  <X color="#9ca3af" size={20} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">{t.memoryCreateTitle}</Text>
              <TextInput
                className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-800"
                placeholder={t.memoryCreateTitlePlaceholder}
                placeholderTextColor="#9ca3af"
                value={createTitle}
                onChangeText={setCreateTitle}
              />
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t.memoryCreateSummary}
              </Text>
              <TextInput
                multiline
                className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-800"
                numberOfLines={3}
                placeholder={t.memoryCreateSummaryPlaceholder}
                placeholderTextColor="#9ca3af"
                value={createSummary}
                onChangeText={setCreateSummary}
              />
              <TouchableOpacity
                className="rounded-xl py-3 items-center"
                disabled={!createTitle.trim() || createSubmitting}
                style={{
                  backgroundColor: createTitle.trim() && !createSubmitting ? layerColor : '#d1d5db',
                }}
                onPress={handleCreateSubmit}
              >
                <Text className="text-base font-semibold text-white">{t.memoryCreateSave}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}

      {/* Search bar */}
      {showSearch && (
        <View className="flex-row items-center mx-5 mb-2 bg-gray-100 rounded-xl px-3 py-2">
          <Search color="#9ca3af" size={16} strokeWidth={1.5} />
          <TextInput
            autoFocus
            className="flex-1 ml-2 text-sm text-gray-700"
            placeholder={t.memorySearch}
            placeholderTextColor="#d1d5db"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color="#9ca3af" size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* List */}
      <FlatList
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20, paddingTop: 8 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Brain color="#d1d5db" size={40} strokeWidth={1.2} />
            <Text className="text-base font-medium text-gray-400 mt-4">{t.memoryEmpty}</Text>
            <Text className="text-sm text-gray-300 mt-1 text-center">{t.memoryEmptyDesc}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={layerColor} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function MemoryScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MemoryLayer | 'home'>('home');
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity className="mr-3" onPress={() => nav.goBack()}>
          <ChevronLeft color="#111" size={24} strokeWidth={1.8} />
        </TouchableOpacity>
        <Brain color="#3b82f6" size={22} strokeWidth={1.8} />
        <Text className="text-lg font-bold text-gray-900 ml-2">{t.memoryTitle}</Text>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        className="max-h-[44px]"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
      >
        {TAB_DEFS.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          const color = tab.key === 'home' ? '#3b82f6' : LAYER_COLORS[tab.key] || '#6b7280';
          return (
            <TouchableOpacity
              className="flex-row items-center px-3 py-1.5 rounded-full"
              key={tab.key}
              style={{
                backgroundColor: active ? `${color}15` : 'transparent',
                borderColor: active ? color : 'transparent',
                borderWidth: active ? 1 : 0,
              }}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Icon color={active ? color : '#9ca3af'} size={15} strokeWidth={active ? 2 : 1.5} />
              <Text
                className="ml-1.5 text-sm font-medium"
                style={{ color: active ? color : '#9ca3af' }}
              >
                {(t as any)[tab.labelKey]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Separator */}
      <View className="h-px bg-gray-100 mt-1" />

      {/* Tab Content */}
      {activeTab === 'home' ? <HomeTab /> : <MemoryListTab layer={activeTab} />}
    </View>
  );
}
