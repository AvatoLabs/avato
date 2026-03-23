/**
 * List share links (disable), collaborators (revoke), grant by username — mirrors Web ResourceShareModal subset.
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ExplainAccessResult, resourceShareApi } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';
import type { ResourceShareSheetTarget } from './ResourceShareOptionsSheet';
import { useToast } from './Toast';

function humanAccessSummary(
  access: ExplainAccessResult | null,
  t: {
    resourceShareAccessDenied: string;
    resourceShareAccessOk: string;
    resourceShareAccessUnknown: string;
    resourceShareAccessViaDirect: string;
    resourceShareAccessViaInherited: string;
    resourceShareAccessViaShareLink: string;
    resourceShareAccessViaSpace: string;
  },
): string {
  if (!access) return t.resourceShareAccessUnknown;
  if (!access.canAccess) return t.resourceShareAccessDenied;
  switch (access.matchedBy) {
    case 'direct': {
      return t.resourceShareAccessViaDirect;
    }
    case 'inherited': {
      return t.resourceShareAccessViaInherited;
    }
    case 'share_link': {
      return t.resourceShareAccessViaShareLink;
    }
    case 'space_member': {
      return t.resourceShareAccessViaSpace;
    }
    default: {
      return t.resourceShareAccessOk;
    }
  }
}

function defaultCustomGrantExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 59, 999);
  return d;
}

type GrantExpiryMode = 'custom' | 'd30' | 'd7' | 'd90' | 'none';

function grantExpiresAtFromMode(mode: GrantExpiryMode, custom: Date): Date | undefined {
  if (mode === 'none') return undefined;
  if (mode === 'd7') return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (mode === 'd30') return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (mode === 'd90') return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  return custom;
}

interface ShareLinkRow {
  createdAt?: string | null;
  disabledAt?: string | Date | null;
  expiresAt?: string | Date | null;
  id: string;
}

interface PermissionRow {
  canReshare?: boolean;
  expiresAt?: string | Date | null;
  id: string;
  inheritsToChildren?: boolean;
  role?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  subjectUsername?: string | null;
}

function errStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: number }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

function formatWhen(value: string | Date | null | undefined): string {
  if (value == null) return '—';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

interface ResourceShareManageSheetProps {
  onActionError: () => void;
  onClose: () => void;
  target: ResourceShareSheetTarget | null;
  visible: boolean;
}

export default function ResourceShareManageSheet({
  visible,
  target,
  onClose,
  onActionError,
}: ResourceShareManageSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [access, setAccess] = useState<ExplainAccessResult | null>(null);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [linksForbidden, setLinksForbidden] = useState(false);
  const [linksFailed, setLinksFailed] = useState(false);
  const [members, setMembers] = useState<PermissionRow[]>([]);
  const [membersForbidden, setMembersForbidden] = useState(false);
  const [membersFailed, setMembersFailed] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [grantUsername, setGrantUsername] = useState('');
  const [grantRole, setGrantRole] = useState<'viewer' | 'editor' | 'owner'>('viewer');
  const [grantInheritChildren, setGrantInheritChildren] = useState(true);
  const [grantCanReshare, setGrantCanReshare] = useState(false);
  const [grantExpiryMode, setGrantExpiryMode] = useState<GrantExpiryMode>('none');
  const [customGrantExpiry, setCustomGrantExpiry] = useState(defaultCustomGrantExpiry);
  const [androidGrantDatePicker, setAndroidGrantDatePicker] = useState(false);
  const [granting, setGranting] = useState(false);

  const grantExpiryMinimum = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const load = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setLinksForbidden(false);
    setLinksFailed(false);
    setMembersForbidden(false);
    setMembersFailed(false);
    try {
      const a = await resourceShareApi.explainAccess({ id: target.id, kind: target.kind });
      setAccess(a);
    } catch {
      setAccess(null);
    }
    try {
      const l = await resourceShareApi.listResourceShareLinks({ id: target.id, kind: target.kind });
      setLinks((l ?? []) as ShareLinkRow[]);
    } catch (e) {
      setLinks([]);
      if (errStatus(e) === 403) setLinksForbidden(true);
      else setLinksFailed(true);
    }
    try {
      const m = await resourceShareApi.listResourcePermissions({
        id: target.id,
        kind: target.kind,
      });
      setMembers((m ?? []) as PermissionRow[]);
    } catch (e) {
      setMembers([]);
      if (errStatus(e) === 403) setMembersForbidden(true);
      else setMembersFailed(true);
    }
    setLoading(false);
  }, [target]);

  useEffect(() => {
    if (!visible || !target) return;
    setGrantUsername('');
    setGrantRole('viewer');
    setGrantInheritChildren(true);
    setGrantCanReshare(false);
    setGrantExpiryMode('none');
    setCustomGrantExpiry(defaultCustomGrantExpiry());
    setAndroidGrantDatePicker(false);
    void load();
  }, [visible, target, load]);

  const handleDisableLink = async (shareLinkId: string) => {
    setDisablingId(shareLinkId);
    try {
      await resourceShareApi.disableResourceShareLink(shareLinkId);
      haptics.success();
      await load();
    } catch {
      onActionError();
    } finally {
      setDisablingId(null);
    }
  };

  const confirmDisableLink = (shareLinkId: string) => {
    Alert.alert(t.resourceShareConfirmDisableLinkTitle, t.resourceShareConfirmDisableLinkMessage, [
      { style: 'cancel', text: t.cancel },
      {
        style: 'destructive',
        text: t.confirm,
        onPress: () => void handleDisableLink(shareLinkId),
      },
    ]);
  };

  const handleRevoke = async (permissionId: string) => {
    setRevokingId(permissionId);
    try {
      await resourceShareApi.revokeResourcePermission(permissionId);
      haptics.success();
      await load();
    } catch {
      onActionError();
    } finally {
      setRevokingId(null);
    }
  };

  const confirmRevoke = (permissionId: string) => {
    Alert.alert(t.resourceShareConfirmRevokeTitle, t.resourceShareConfirmRevokeMessage, [
      { style: 'cancel', text: t.cancel },
      {
        style: 'destructive',
        text: t.confirm,
        onPress: () => void handleRevoke(permissionId),
      },
    ]);
  };

  const handleGrant = async () => {
    const u = grantUsername.trim();
    if (!u || !target) return;
    const expiresAt = grantExpiresAtFromMode(grantExpiryMode, customGrantExpiry);
    if (grantExpiryMode === 'custom' && expiresAt && expiresAt.getTime() < Date.now() - 60_000) {
      toast.show('error', t.resourceShareGrantInvalidExpiry);
      return;
    }
    setGranting(true);
    try {
      await resourceShareApi.grantResourcePermission({
        canReshare: grantRole === 'editor' && grantCanReshare,
        expiresAt,
        id: target.id,
        inheritsToChildren: grantInheritChildren,
        kind: target.kind,
        role: grantRole,
        username: u,
      });
      haptics.success();
      setGrantUsername('');
      setGrantExpiryMode('none');
      setCustomGrantExpiry(defaultCustomGrantExpiry());
      await load();
    } catch {
      onActionError();
    } finally {
      setGranting(false);
    }
  };

  if (!target) return null;

  const roleLabel = (r: string | null | undefined) => {
    if (r === 'editor') return t.resourceShareRoleEditor;
    if (r === 'owner') return t.resourceShareRoleOwner;
    return t.resourceShareRoleViewer;
  };

  const onAndroidGrantDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setAndroidGrantDatePicker(false);
    if (event.type === 'set' && date) {
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      setCustomGrantExpiry(end);
    }
  };

  const expiryModeChip = (mode: GrantExpiryMode, label: string) => {
    const active = grantExpiryMode === mode;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className="rounded-xl px-3 py-2.5 border"
        key={mode}
        style={{
          backgroundColor: active ? colors.primary : colors.fillTertiary,
          borderColor: active ? colors.primary : colors.border,
        }}
        onPress={() => {
          setGrantExpiryMode(mode);
          if (mode === 'custom' && Platform.OS === 'android') {
            setAndroidGrantDatePicker(true);
          }
        }}
      >
        <Text
          className="text-[12px] font-semibold"
          style={{ color: active ? colors.iconOnPrimary : colors.foreground }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

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
          style={{ maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Pressable
            className="bg-card rounded-t-2xl overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center px-5 pb-2 gap-2">
              <Users color={colors.primary} size={22} strokeWidth={2} />
              <View className="flex-1 min-w-0">
                <Text className="text-[17px] font-bold text-foreground" numberOfLines={1}>
                  {t.resourceShareManage}
                </Text>
                <Text
                  className="text-[13px] mt-0.5"
                  numberOfLines={2}
                  style={{ color: colors.secondaryText }}
                >
                  {target.name}
                </Text>
              </View>
              <TouchableOpacity className="px-3 py-2" hitSlop={8} onPress={onClose}>
                <Text className="text-[15px] font-semibold" style={{ color: colors.primary }}>
                  {t.done}
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View className="py-16 items-center">
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : (
              <ScrollView
                className="px-5"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: '100%' }}
              >
                <Text
                  className="text-[12px] font-semibold mb-1"
                  style={{ color: colors.secondaryText }}
                >
                  {t.resourceShareAccessSummary}
                </Text>
                <View className="flex-row items-start justify-between gap-3 mb-4">
                  <Text className="text-[14px] flex-1 text-foreground">
                    {humanAccessSummary(access, t)}
                  </Text>
                  {access ? (
                    <TouchableOpacity
                      className="pt-0.5"
                      hitSlop={8}
                      onPress={async () => {
                        const line = access.canAccess
                          ? `allow · ${access.matchedBy ?? 'ok'} · authzEpoch=${access.authzEpoch} · resourceUid=${access.resourceUid} · spaceId=${access.spaceId}`
                          : `deny · ${access.reason ?? 'unknown'} · resourceUid=${access.resourceUid} · spaceId=${access.spaceId}`;
                        await Clipboard.setStringAsync(line);
                        haptics.success();
                        toast.show('success', t.resourceAccessCopied);
                      }}
                    >
                      <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
                        {t.resourceShareCopyAccess}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text className="text-[13px] font-bold text-foreground mb-2">
                  {t.resourceShareManageLinks}
                </Text>
                {linksForbidden ? (
                  <Text className="text-[13px] mb-4" style={{ color: colors.secondaryText }}>
                    {t.resourceShareLinksUnavailable}
                  </Text>
                ) : linksFailed ? (
                  <View className="mb-4">
                    <Text className="text-[13px]" style={{ color: colors.danger }}>
                      {t.resourceShareManageLoadFailed}
                    </Text>
                    <TouchableOpacity className="mt-2 self-start py-1" onPress={() => void load()}>
                      <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>
                        {t.resourceShareRetry}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : links.length === 0 ? (
                  <Text className="text-[13px] mb-4" style={{ color: colors.secondaryText }}>
                    {t.resourceShareNoLinks}
                  </Text>
                ) : (
                  links.map((row) => {
                    const disabled = row.disabledAt != null;
                    return (
                      <View
                        className="rounded-xl p-3 mb-2"
                        key={row.id}
                        style={{
                          backgroundColor: colors.fillTertiary,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <Text
                            className="text-[12px] font-semibold"
                            style={{ color: colors.secondaryText }}
                          >
                            {disabled ? t.resourceShareLinkDisabled : t.resourceShareLinkActive}
                          </Text>
                          {!disabled && (
                            <TouchableOpacity
                              disabled={disablingId !== null}
                              onPress={() => confirmDisableLink(row.id)}
                            >
                              <Text
                                className="text-[13px] font-semibold"
                                style={{ color: colors.danger }}
                              >
                                {disablingId === row.id ? '…' : t.resourceShareDisableLink}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text className="text-[12px] mt-1" style={{ color: colors.secondaryText }}>
                          {t.resourceShareExpiresLabel}: {formatWhen(row.expiresAt)}
                        </Text>
                      </View>
                    );
                  })
                )}

                <Text className="text-[13px] font-bold text-foreground mb-2 mt-2">
                  {t.resourceShareManageMembers}
                </Text>
                {membersForbidden ? (
                  <Text className="text-[13px] mb-2" style={{ color: colors.secondaryText }}>
                    {t.resourceShareMembersUnavailable}
                  </Text>
                ) : membersFailed ? (
                  <View className="mb-2">
                    <Text className="text-[13px]" style={{ color: colors.danger }}>
                      {t.resourceShareManageLoadFailed}
                    </Text>
                    <TouchableOpacity className="mt-2 self-start py-1" onPress={() => void load()}>
                      <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>
                        {t.resourceShareRetry}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : members.length === 0 ? (
                  <Text className="text-[13px] mb-2" style={{ color: colors.secondaryText }}>
                    {t.resourceShareNoMembers}
                  </Text>
                ) : (
                  members.map((row) => {
                    const badgeParts: string[] = [];
                    if (row.role === 'editor' && row.canReshare) {
                      badgeParts.push(t.resourceShareMemberCanReshare);
                    }
                    if (row.inheritsToChildren === false) {
                      badgeParts.push(t.resourceShareMemberInheritOff);
                    }
                    return (
                      <View
                        className="flex-row items-center justify-between py-2 border-b border-foreground/8"
                        key={row.id}
                      >
                        <View className="flex-1 min-w-0 pr-2">
                          <Text
                            className="text-[14px] font-medium text-foreground"
                            numberOfLines={1}
                          >
                            {row.subjectUsername || row.subjectName || row.subjectId || '—'}
                          </Text>
                          <Text
                            className="text-[12px] mt-0.5"
                            style={{ color: colors.secondaryText }}
                          >
                            {roleLabel(row.role)}
                            {row.expiresAt ? ` · ${formatWhen(row.expiresAt)}` : ''}
                          </Text>
                          {badgeParts.length > 0 ? (
                            <Text
                              className="text-[11px] mt-0.5"
                              style={{ color: colors.secondaryText }}
                            >
                              {badgeParts.join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          disabled={revokingId !== null}
                          onPress={() => confirmRevoke(row.id)}
                        >
                          <Text
                            className="text-[13px] font-semibold"
                            style={{ color: colors.danger }}
                          >
                            {revokingId === row.id ? '…' : t.resourceShareRevoke}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}

                {!membersForbidden && !membersFailed ? (
                  <>
                    <Text
                      className="text-[12px] font-semibold mt-4 mb-1"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceShareGrantHint}
                    </Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="rounded-xl px-3 py-2.5 text-[15px] text-foreground mb-2"
                      placeholder={t.resourceShareGrantUsernamePlaceholder}
                      placeholderTextColor={colors.muted}
                      value={grantUsername}
                      style={{
                        backgroundColor: colors.fillTertiary,
                        borderColor: colors.border,
                        borderWidth: 1,
                      }}
                      onChangeText={setGrantUsername}
                    />
                    <View className="flex-row flex-wrap gap-2 mb-2">
                      {(['viewer', 'editor', 'owner'] as const).map((r) => {
                        const active = grantRole === r;
                        return (
                          <TouchableOpacity
                            className="rounded-lg px-3 py-2 border"
                            key={r}
                            style={{
                              backgroundColor: active ? colors.primary : colors.fillTertiary,
                              borderColor: active ? colors.primary : colors.border,
                            }}
                            onPress={() => {
                              setGrantRole(r);
                              if (r !== 'editor') setGrantCanReshare(false);
                            }}
                          >
                            <Text
                              className="text-[12px] font-semibold"
                              style={{ color: active ? colors.iconOnPrimary : colors.foreground }}
                            >
                              {roleLabel(r)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View className="flex-row items-center justify-between py-2 gap-3">
                      <Text className="text-[13px] flex-1 text-foreground">
                        {t.resourceShareGrantInheritChildren}
                      </Text>
                      <Switch
                        ios_backgroundColor={colors.border}
                        thumbColor={Platform.OS === 'android' ? colors.card : undefined}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        value={grantInheritChildren}
                        onValueChange={setGrantInheritChildren}
                      />
                    </View>
                    {grantRole === 'editor' ? (
                      <View className="flex-row items-center justify-between py-2 gap-3 mb-1">
                        <Text className="text-[13px] flex-1 text-foreground">
                          {t.resourceShareGrantCanReshare}
                        </Text>
                        <Switch
                          ios_backgroundColor={colors.border}
                          thumbColor={Platform.OS === 'android' ? colors.card : undefined}
                          trackColor={{ false: colors.border, true: colors.primary }}
                          value={grantCanReshare}
                          onValueChange={setGrantCanReshare}
                        />
                      </View>
                    ) : null}
                    <Text
                      className="text-[12px] font-semibold mt-2 mb-1"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.resourceShareGrantExpirySection}
                    </Text>
                    <View className="flex-row flex-wrap gap-2 mb-2">
                      {expiryModeChip('none', t.resourceShareGrantExpiryNone)}
                      {expiryModeChip('d7', t.resourceShareGrantExpiryPreset7)}
                      {expiryModeChip('d30', t.resourceShareGrantExpiryPreset30)}
                      {expiryModeChip('d90', t.resourceShareGrantExpiryPreset90)}
                      {expiryModeChip('custom', t.resourceShareGrantExpiryCustom)}
                    </View>
                    {grantExpiryMode === 'custom' && Platform.OS === 'android' ? (
                      <Text className="text-[12px] mb-2" style={{ color: colors.secondaryText }}>
                        {t.resourceShareGrantExpirySelected} {formatWhen(customGrantExpiry)}
                      </Text>
                    ) : null}
                    {grantExpiryMode === 'custom' && Platform.OS === 'ios' ? (
                      <View className="mb-2 items-center">
                        <DateTimePicker
                          display="spinner"
                          minimumDate={grantExpiryMinimum}
                          mode="date"
                          value={customGrantExpiry}
                          onChange={(_event, date) => {
                            if (date) {
                              const end = new Date(date);
                              end.setHours(23, 59, 59, 999);
                              setCustomGrantExpiry(end);
                            }
                          }}
                        />
                      </View>
                    ) : null}
                    {androidGrantDatePicker ? (
                      <DateTimePicker
                        display="default"
                        minimumDate={grantExpiryMinimum}
                        mode="date"
                        value={customGrantExpiry}
                        onChange={onAndroidGrantDateChange}
                      />
                    ) : null}
                    <TouchableOpacity
                      className="rounded-xl py-3 items-center mb-8"
                      disabled={granting || !grantUsername.trim()}
                      style={{
                        backgroundColor: grantUsername.trim()
                          ? colors.primary
                          : colors.fillTertiary,
                      }}
                      onPress={() => void handleGrant()}
                    >
                      {granting ? (
                        <ActivityIndicator color={colors.iconOnPrimary} />
                      ) : (
                        <Text
                          className="text-[15px] font-semibold"
                          style={{
                            color: grantUsername.trim() ? colors.iconOnPrimary : colors.muted,
                          }}
                        >
                          {t.resourceShareGrantButton}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
