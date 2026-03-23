/**
 * Resources shared with the current user (resourceShare.listSharedWithMe).
 */
import { ChevronRight, Link2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  type ListRenderItemInfo,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resourceShareApi } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';

export interface SharedWithMeRow {
  kind: 'document' | 'file' | 'knowledge_base';
  localId: string;
  name: string;
  resourceUid?: string;
  sharedExpiresAt?: string | Date | null;
  sharedRole?: 'editor' | 'owner' | 'viewer';
  spaceId?: string | null;
}

function normalizeRow(raw: unknown, untitled: string): SharedWithMeRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  const localId = o.localId;
  if (kind !== 'file' && kind !== 'document' && kind !== 'knowledge_base') return null;
  if (typeof localId !== 'string') return null;
  const sr = o.sharedRole;
  const sharedRole = sr === 'editor' || sr === 'owner' || sr === 'viewer' ? sr : undefined;
  const se = o.sharedExpiresAt;
  const sharedExpiresAt =
    se == null ? undefined : typeof se === 'string' || se instanceof Date ? se : undefined;
  return {
    kind,
    localId,
    name: typeof o.name === 'string' ? o.name : untitled,
    resourceUid: typeof o.resourceUid === 'string' ? o.resourceUid : undefined,
    sharedExpiresAt,
    sharedRole,
    spaceId: typeof o.spaceId === 'string' ? o.spaceId : null,
  };
}

function formatSharedWhen(value: string | Date | null | undefined): string {
  if (value == null) return '—';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function kindLabel(
  kind: SharedWithMeRow['kind'],
  t: {
    resourceSharedKindDocument: string;
    resourceSharedKindFile: string;
    resourceSharedKindLibrary: string;
  },
) {
  if (kind === 'file') return t.resourceSharedKindFile;
  if (kind === 'knowledge_base') return t.resourceSharedKindLibrary;
  return t.resourceSharedKindDocument;
}

interface SharedWithMeSheetProps {
  onClose: () => void;
  onPick: (row: SharedWithMeRow) => void;
  visible: boolean;
}

function roleLabelUi(
  role: NonNullable<SharedWithMeRow['sharedRole']>,
  t: {
    resourceShareRoleEditor: string;
    resourceShareRoleOwner: string;
    resourceShareRoleViewer: string;
  },
) {
  if (role === 'editor') return t.resourceShareRoleEditor;
  if (role === 'owner') return t.resourceShareRoleOwner;
  return t.resourceShareRoleViewer;
}

const SHARED_LIST_MAX_H = Math.min(420, Math.round(Dimensions.get('window').height * 0.52));

export default function SharedWithMeSheet({ visible, onClose, onPick }: SharedWithMeSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<SharedWithMeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const raw = await resourceShareApi.listSharedWithMe();
      const list = (Array.isArray(raw) ? raw : [])
        .map((item) => normalizeRow(item, t.resourceUntitled))
        .filter((r): r is SharedWithMeRow => r !== null);
      setRows(list);
    } catch {
      setRows([]);
      setFailed(true);
    }
  }, [t.resourceUntitled]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [visible, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderSharedRow = useCallback(
    ({ item }: ListRenderItemInfo<SharedWithMeRow>) => (
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        className="flex-row items-center py-3.5 border-b border-foreground/8 gap-2"
        onPress={() => {
          haptics.selection();
          onPick(item);
        }}
      >
        <View className="flex-1 min-w-0">
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={2}>
            {item.name}
          </Text>
          <Text className="text-[12px] mt-1" style={{ color: colors.secondaryText }}>
            {[kindLabel(item.kind, t), item.sharedRole ? roleLabelUi(item.sharedRole, t) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text className="text-[11px] mt-0.5" style={{ color: colors.secondaryText }}>
            {item.sharedExpiresAt != null
              ? `${t.resourceSharedPermissionValidUntil} ${formatSharedWhen(item.sharedExpiresAt)}`
              : t.resourceSharedAccessNoExpiry}
          </Text>
        </View>
        <ChevronRight color={colors.muted} size={18} strokeWidth={2} />
      </TouchableOpacity>
    ),
    [colors.muted, colors.secondaryText, onPick, t],
  );

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/45" onPress={onClose}>
        <Animated.View
          entering={enteringModalContent()}
          style={{ maxHeight: '85%', paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Pressable
            className="bg-card rounded-t-2xl overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center px-5 pb-3 gap-2">
              <Link2 color={colors.primary} size={22} strokeWidth={2} />
              <Text className="flex-1 text-[17px] font-bold text-foreground">
                {t.resourceSharedWithMe}
              </Text>
              <TouchableOpacity className="px-3 py-2" hitSlop={8} onPress={onClose}>
                <Text className="text-[15px] font-semibold" style={{ color: colors.primary }}>
                  {t.done}
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View className="py-20 items-center">
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : failed ? (
              <View className="px-5 pb-10 items-center">
                <Text className="text-[14px] text-center" style={{ color: colors.danger }}>
                  {t.resourceSharedWithMeLoadFailed}
                </Text>
                <TouchableOpacity className="mt-3 px-4 py-2" onPress={() => void load()}>
                  <Text className="text-[15px] font-semibold" style={{ color: colors.primary }}>
                    {t.resourceShareRetry}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : rows.length === 0 ? (
              <View className="px-5 pb-10">
                <Text className="text-[14px] text-center" style={{ color: colors.secondaryText }}>
                  {t.resourceSharedWithMeEmpty}
                </Text>
              </View>
            ) : (
              <FlatList
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                data={rows}
                keyExtractor={(item) => `${item.kind}:${item.localId}`}
                renderItem={renderSharedRow}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: SHARED_LIST_MAX_H }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    tintColor={colors.primary}
                    onRefresh={onRefresh}
                  />
                }
              />
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
