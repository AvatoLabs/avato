/**
 * ChatSettingsScreen — conversation-level settings only.
 * Agent management is handled in Agent screens.
 */
import {
  ArrowLeft,
  Check,
  ChevronRight,
  MessageSquare,
  Pencil,
  Tag,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AgentSelectionSheet from '../components/ui/AgentSelectionSheet';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { TagEditorSheet } from '../components/ui/TagEditorSheet';
import { useToast } from '../components/ui/Toast';
import { semanticColors } from '../constants/colors';
import { resolveTagColor, withAlpha } from '../constants/tags';
import { agentApi, agentGroupApi, type AgentGroupDetail, sessionTagApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';
import type { SessionTag } from '../types';

const sortSessionTags = (tags: SessionTag[]) =>
  [...tags].sort((left, right) => {
    const leftSort = left.sort ?? Number.MAX_SAFE_INTEGER;
    const rightSort = right.sort ?? Number.MAX_SAFE_INTEGER;

    if (leftSort !== rightSort) return leftSort - rightSort;

    return left.name.localeCompare(right.name);
  });

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed || '';
};

const splitLineList = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

function SectionCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View className="mx-5 mb-5">
      <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
        {title}
      </Text>
      <View className="rounded-2xl bg-foreground/[0.02] p-4">{children}</View>
    </View>
  );
}

function Field({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View className="mb-3 last:mb-0">
      <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">{label}</Text>
      <TextInput
        className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={semanticColors.secondaryText}
        style={multiline ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function ToggleRow({
  description,
  label,
  onValueChange,
  value,
}: {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View className="mb-3 flex-row items-center rounded-2xl bg-foreground/[0.04] px-4 py-3 last:mb-0">
      <View className="flex-1 pr-4">
        <Text className="text-[14px] font-semibold text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">{description}</Text>
        ) : null}
      </View>
      <Switch
        trackColor={{ false: 'rgba(120,120,128,0.18)', true: `${semanticColors.primary}66` }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

export default function ChatSettingsScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const isGroupSession = session?.type === 'group';
  const removeSession = useSessionStore((s) => s.removeSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const updateSessionTag = useSessionStore((s) => s.updateSessionTag);
  const updateSessionTitle = useSessionStore((s) => s.updateSessionTitle);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const [agentSummary, setAgentSummary] = useState<{
    avatar?: string;
    description?: string;
    title?: string;
  } | null>(null);
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [tagEditorVisible, setTagEditorVisible] = useState(false);
  const [sessionTags, setSessionTags] = useState<SessionTag[]>([]);
  const [tagDraftName, setTagDraftName] = useState('');
  const [tagDraftColor, setTagDraftColor] = useState<string | null>(null);
  const [title, setTitle] = useState(session?.title || '');
  const [saving, setSaving] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupDetail, setGroupDetail] = useState<AgentGroupDetail | null>(null);
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSystemPrompt, setGroupSystemPrompt] = useState('');
  const [groupOpeningMessage, setGroupOpeningMessage] = useState('');
  const [groupOpeningQuestions, setGroupOpeningQuestions] = useState('');
  const [groupAllowDM, setGroupAllowDM] = useState(true);
  const [groupRevealDM, setGroupRevealDM] = useState(false);
  const [addMembersVisible, setAddMembersVisible] = useState(false);

  useEffect(() => {
    if (session?.title) setTitle(session.title);
  }, [session?.title]);

  const applyGroupDetail = useCallback(
    (detail: AgentGroupDetail | null) => {
      const config = (detail?.config as Record<string, any> | undefined) || {};

      setGroupDetail(detail);
      setTitle(detail?.title || session?.title || '');
      setGroupDescription(detail?.description || '');
      setGroupSystemPrompt(typeof config.systemPrompt === 'string' ? config.systemPrompt : '');
      setGroupOpeningMessage(
        typeof config.openingMessage === 'string' ? config.openingMessage : '',
      );
      setGroupOpeningQuestions(
        Array.isArray(config.openingQuestions) ? config.openingQuestions.join('\n') : '',
      );
      setGroupAllowDM(config.allowDM !== false);
      setGroupRevealDM(Boolean(config.revealDM));
    },
    [session?.title],
  );

  const loadGroupDetail = useCallback(async () => {
    if (!sessionId || !isGroupSession) return;

    try {
      setGroupLoading(true);
      const detail = await agentGroupApi.getGroupDetail(sessionId);

      if (!detail) {
        toast.show('error', t.settingsNotConfigured);
        navigation.goBack();
        return;
      }

      applyGroupDetail(detail);
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setGroupLoading(false);
    }
  }, [
    applyGroupDetail,
    isGroupSession,
    navigation,
    sessionId,
    t.errorNetwork,
    t.settingsNotConfigured,
    toast,
  ]);

  useEffect(() => {
    if (!isGroupSession) {
      setGroupDetail(null);
      setGroupDescription('');
      setGroupSystemPrompt('');
      setGroupOpeningMessage('');
      setGroupOpeningQuestions('');
      setGroupAllowDM(true);
      setGroupRevealDM(false);
      return;
    }

    void loadGroupDetail();
  }, [isGroupSession, loadGroupDetail]);

  useEffect(() => {
    let disposed = false;

    if (!sessionId || session?.type === 'group') {
      setAgentSummary(null);
      return;
    }

    agentApi
      .getConfigBySession(sessionId)
      .then((config) => {
        if (disposed || !config) return;

        setAgentSummary({
          avatar: config.avatar,
          description: config.description,
          title: config.title,
        });
      })
      .catch(() => {
        if (!disposed) setAgentSummary(null);
      });

    return () => {
      disposed = true;
    };
  }, [session?.type, sessionId]);

  const fetchSessionTags = useCallback(async () => {
    if (isGroupSession) return;

    try {
      const tags = await sessionTagApi.list();
      setSessionTags(sortSessionTags(tags ?? []));
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [isGroupSession, t.errorNetwork, toast]);

  useEffect(() => {
    void fetchSessionTags();
  }, [fetchSessionTags]);

  const currentTag = useMemo(
    () => sessionTags.find((tag) => tag.id === session?.tagId),
    [session?.tagId, sessionTags],
  );

  const closeTagEditor = useCallback(() => {
    setTagDraftName('');
    setTagDraftColor(null);
    setTagEditorVisible(false);
  }, []);

  const saveSettings = async () => {
    if (!sessionId || saving) return false;

    try {
      setSaving(true);

      if (isGroupSession) {
        if (groupLoading || !groupDetail) return false;

        const currentConfig = (groupDetail?.config as Record<string, any> | undefined) || {};
        const nextTitle = title.trim() || groupDetail?.title || session?.title || 'New Group Chat';
        const nextDescription = normalizeText(groupDescription);
        const nextConfig = {
          ...currentConfig,
          allowDM: groupAllowDM,
          openingMessage: normalizeText(groupOpeningMessage),
          openingQuestions: splitLineList(groupOpeningQuestions),
          revealDM: groupRevealDM,
          systemPrompt: normalizeText(groupSystemPrompt),
        };

        await agentGroupApi.updateGroup(sessionId, {
          config: nextConfig,
          description: nextDescription || null,
          title: nextTitle,
        });

        updateSessionTitle(sessionId, nextTitle);
        setGroupDetail((current) =>
          current
            ? {
                ...current,
                config: nextConfig,
                description: nextDescription || null,
                title: nextTitle,
              }
            : current,
        );
        await fetchSessions();
        return true;
      }

      const newTitle = title.trim();
      if (newTitle && newTitle !== session?.title) {
        await renameSession(sessionId, newTitle);
      }

      return true;
    } catch {
      toast.show('error', t.errorSaveFailed);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveGroupMember = useCallback(
    (agentId: string) => {
      if (!sessionId) return;

      Alert.alert(t.groupSettingsRemoveMemberConfirm, t.groupSettingsRemoveMemberDesc, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await agentGroupApi.removeAgentsFromGroup(sessionId, [agentId]);
              haptics.success();
              await loadGroupDetail();
            } catch {
              toast.show('error', t.errorDeleteFailed);
            }
          },
        },
      ]);
    },
    [
      loadGroupDetail,
      sessionId,
      t.cancel,
      t.delete,
      t.errorDeleteFailed,
      t.groupSettingsRemoveMemberConfirm,
      t.groupSettingsRemoveMemberDesc,
      toast,
    ],
  );

  const handleAddGroupMembers = useCallback(
    async ({ agentIds }: { agentIds: string[]; title: string }) => {
      if (!sessionId || agentIds.length === 0) return;

      try {
        await agentGroupApi.addAgentsToGroup(sessionId, agentIds);
        setAddMembersVisible(false);
        haptics.success();
        await loadGroupDetail();
      } catch {
        toast.show('error', t.errorSaveFailed);
      }
    },
    [loadGroupDetail, sessionId, t.errorSaveFailed, toast],
  );

  const handleDeleteChat = () => {
    if (!sessionId) return;

    Alert.alert(t.chatSettingsDeleteConfirm, t.chatSettingsDeleteDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          clearMessages(sessionId);
          await removeSession(sessionId);
          navigation.navigate('MainTabs');
        },
      },
    ]);
  };

  const handleClearHistory = () => {
    if (!sessionId) return;

    Alert.alert(t.chatSettingsClearConfirm, t.chatSettingsClearDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.chatSettingsClearConfirm,
        style: 'destructive',
        onPress: () => {
          clearMessages(sessionId);
        },
      },
    ]);
  };

  const handleSelectTag = useCallback(
    async (tagId?: string | null) => {
      if (!sessionId) return;

      try {
        await updateSessionTag(sessionId, tagId);
        setTagSelectorVisible(false);
        haptics.success();
      } catch (err) {
        const { messageKey } = classifyError(err);
        toast.show('error', t[messageKey]);
      }
    },
    [sessionId, t, toast, updateSessionTag],
  );

  const handleCreateTag = useCallback(async () => {
    if (!sessionId) return;

    const name = tagDraftName.trim();
    if (!name) {
      toast.show('error', t.errorUnknown);
      return;
    }

    try {
      const newTagId = await sessionTagApi.create(name, tagDraftColor);
      if (!newTagId) {
        toast.show('error', t.errorNetwork);
        return;
      }

      await fetchSessionTags();
      await updateSessionTag(sessionId, newTagId);
      await fetchSessions();
      closeTagEditor();
      setTagSelectorVisible(false);
      haptics.success();
    } catch (err) {
      const { messageKey } = classifyError(err);
      toast.show('error', t[messageKey]);
    }
  }, [
    closeTagEditor,
    fetchSessionTags,
    fetchSessions,
    sessionId,
    t,
    tagDraftColor,
    tagDraftName,
    toast,
    updateSessionTag,
  ]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.chatSettingsTitle}
        leftElement={
          <ArrowLeft
            color={semanticColors.primary}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        }
        rightElement={
          saving ? (
            <ActivityIndicator color={semanticColors.primary} />
          ) : (
            <Text className="text-primary font-medium text-[15px]">{t.save}</Text>
          )
        }
        onPressLeft={() => {
          void saveSettings();
          navigation.goBack();
        }}
        onPressRight={async () => {
          const saved = await saveSettings();
          if (!saved) return;

          haptics.success();
          toast.show('success', t.settingsSavedChat);
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View className="mx-5 mb-5 mt-5">
            <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
              {t.chatSettingsTitle}
            </Text>
            <View className="rounded-2xl bg-foreground/[0.02] px-4 py-3">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <TextInput
                    className="text-[16px] font-semibold tracking-tight text-foreground"
                    placeholder={t.chatListNewConversation}
                    placeholderTextColor={semanticColors.secondaryText}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>
                <Pencil color={semanticColors.secondaryText} size={14} strokeWidth={1.5} />
              </View>
              {isGroupSession ? (
                <View className="mt-4 border-t border-foreground/5 pt-4">
                  <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
                    {t.agentConfigDescription}
                  </Text>
                  <TextInput
                    multiline
                    className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
                    placeholder={t.agentConfigDescriptionPlaceholder}
                    placeholderTextColor={semanticColors.secondaryText}
                    style={{ minHeight: 88, textAlignVertical: 'top' }}
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {!isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(90).duration(300)}>
            <View className="mx-5 mb-5">
              <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
                {t.chatSettingsTag}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-row items-center rounded-2xl bg-foreground/[0.02] px-4 py-3"
                onPress={() => setTagSelectorVisible(true)}
              >
                <View
                  className="mr-3 h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: currentTag
                      ? resolveTagColor(currentTag.color)
                      : semanticColors.secondaryText,
                  }}
                />
                <View
                  className="mr-3 rounded-full px-3 py-1"
                  style={{
                    backgroundColor: currentTag
                      ? withAlpha(currentTag.color, '18')
                      : semanticColors.fillTertiary,
                  }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      color: currentTag
                        ? resolveTagColor(currentTag.color)
                        : semanticColors.secondaryText,
                    }}
                  >
                    {currentTag?.name || t.tagNone}
                  </Text>
                </View>
                <View className="flex-1" />
                <ChevronRight
                  color={semanticColors.secondaryText}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {!isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View className="mx-5 mb-5">
              <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
                {t.agentConfigTitle}
              </Text>
              <View className="rounded-2xl bg-foreground/[0.02] px-4 py-3">
                <View>
                  <Text className="text-[14px] font-medium text-foreground">
                    {agentSummary
                      ? `${agentSummary.avatar || '🤖'} ${agentSummary.title || t.settingsDefaultAgent}`
                      : t.settingsNotConfigured}
                  </Text>
                  {agentSummary?.description ? (
                    <Text className="mt-1 text-[12px] leading-5 text-secondary/60">
                      {agentSummary.description}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="mt-4 self-start rounded-xl bg-primary/10 px-3 py-2"
                  onPress={() => navigation.navigate('AgentConfig', { sessionId })}
                >
                  <Text className="text-[13px] font-semibold text-primary">
                    {t.agentConfigTitle}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <SectionCard title={t.chatSettingsGroup}>
              {groupLoading ? (
                <View className="items-center justify-center py-6">
                  <ActivityIndicator color={semanticColors.primary} />
                </View>
              ) : (
                <>
                  <ToggleRow
                    description={t.groupSettingsAllowDMDesc}
                    label={t.groupSettingsAllowDM}
                    value={groupAllowDM}
                    onValueChange={setGroupAllowDM}
                  />
                  <ToggleRow
                    description={t.groupSettingsRevealDMDesc}
                    label={t.groupSettingsRevealDM}
                    value={groupRevealDM}
                    onValueChange={setGroupRevealDM}
                  />
                </>
              )}
            </SectionCard>
          </Animated.View>
        ) : null}

        {isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(120).duration(300)}>
            <SectionCard title={t.chatSettingsSystemPrompt}>
              {groupLoading ? (
                <View className="items-center justify-center py-6">
                  <ActivityIndicator color={semanticColors.primary} />
                </View>
              ) : (
                <Field
                  multiline
                  label={t.chatSettingsSystemPrompt}
                  placeholder={t.chatSettingsSystemPromptPlaceholder}
                  value={groupSystemPrompt}
                  onChangeText={setGroupSystemPrompt}
                />
              )}
            </SectionCard>
          </Animated.View>
        ) : null}

        {isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(140).duration(300)}>
            <SectionCard title={t.agentConfigOpening}>
              {groupLoading ? (
                <View className="items-center justify-center py-6">
                  <ActivityIndicator color={semanticColors.primary} />
                </View>
              ) : (
                <>
                  <Field
                    multiline
                    label={t.agentConfigOpeningMessage}
                    value={groupOpeningMessage}
                    onChangeText={setGroupOpeningMessage}
                  />
                  <Field
                    multiline
                    label={t.agentConfigOpeningQuestions}
                    placeholder={t.agentConfigOpeningQuestionsPlaceholder}
                    value={groupOpeningQuestions}
                    onChangeText={setGroupOpeningQuestions}
                  />
                </>
              )}
            </SectionCard>
          </Animated.View>
        ) : null}

        {isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <SectionCard title={t.groupSettingsMembers}>
              {groupLoading ? (
                <View className="items-center justify-center py-6">
                  <ActivityIndicator color={semanticColors.primary} />
                </View>
              ) : groupDetail?.agents?.length ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="mb-3 self-start rounded-xl bg-primary/10 px-3 py-2"
                    onPress={() => setAddMembersVisible(true)}
                  >
                    <Text className="text-[13px] font-semibold text-primary">
                      {t.groupAddMembers}
                    </Text>
                  </TouchableOpacity>
                  {groupDetail.agents.map((member, index) => {
                    const fallbackLabel = member.title?.trim()?.slice(0, 1) || '#';
                    const avatarText =
                      member.avatar &&
                      member.avatar.length <= 4 &&
                      !member.avatar.startsWith('http')
                        ? member.avatar
                        : fallbackLabel.toUpperCase();
                    const memberSummary =
                      member.description ||
                      (member.provider && member.model
                        ? `${member.provider} · ${member.model}`
                        : member.model || t.settingsNotConfigured);

                    return (
                      <View
                        className={`flex-row items-center rounded-2xl bg-foreground/[0.04] px-4 py-3 ${
                          index === (groupDetail.agents?.length ?? 0) - 1 ? '' : 'mb-3'
                        }`}
                        key={member.id}
                      >
                        <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                          <Text className="text-[16px] font-semibold text-primary">
                            {avatarText}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="text-[14px] font-semibold text-foreground">
                              {member.title || t.settingsDefaultAgent}
                            </Text>
                            {member.isSupervisor ? (
                              <View className="ml-2 rounded-full bg-primary/10 px-2 py-0.5">
                                <Text className="text-[11px] font-semibold text-primary">
                                  {t.groupSettingsSupervisor}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                            {memberSummary}
                          </Text>
                        </View>
                        {!member.isSupervisor ? (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            className="ml-3 rounded-xl px-3 py-2"
                            style={{ backgroundColor: withAlpha(semanticColors.danger, '14') }}
                            onPress={() => handleRemoveGroupMember(member.id)}
                          >
                            <Text
                              className="text-[12px] font-semibold"
                              style={{ color: semanticColors.danger }}
                            >
                              {t.delete}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="mb-3 self-start rounded-xl bg-primary/10 px-3 py-2"
                    onPress={() => setAddMembersVisible(true)}
                  >
                    <Text className="text-[13px] font-semibold text-primary">
                      {t.groupAddMembers}
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-[13px] leading-6 text-secondary/60">
                    {t.groupSettingsMembersEmpty}
                  </Text>
                </>
              )}
            </SectionCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <View className="mx-5 mt-4">
            <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
              {t.chatSettingsDangerZone}
            </Text>
            <View className="overflow-hidden rounded-2xl bg-foreground/[0.02]">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-4 active:bg-foreground/[0.04]"
                onPress={handleClearHistory}
              >
                <MessageSquare
                  color="#f5a623"
                  size={17}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 12 }}
                />
                <Text className="flex-1 text-[15px] font-medium text-foreground">
                  {t.chatSettingsClearHistory}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-4 active:bg-foreground/[0.04]"
                onPress={handleDeleteChat}
              >
                <Trash2
                  color={semanticColors.danger}
                  size={17}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginRight: 12 }}
                />
                <Text
                  className="flex-1 text-[15px] font-medium"
                  style={{ color: semanticColors.danger }}
                >
                  {t.chatSettingsDeleteConversation}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={!isGroupSession && tagSelectorVisible}
        onRequestClose={() => setTagSelectorVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setTagSelectorVisible(false)}
        >
          <Pressable
            className="rounded-t-2xl bg-white"
            style={{ maxHeight: '72%' }}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="h-1 w-9 rounded-full bg-foreground/10" />
            </View>
            <View className="px-5 pb-3 pt-1">
              <Text className="text-[18px] font-bold tracking-tight text-foreground">
                {t.chatSettingsTag}
              </Text>
            </View>
            <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 24 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center justify-between rounded-xl px-3 py-3.5"
                onPress={() => void handleSelectTag(null)}
              >
                <View className="flex-row items-center">
                  <View
                    className="mr-3 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: semanticColors.secondaryText }}
                  />
                  <Text className="text-[15px] font-medium text-foreground">{t.tagNone}</Text>
                </View>
                {!session?.tagId ? (
                  <Check
                    color={semanticColors.primary}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                ) : null}
              </TouchableOpacity>

              {sessionTags.map((tag) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between rounded-xl px-3 py-3.5"
                  key={tag.id}
                  onPress={() => void handleSelectTag(tag.id)}
                >
                  <View className="flex-row items-center">
                    <View
                      className="mr-3 h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: resolveTagColor(tag.color) }}
                    />
                    <Text className="text-[15px] font-medium text-foreground">{tag.name}</Text>
                  </View>
                  {session?.tagId === tag.id ? (
                    <Check
                      color={semanticColors.primary}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  ) : null}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                activeOpacity={0.8}
                className="mt-2 flex-row items-center rounded-xl bg-primary/10 px-4 py-3"
                onPress={() => setTagEditorVisible(true)}
              >
                <Tag
                  color={semanticColors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-3 text-[14px] font-semibold text-primary">{t.tagCreate}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <TagEditorSheet
        cancelLabel={t.cancel}
        color={tagDraftColor}
        colorLabel={t.tagColor}
        name={tagDraftName}
        placeholder={t.tagPlaceholder}
        submitLabel={t.save}
        title={t.tagCreate}
        visible={!isGroupSession && tagEditorVisible}
        onCancel={closeTagEditor}
        onChangeColor={setTagDraftColor}
        onChangeName={setTagDraftName}
        onSubmit={() => void handleCreateTag()}
      />

      <AgentSelectionSheet
        confirmLabel={t.done}
        excludedAgentIds={groupDetail?.agents?.map((agent) => agent.id) ?? []}
        title={t.groupAddMembers}
        visible={isGroupSession && addMembersVisible}
        onClose={() => setAddMembersVisible(false)}
        onSubmit={handleAddGroupMembers}
      />
    </View>
  );
}
