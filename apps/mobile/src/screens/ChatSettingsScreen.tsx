/**
 * ChatSettingsScreen — session-level settings only.
 * Agent management is handled in Agent screens.
 */
import { ArrowLeft, Check, ChevronRight, Tag } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AgentSelectionSheet from '../components/ui/AgentSelectionSheet';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { TagEditorSheet } from '../components/ui/TagEditorSheet';
import { useToast } from '../components/ui/Toast';
import { resolveTagColor, withAlpha } from '../constants/tags';
import {
  AgentSection,
  DangerZoneSection,
  DEFAULT_PARAMS,
  GroupSettingsSection,
  ParamsSection,
  SessionHeaderSection,
  TagSection,
  toParamsPatch,
  toParamsState,
} from '../features/ChatSettings';
import { useAgentConfig } from '../hooks/useAgentConfig';
import { agentApi, agentGroupApi, type AgentGroupDetail, sessionApi, tagApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { navigateToLogin } from '../lib/navigation';
import { isGroupSessionLike } from '../lib/session';
import type { RootStackScreenProps } from '../navigation/types';
import { useChatStore } from '../store/chat';
import { useSessionStore } from '../store/session';
import { useTopicStore } from '../store/topic';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { ChatMessage, Tag as TagItem } from '../types';

const sortTags = (tags: TagItem[]) =>
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

const extractPersistedMessageIds = (messages: ChatMessage[]) =>
  messages
    .map((message) => message.id)
    .filter(
      (id) =>
        !id.startsWith('assistant-') &&
        !id.startsWith('local-') &&
        !id.startsWith('tmp_') &&
        !id.startsWith('user-'),
    );

const splitLineList = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

function SectionCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View className="mx-5 mb-5">
      <Text className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wider text-secondary/60">
        {title}
      </Text>
      <View className="rounded-xl bg-foreground/[0.02] p-4">{children}</View>
    </View>
  );
}

export default function ChatSettingsScreen({
  route,
  navigation,
}: RootStackScreenProps<'ChatSettings'>) {
  const colors = useThemeColors();
  const sessionId = route.params.sessionId;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const isGroupSession = isGroupSessionLike(sessionId, session?.type);
  const removeSession = useSessionStore((s) => s.removeSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const updateSessionTitle = useSessionStore((s) => s.updateSessionTitle);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const rawMessages = useChatStore((s) => s.messagesBySession[sessionId] ?? []);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const createTopic = useTopicStore((s) => s.createTopic);
  const updateTopicTag = useTopicStore((s) => s.updateTopicTag);
  const topicsBySession = useTopicStore((s) => s.topicsBySession);
  const activeTopicBySession = useTopicStore((s) => s.activeTopicBySession);

  const { config: agentConfig, invalidate } = useAgentConfig(
    sessionId,
    !isGroupSession && !!sessionId,
  );
  const agentSummary =
    agentConfig && agentConfig.id
      ? {
          avatar: agentConfig.avatar ?? undefined,
          description: agentConfig.description ?? undefined,
          title: agentConfig.title ?? undefined,
        }
      : null;
  const [tagSelectorVisible, setTagSelectorVisible] = useState(false);
  const [tagEditorVisible, setTagEditorVisible] = useState(false);
  const [tags, setTags] = useState<TagItem[]>([]);
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
  const [supervisorModelDrawerVisible, setSupervisorModelDrawerVisible] = useState(false);
  const [params, setParams] = useState(DEFAULT_PARAMS);

  useEffect(() => {
    if (agentConfig) setParams(toParamsState(agentConfig));
  }, [agentConfig]);

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

  const fetchTags = useCallback(async () => {
    if (isGroupSession) return;

    try {
      const list = await tagApi.list();
      setTags(sortTags(list ?? []));
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [isGroupSession, t.errorNetwork, toast]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    if (!sessionId || isGroupSession) return;
    void fetchTopics(sessionId);
  }, [fetchTopics, isGroupSession, sessionId]);

  const currentTopic = useMemo(() => {
    if (!sessionId) return null;

    const sessionTopics = topicsBySession[sessionId] ?? [];
    if (sessionTopics.length === 0) return null;

    const activeTopicId = activeTopicBySession[sessionId];
    if (activeTopicId) {
      const matched = sessionTopics.find((topic) => topic.id === activeTopicId);
      if (matched) return matched;
    }

    return sessionTopics[0];
  }, [activeTopicBySession, sessionId, topicsBySession]);

  const currentTag = useMemo(
    () => tags.find((tag) => tag.id === currentTopic?.tagId),
    [currentTopic?.tagId, tags],
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

      // Save params: session-only → sessionApi; has agent → agentApi
      const paramsPatch = toParamsPatch(params);
      if (agentConfig?.id) {
        await agentApi.updateConfig(agentConfig.id, { params: paramsPatch });
        invalidate();
      } else {
        await sessionApi.updateSessionConfig(sessionId, { params: paramsPatch });
        invalidate();
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

  const handleSupervisorModelSelect = useCallback(
    async (modelId: string, providerId: string) => {
      const supervisorId = groupDetail?.supervisorAgentId;
      if (!supervisorId) return;

      try {
        await agentApi.updateConfig(supervisorId, { model: modelId, provider: providerId });
        haptics.success();
        await loadGroupDetail();
      } catch {
        toast.show('error', t.errorSaveFailed);
      }
    },
    [groupDetail?.supervisorAgentId, loadGroupDetail, t.errorSaveFailed, toast],
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
        onPress: async () => {
          try {
            await clearMessages(sessionId);
            haptics.success();
          } catch {
            /* error already shown by store */
          }
        },
      },
    ]);
  };

  const handleSelectTag = useCallback(
    async (tagId?: string | null) => {
      if (!sessionId) return;

      try {
        let targetTopic = currentTopic;
        if (!targetTopic) {
          const messageIds = extractPersistedMessageIds(rawMessages);
          const created = await createTopic(sessionId, t.chatListNewConversation, {
            ...(messageIds.length > 0 ? { messageIds } : {}),
          });
          if (!created) {
            toast.show('error', t.errorNetwork);
            return;
          }
          targetTopic = created;
        }

        await updateTopicTag(targetTopic.id, sessionId, tagId);
        setTagSelectorVisible(false);
        haptics.success();
      } catch (err) {
        const { messageKey, type } = classifyError(err);
        toast.show('error', t[messageKey], {
          onRetry: type === 'auth' ? navigateToLogin : undefined,
          retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
        });
      }
    },
    [createTopic, currentTopic, rawMessages, sessionId, t, toast, updateTopicTag],
  );

  const handleCreateTag = useCallback(async () => {
    if (!sessionId) return;

    const name = tagDraftName.trim();
    if (!name) {
      toast.show('error', t.errorUnknown);
      return;
    }

    try {
      const newTagId = await tagApi.create(name, tagDraftColor);
      if (!newTagId) {
        toast.show('error', t.errorNetwork);
        return;
      }

      await fetchTags();
      await handleSelectTag(newTagId);
      closeTagEditor();
      setTagSelectorVisible(false);
      haptics.success();
    } catch (err) {
      const { messageKey, type } = classifyError(err);
      toast.show('error', t[messageKey], {
        onRetry: type === 'auth' ? navigateToLogin : undefined,
        retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
      });
    }
  }, [
    closeTagEditor,
    fetchTags,
    handleSelectTag,
    sessionId,
    t,
    tagDraftColor,
    tagDraftName,
    toast,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
    >
      <ScreenHeader
        rightAccessibilityHint={t.accessibilityHintSave}
        rightAccessibilityLabel={t.accessibilitySave}
        title={t.chatSettingsTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightElement={
          saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text className="font-medium text-[15px]" style={{ color: colors.primary }}>
              {t.save}
            </Text>
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <SessionHeaderSection
          delay={50}
          description={groupDescription}
          isGroupSession={isGroupSession}
          title={title}
          onDescriptionChange={isGroupSession ? setGroupDescription : undefined}
          onTitleChange={setTitle}
        />

        {isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(60).duration(300)}>
            <TouchableOpacity
              activeOpacity={0.8}
              className="mx-5 mt-4 flex-row items-center justify-center rounded-xl py-3"
              style={{ backgroundColor: colors.primary }}
              onPress={() => {
                haptics.light();
                navigation.replace('ChatDetail', { sessionId });
              }}
            >
              <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                {t.groupStartConversation}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {!isGroupSession ? (
          <TagSection
            currentTag={currentTag}
            delay={90}
            onPress={() => setTagSelectorVisible(true)}
          />
        ) : null}

        {!isGroupSession ? (
          <AgentSection
            agentSummary={agentSummary}
            delay={100}
            onPress={() => navigation.navigate('AgentConfig', { sessionId })}
          />
        ) : null}

        {!isGroupSession ? (
          <ParamsSection delay={110} params={params} onParamsChange={setParams} />
        ) : null}

        {isGroupSession ? (
          <GroupSettingsSection
            allowDM={groupAllowDM}
            delay={100}
            loading={groupLoading}
            revealDM={groupRevealDM}
            config={{
              openingMessage: groupOpeningMessage,
              openingQuestions: groupOpeningQuestions,
              systemPrompt: groupSystemPrompt,
            }}
            onAllowDMChange={setGroupAllowDM}
            onOpeningMessageChange={setGroupOpeningMessage}
            onOpeningQuestionsChange={setGroupOpeningQuestions}
            onRevealDMChange={setGroupRevealDM}
            onSystemPromptChange={setGroupSystemPrompt}
          />
        ) : null}

        {isGroupSession ? (
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <SectionCard title={t.groupSettingsMembers}>
              {groupLoading ? (
                <View className="items-center justify-center py-6">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : groupDetail?.agents?.length ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="mb-3 self-start rounded-xl px-3 py-2"
                    style={{ backgroundColor: colors.primarySubtle }}
                    onPress={() => setAddMembersVisible(true)}
                  >
                    <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
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

                    const RowWrapper = member.isSupervisor ? TouchableOpacity : View;
                    const rowProps = member.isSupervisor
                      ? {
                          activeOpacity: 0.75,
                          onPress: () => {
                            haptics.light();
                            setSupervisorModelDrawerVisible(true);
                          },
                        }
                      : {};

                    return (
                      <RowWrapper
                        key={member.id}
                        {...rowProps}
                        className={`flex-row items-center rounded-xl bg-foreground/[0.04] px-4 py-3 ${
                          index === (groupDetail.agents?.length ?? 0) - 1 ? '' : 'mb-3'
                        }`}
                      >
                        <View
                          className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
                          style={{ backgroundColor: colors.primarySubtle }}
                        >
                          <Text
                            className="text-[16px] font-semibold"
                            style={{ color: colors.primary }}
                          >
                            {avatarText}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="text-[14px] font-semibold text-foreground">
                              {member.title || t.settingsDefaultAgent}
                            </Text>
                            {member.isSupervisor ? (
                              <View
                                className="ml-2 rounded-full px-2 py-0.5"
                                style={{ backgroundColor: colors.primarySubtle }}
                              >
                                <Text
                                  className="text-[11px] font-semibold"
                                  style={{ color: colors.primary }}
                                >
                                  {t.groupSettingsSupervisor}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                            {memberSummary}
                          </Text>
                        </View>
                        {member.isSupervisor ? (
                          <ChevronRight
                            color={colors.secondaryText}
                            size={18}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        ) : !member.isSupervisor ? (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            className="ml-3 rounded-xl px-3 py-2"
                            style={{ backgroundColor: withAlpha(colors.danger, '14') }}
                            onPress={() => handleRemoveGroupMember(member.id)}
                          >
                            <Text
                              className="text-[12px] font-semibold"
                              style={{ color: colors.danger }}
                            >
                              {t.delete}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </RowWrapper>
                    );
                  })}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="mb-3 self-start rounded-xl px-3 py-2"
                    style={{ backgroundColor: colors.primarySubtle }}
                    onPress={() => setAddMembersVisible(true)}
                  >
                    <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
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

        <DangerZoneSection
          delay={150}
          onClearHistory={handleClearHistory}
          onDeleteChat={handleDeleteChat}
        />
      </ScrollView>

      <Modal
        accessibilityViewIsModal
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
            className="rounded-t-2xl bg-card"
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
                    style={{ backgroundColor: colors.secondaryText }}
                  />
                  <Text className="text-[15px] font-medium text-foreground">{t.tagNone}</Text>
                </View>
                {!currentTopic?.tagId ? (
                  <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                ) : null}
              </TouchableOpacity>

              {tags.map((tag) => (
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
                  {currentTopic?.tagId === tag.id ? (
                    <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  ) : null}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                activeOpacity={0.8}
                className="mt-2 flex-row items-center rounded-xl px-4 py-3"
                style={{ backgroundColor: colors.primarySubtle }}
                onPress={() => setTagEditorVisible(true)}
              >
                <Tag color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-[14px] font-semibold" style={{ color: colors.primary }}>
                  {t.tagCreate}
                </Text>
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

      {isGroupSession && groupDetail?.supervisorAgentId ? (
        <ModelDrawer
          persistSelection={false}
          visible={supervisorModelDrawerVisible}
          initialModel={
            groupDetail.agents?.find((a) => a.id === groupDetail.supervisorAgentId)?.model
          }
          initialProvider={
            groupDetail.agents?.find((a) => a.id === groupDetail.supervisorAgentId)?.provider
          }
          onClose={() => setSupervisorModelDrawerVisible(false)}
          onSelect={handleSupervisorModelSelect}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
