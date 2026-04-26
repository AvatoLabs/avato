/**
 * Content shared with the current user (resourceShare.listSharedWithMe).
 */
import { ChevronRight, Link2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contentShareApi } from '../../lib/api';
import { formatMobileDateTime } from '../../lib/dateTime';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { getCanonicalSharedResourceKind } from '../../lib/resourceShare';
import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';

export interface SharedWithMeRow {
  contentUid?: string;
  kind: 'document' | 'file' | 'source_set';
  localId: string;
  name: string;
  sharedExpiresAt?: string | Date | null;
  sharedRole?: 'editor' | 'owner' | 'viewer';
  spaceId?: string | null;
}

function normalizeRow(raw: unknown, untitled: string): SharedWithMeRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rawKind = o.kind;
  const localId = o.localId;
  if (rawKind !== 'file' && rawKind !== 'document' && rawKind !== 'source_set') return null;
  if (typeof localId !== 'string') return null;
  const kind = getCanonicalSharedResourceKind({ kind: rawKind, localId });
  const sr = o.sharedRole;
  const sharedRole = sr === 'editor' || sr === 'owner' || sr === 'viewer' ? sr : undefined;
  const se = o.sharedExpiresAt;
  const sharedExpiresAt =
    se == null ? undefined : typeof se === 'string' || se instanceof Date ? se : undefined;
  return {
    kind,
    localId,
    name: typeof o.name === 'string' ? o.name : untitled,
    contentUid: typeof o.contentUid === 'string' ? o.contentUid : undefined,
    sharedExpiresAt,
    sharedRole,
    spaceId: typeof o.spaceId === 'string' ? o.spaceId : null,
  };
}

function formatSharedWhen(value: string | Date | null | undefined): string {
  return formatMobileDateTime(value);
}

function kindLabel(
  kind: SharedWithMeRow['kind'],
  t: {
    resourceSharedKindDocument: string;
    resourceSharedKindFile: string;
    resourceSharedKindSourceSet: string;
  },
) {
  if (kind === 'file') return t.resourceSharedKindFile;
  if (kind === 'source_set') return t.resourceSharedKindSourceSet;
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

export default function SharedWithMeSheet({ visible, onClose, onPick }: SharedWithMeSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const [rows, setRows] = useState<SharedWithMeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const isFloatingPanel = responsiveMetrics.isTablet;
  const sheetWidth = Math.min(
    Math.max(screenWidth - 32, 0),
    responsiveMetrics.isWideTablet ? 720 : 640,
  );
  const sheetMaxHeight = isFloatingPanel
    ? Math.min(Math.round(screenHeight * 0.78), 760)
    : Math.round(screenHeight * 0.85);
  const sharedListMaxHeight = Math.min(
    isFloatingPanel ? 520 : 420,
    Math.round(screenHeight * (isFloatingPanel ? 0.58 : 0.52)),
  );

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const raw = await contentShareApi.listSharedWithMe();
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
        className="mb-3 flex-row items-center gap-2 rounded-2xl border px-4 py-3.5"
        style={{ backgroundColor: colors.card, borderColor: colors.borderSubtle }}
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
    [colors.borderSubtle, colors.card, colors.muted, colors.secondaryText, onPick, t],
  );

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/45"
        style={{
          justifyContent: isFloatingPanel ? 'center' : 'flex-end',
          paddingHorizontal: isFloatingPanel ? 16 : 0,
          paddingVertical: isFloatingPanel ? 24 : 0,
        }}
        onPress={onClose}
      >
        <Animated.View
          entering={enteringModalContent()}
          style={{
            alignSelf: 'center',
            maxHeight: sheetMaxHeight,
            paddingBottom: isFloatingPanel
              ? Math.max(insets.bottom, 16)
              : Math.max(insets.bottom, 12),
            width: isFloatingPanel ? sheetWidth : undefined,
          }}
        >
          <Pressable
            className={
              isFloatingPanel
                ? 'bg-card rounded-3xl overflow-hidden'
                : 'bg-card rounded-t-2xl overflow-hidden'
            }
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
                style={{ maxHeight: sharedListMaxHeight }}
                ListHeaderComponent={
                  <View
                    className="mb-4 rounded-2xl border px-4 py-4"
                    style={{
                      backgroundColor: colors.fillQuaternary,
                      borderColor: colors.borderSubtle,
                    }}
                  >
                    <Text
                      className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceSharedWithMe}
                    </Text>
                    <Text
                      className="mt-2 text-[15px] font-semibold"
                      style={{ color: colors.foreground }}
                    >
                      {rows.length}
                    </Text>
                    <Text
                      className="mt-1 text-[13px] leading-5"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceShareLinkSheetSubtitle}
                    </Text>
                  </View>
                }
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
