import { ArrowLeft, Crown, Save, Trash2, UserPlus, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { spaceApi } from '../lib/api';
import { type I18nStore, useI18n } from '../lib/i18n';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { MobileSpaceItem, MobileSpaceMemberItem, MobileSpaceRole } from '../types';

const MANAGE_ROLES = new Set<MobileSpaceRole>(['admin', 'owner']);
const MEMBER_ROLE_OPTIONS: Array<Exclude<MobileSpaceRole, 'owner'>> = ['admin', 'editor', 'viewer'];

const getRoleLabel = (t: I18nStore['t'], role?: string | null) => {
  switch (role) {
    case 'owner': {
      return t.spaceRoleOwner;
    }
    case 'admin': {
      return t.spaceRoleAdmin;
    }
    case 'editor': {
      return t.spaceRoleEditor;
    }
    case 'viewer': {
      return t.spaceRoleViewer;
    }
    default: {
      return role || '';
    }
  }
};

export default function SpaceSettingsScreen({
  navigation,
  route,
}: RootStackScreenProps<'SpaceSettings'>) {
  const { spaceId } = route.params;
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [space, setSpace] = useState<MobileSpaceItem | null>(null);
  const [members, setMembers] = useState<MobileSpaceMemberItem[]>([]);
  const [membersLoadFailed, setMembersLoadFailed] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [memberRoleDraft, setMemberRoleDraft] =
    useState<Exclude<MobileSpaceRole, 'owner'>>('viewer');

  const canManage = MANAGE_ROLES.has(space?.membershipRole as MobileSpaceRole);
  const canDelete = space?.kind === 'team' && space.membershipRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    setMembersLoadFailed(false);
    try {
      const nextSpace = await spaceApi.getById(spaceId);
      setSpace(nextSpace);
      setNameDraft(nextSpace.name || '');
      setDescriptionDraft(nextSpace.description || '');

      if (MANAGE_ROLES.has(nextSpace.membershipRole as MobileSpaceRole)) {
        const nextMembers = await spaceApi.listMembers(spaceId).catch(() => {
          setMembersLoadFailed(true);
          return [];
        });
        setMembers(nextMembers);
      } else {
        setMembers([]);
      }
    } catch {
      toast.show('error', t.spaceSettingsLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [spaceId, t.spaceSettingsLoadFailed, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    const nextName = nameDraft.trim();
    if (!nextName) return;

    setSaving(true);
    try {
      const updated = await spaceApi.update(spaceId, {
        description: descriptionDraft.trim() || null,
        name: nextName,
      });
      setSpace(updated);
      toast.show('success', t.spaceSettingsSaved);
    } catch {
      toast.show('error', t.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  }, [descriptionDraft, nameDraft, spaceId, t.errorSaveFailed, t.spaceSettingsSaved, toast]);

  const handleAddMember = useCallback(async () => {
    const username = usernameDraft.trim();
    if (!username || !canManage) return;

    setSaving(true);
    try {
      await spaceApi.addMemberByUsername({ role: memberRoleDraft, spaceId, username });
      setUsernameDraft('');
      toast.show('success', t.spaceMemberAdded);
      await load();
    } catch {
      toast.show('error', t.spaceMemberAddFailed);
    } finally {
      setSaving(false);
    }
  }, [
    canManage,
    load,
    memberRoleDraft,
    spaceId,
    t.spaceMemberAddFailed,
    t.spaceMemberAdded,
    toast,
    usernameDraft,
  ]);

  const updateMemberRole = useCallback(
    async (member: MobileSpaceMemberItem, role: Exclude<MobileSpaceRole, 'owner'>) => {
      if (!canManage || member.role === 'owner') return;
      setSaving(true);
      try {
        await spaceApi.updateMemberRole(spaceId, member.userId, role);
        toast.show('success', t.spaceMemberRoleUpdated);
        await load();
      } catch {
        toast.show('error', t.errorSaveFailed);
      } finally {
        setSaving(false);
      }
    },
    [canManage, load, spaceId, t.errorSaveFailed, t.spaceMemberRoleUpdated, toast],
  );

  const removeMember = useCallback(
    (member: MobileSpaceMemberItem) => {
      if (!canManage || member.role === 'owner') return;
      Alert.alert(t.spaceMemberRemoveTitle, t.spaceMemberRemoveDesc, [
        { style: 'cancel', text: t.cancel },
        {
          style: 'destructive',
          text: t.spaceMemberRemove,
          onPress: async () => {
            setSaving(true);
            try {
              await spaceApi.removeMember(spaceId, member.userId);
              toast.show('success', t.spaceMemberRemoved);
              await load();
            } catch {
              toast.show('error', t.errorSaveFailed);
            } finally {
              setSaving(false);
            }
          },
        },
      ]);
    },
    [
      canManage,
      load,
      spaceId,
      t.cancel,
      t.errorSaveFailed,
      t.spaceMemberRemove,
      t.spaceMemberRemoveDesc,
      t.spaceMemberRemoveTitle,
      t.spaceMemberRemoved,
      toast,
    ],
  );

  const transferOwnership = useCallback(
    (member: MobileSpaceMemberItem) => {
      if (space?.membershipRole !== 'owner' || member.role === 'owner') return;
      Alert.alert(t.spaceTransferOwnerTitle, t.spaceTransferOwnerDesc, [
        { style: 'cancel', text: t.cancel },
        {
          style: 'destructive',
          text: t.spaceTransferOwner,
          onPress: async () => {
            setSaving(true);
            try {
              await spaceApi.transferOwnership(spaceId, member.userId);
              toast.show('success', t.spaceTransferOwnerDone);
              await load();
            } catch {
              toast.show('error', t.errorSaveFailed);
            } finally {
              setSaving(false);
            }
          },
        },
      ]);
    },
    [
      load,
      space?.membershipRole,
      spaceId,
      t.cancel,
      t.errorSaveFailed,
      t.spaceTransferOwner,
      t.spaceTransferOwnerDesc,
      t.spaceTransferOwnerDone,
      t.spaceTransferOwnerTitle,
      toast,
    ],
  );

  const deleteSpace = useCallback(() => {
    if (!canDelete) return;
    Alert.alert(t.spaceDeleteTitle, t.spaceDeleteDesc, [
      { style: 'cancel', text: t.cancel },
      {
        style: 'destructive',
        text: t.spaceDelete,
        onPress: async () => {
          setSaving(true);
          try {
            await spaceApi.delete(spaceId);
            toast.show('success', t.spaceDeleted);
            navigation.goBack();
          } catch {
            toast.show('error', t.errorSaveFailed);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [
    canDelete,
    navigation,
    spaceId,
    t.cancel,
    t.errorSaveFailed,
    t.spaceDelete,
    t.spaceDeleteDesc,
    t.spaceDeleteTitle,
    t.spaceDeleted,
    toast,
  ]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return (a.username || a.fullName || a.userId).localeCompare(
          b.username || b.fullName || b.userId,
        );
      }),
    [members],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.spaceSettingsTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.fillTertiary }}>
            <View className="flex-row items-center mb-3">
              <Users color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-2 text-[16px] font-semibold text-foreground">
                {t.spaceSettingsProfile}
              </Text>
            </View>
            <TextInput
              className="rounded-xl px-3 py-3 text-[15px] text-foreground"
              editable={canManage}
              placeholder={t.workspaceCreateNamePlaceholder}
              placeholderTextColor={colors.tertiaryText}
              style={{ backgroundColor: colors.background }}
              value={nameDraft}
              onChangeText={setNameDraft}
            />
            <TextInput
              multiline
              className="mt-2 min-h-[86px] rounded-xl px-3 py-3 text-[15px] text-foreground"
              editable={canManage}
              placeholder={t.workspaceCreateDescriptionPlaceholder}
              placeholderTextColor={colors.tertiaryText}
              style={{ backgroundColor: colors.background, textAlignVertical: 'top' }}
              value={descriptionDraft}
              onChangeText={setDescriptionDraft}
            />
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                {getRoleLabel(t, space?.membershipRole)}
              </Text>
              {canManage ? (
                <TouchableOpacity
                  activeOpacity={0.72}
                  className="flex-row items-center rounded-full px-3 py-2"
                  disabled={saving || !nameDraft.trim()}
                  style={{ backgroundColor: colors.primary }}
                  onPress={() => void handleSave()}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                  ) : (
                    <Save
                      color={colors.iconOnPrimary}
                      size={14}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  )}
                  <Text
                    className="ml-1.5 text-[12px] font-semibold"
                    style={{ color: colors.iconOnPrimary }}
                  >
                    {t.save}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {canManage ? (
            <View className="mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.fillTertiary }}>
              <View className="mb-3 flex-row items-center">
                <UserPlus color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-2 text-[16px] font-semibold text-foreground">
                  {t.spaceMembersTitle}
                </Text>
              </View>
              <TextInput
                autoCapitalize="none"
                className="rounded-xl px-3 py-3 text-[15px] text-foreground"
                placeholder={t.spaceMemberUsernamePlaceholder}
                placeholderTextColor={colors.tertiaryText}
                style={{ backgroundColor: colors.background }}
                value={usernameDraft}
                onChangeText={setUsernameDraft}
              />
              <View className="mt-2 flex-row flex-wrap gap-2">
                {MEMBER_ROLE_OPTIONS.map((role) => {
                  const active = memberRoleDraft === role;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.72}
                      className="rounded-full px-3 py-1.5"
                      key={role}
                      style={{ backgroundColor: active ? colors.primaryMuted : colors.background }}
                      onPress={() => setMemberRoleDraft(role)}
                    >
                      <Text
                        className="text-[12px] font-semibold"
                        style={{ color: active ? colors.primary : colors.secondaryText }}
                      >
                        {getRoleLabel(t, role)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                activeOpacity={0.72}
                className="mt-3 items-center rounded-xl py-3"
                disabled={saving || !usernameDraft.trim()}
                style={{
                  backgroundColor: usernameDraft.trim() ? colors.primary : colors.fillQuaternary,
                }}
                onPress={() => void handleAddMember()}
              >
                <Text
                  className="text-[14px] font-semibold"
                  style={{
                    color: usernameDraft.trim() ? colors.iconOnPrimary : colors.secondaryText,
                  }}
                >
                  {t.spaceMemberAdd}
                </Text>
              </TouchableOpacity>

              {membersLoadFailed ? (
                <Text className="mt-3 text-[12px]" style={{ color: colors.secondaryText }}>
                  {t.spaceMembersLoadFailed}
                </Text>
              ) : null}

              <View className="mt-4">
                {sortedMembers.map((member) => (
                  <View
                    className="mb-2 rounded-xl p-3"
                    key={member.userId}
                    style={{ backgroundColor: colors.background }}
                  >
                    <View className="flex-row items-center">
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
                        {member.role === 'owner' ? (
                          <Crown color={colors.primary} size={15} />
                        ) : (
                          <Users color={colors.secondaryText} size={15} />
                        )}
                      </View>
                      <View className="ml-3 min-w-0 flex-1">
                        <Text
                          className="text-[14px] font-semibold text-foreground"
                          numberOfLines={1}
                        >
                          {member.fullName || member.username || member.userId}
                        </Text>
                        <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                          {getRoleLabel(t, member.role)}
                        </Text>
                      </View>
                    </View>
                    {member.role !== 'owner' ? (
                      <View className="mt-3 flex-row flex-wrap gap-2">
                        {MEMBER_ROLE_OPTIONS.map((role) => {
                          const active = member.role === role;
                          return (
                            <TouchableOpacity
                              activeOpacity={0.72}
                              className="rounded-full px-3 py-1.5"
                              disabled={saving || active}
                              key={role}
                              style={{
                                backgroundColor: active ? colors.primaryMuted : colors.fillTertiary,
                              }}
                              onPress={() => void updateMemberRole(member, role)}
                            >
                              <Text
                                className="text-[12px] font-semibold"
                                style={{ color: active ? colors.primary : colors.secondaryText }}
                              >
                                {getRoleLabel(t, role)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        {space?.membershipRole === 'owner' ? (
                          <TouchableOpacity
                            activeOpacity={0.72}
                            className="rounded-full px-3 py-1.5"
                            style={{ backgroundColor: colors.primarySubtle }}
                            onPress={() => transferOwnership(member)}
                          >
                            <Text
                              className="text-[12px] font-semibold"
                              style={{ color: colors.primary }}
                            >
                              {t.spaceTransferOwner}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          activeOpacity={0.72}
                          className="rounded-full px-3 py-1.5"
                          style={{ backgroundColor: colors.dangerSubtle }}
                          onPress={() => removeMember(member)}
                        >
                          <Text
                            className="text-[12px] font-semibold"
                            style={{ color: colors.danger }}
                          >
                            {t.spaceMemberRemove}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {canDelete ? (
            <TouchableOpacity
              activeOpacity={0.72}
              className="mt-4 flex-row items-center justify-center rounded-xl py-3"
              style={{ backgroundColor: colors.dangerSubtle }}
              onPress={deleteSpace}
            >
              <Trash2 color={colors.danger} size={16} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-2 text-[14px] font-semibold" style={{ color: colors.danger }}>
                {t.spaceDelete}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
