import { useIsFocused } from '@react-navigation/native';
import { ArrowLeft, BrainCircuit, Plus, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import { HeaderIconButton, ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { spaceApi, spaceMemoryApi } from '../lib/api';
import { type TranslationKeys, useI18n } from '../lib/i18n';
import { getResponsiveLayoutMetrics } from '../lib/responsiveLayout';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type {
  MobileSpaceItem,
  MobileSpaceMemoryCategory,
  MobileSpaceMemoryEntryPreview,
  MobileSpaceMemoryRecallFilter,
  MobileSpaceMemorySection,
  MobileSpaceMemorySummary,
} from '../types';

const SECTION_ORDER: MobileSpaceMemorySection[] = ['inbox', 'published', 'playbooks', 'policies'];
const CATEGORY_ORDER: MobileSpaceMemoryCategory[] = ['general', 'playbook', 'policy'];

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getActorName = (actor?: { name?: string | null; username?: string | null } | null) =>
  actor?.name?.trim() || actor?.username?.trim() || 'Unknown';

const getSectionLabel = (t: TranslationKeys, section: MobileSpaceMemorySection) => {
  switch (section) {
    case 'inbox': {
      return t.memorySpaceSectionInbox;
    }
    case 'playbooks': {
      return t.memorySpaceSectionPlaybooks;
    }
    case 'policies': {
      return t.memorySpaceSectionPolicies;
    }
    default: {
      return t.memorySpaceSectionPublished;
    }
  }
};

const getRecallFilterLabel = (t: TranslationKeys, filter: MobileSpaceMemoryRecallFilter) => {
  switch (filter) {
    case 'active': {
      return t.memorySpaceRecallStateActive;
    }
    case 'disabled': {
      return t.memorySpaceRecallStateDisabled;
    }
    case 'expired': {
      return t.memorySpaceRecallStateExpired;
    }
    case 'stale': {
      return t.memorySpaceRecallStateStale;
    }
    default: {
      return t.memorySpaceRecallStateAll;
    }
  }
};

const getCategoryLabel = (t: TranslationKeys, category: MobileSpaceMemoryCategory) => {
  switch (category) {
    case 'playbook': {
      return t.memorySpaceCategoryPlaybook;
    }
    case 'policy': {
      return t.memorySpaceCategoryPolicy;
    }
    default: {
      return t.memorySpaceCategoryGeneral;
    }
  }
};

const getRoleLabel = (
  t: TranslationKeys,
  role?: MobileSpaceItem['membershipRole'] | MobileSpaceMemorySummary['membershipRole'],
) => {
  switch (role) {
    case 'owner': {
      return t.memorySpaceRoleOwner;
    }
    case 'admin': {
      return t.memorySpaceRoleAdmin;
    }
    case 'editor': {
      return t.memorySpaceRoleEditor;
    }
    case 'viewer': {
      return t.memorySpaceRoleViewer;
    }
    default: {
      return null;
    }
  }
};

const getSectionCountLabel = (
  t: TranslationKeys,
  summary: MobileSpaceMemorySummary,
  section: MobileSpaceMemorySection,
) => {
  const count = summary.sections[section]?.count ?? 0;

  switch (section) {
    case 'inbox': {
      return t.memorySpaceInboxCount.replace('{count}', String(count));
    }
    case 'playbooks': {
      return t.memorySpacePlaybooksCount.replace('{count}', String(count));
    }
    case 'policies': {
      return t.memorySpacePoliciesCount.replace('{count}', String(count));
    }
    default: {
      return t.memorySpacePublishedCount.replace('{count}', String(count));
    }
  }
};

export default function SpaceMemoryScreen({
  navigation,
  route,
}: RootStackScreenProps<'SpaceMemory'>) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const toast = useToast();
  const isFocused = useIsFocused();
  const { recallFilter: initialRecallFilter, section: initialSection, spaceId } = route.params;
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const contentWidth = Math.min(Math.max(screenWidth - 32, 0), responsiveMetrics.headerMaxWidth);
  const modalWidth = Math.min(contentWidth, 560);

  const [space, setSpace] = useState<MobileSpaceItem | null>(null);
  const [summary, setSummary] = useState<MobileSpaceMemorySummary | null>(null);
  const [entries, setEntries] = useState<MobileSpaceMemoryEntryPreview[]>([]);
  const [activeSection, setActiveSection] = useState<MobileSpaceMemorySection>(
    initialSection ?? 'published',
  );
  const [recallFilter, setRecallFilter] = useState<MobileSpaceMemoryRecallFilter>(
    initialRecallFilter ?? 'all',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSummary, setCreateSummary] = useState('');
  const [createCategory, setCreateCategory] = useState<MobileSpaceMemoryCategory>('general');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [workingEntryId, setWorkingEntryId] = useState<string | null>(null);

  const refreshData = useCallback(
    async (
      overrides?: Partial<{
        recallFilter: MobileSpaceMemoryRecallFilter;
        section: MobileSpaceMemorySection;
      }>,
      options?: { showLoading?: boolean },
    ) => {
      const showLoading = options?.showLoading ?? !summary;
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      try {
        const [nextSpace, nextSummary] = await Promise.all([
          spaceApi.getById(spaceId).catch(() => null),
          spaceMemoryApi.getSummary(spaceId),
        ]);
        setSpace(nextSpace);
        setSummary(nextSummary);

        const requestedSection = overrides?.section ?? activeSection;
        const availableSections = SECTION_ORDER.filter((section) =>
          nextSummary.contract.sections.includes(section),
        );
        const normalizedSection = availableSections.includes(requestedSection)
          ? requestedSection
          : (availableSections[0] ?? 'published');

        const requestedRecallFilter = overrides?.recallFilter ?? recallFilter;
        const availableRecallFilters =
          normalizedSection === 'inbox'
            ? (['all'] as MobileSpaceMemoryRecallFilter[])
            : nextSummary.contract.recallFilters.length > 0
              ? nextSummary.contract.recallFilters
              : (['all'] as MobileSpaceMemoryRecallFilter[]);
        const normalizedRecallFilter = availableRecallFilters.includes(requestedRecallFilter)
          ? requestedRecallFilter
          : (availableRecallFilters[0] ?? 'all');

        if (normalizedSection !== activeSection) setActiveSection(normalizedSection);
        if (normalizedRecallFilter !== recallFilter) setRecallFilter(normalizedRecallFilter);

        const nextEntries = await spaceMemoryApi.listEntries(
          spaceId,
          normalizedSection,
          normalizedRecallFilter,
        );
        setEntries(nextEntries.items ?? []);
      } catch {
        setEntries([]);
        setSummary(null);
        toast.show('error', t.memorySpaceLoadFailed);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeSection, recallFilter, spaceId, summary, t.memorySpaceLoadFailed, toast],
  );

  useEffect(() => {
    if (!isFocused) return;
    void refreshData(undefined, { showLoading: true });
  }, [isFocused, refreshData]);

  const availableSections = useMemo(() => {
    if (!summary) return SECTION_ORDER;
    return SECTION_ORDER.filter((section) => summary.contract.sections.includes(section));
  }, [summary]);

  const availableRecallFilters = useMemo(() => {
    if (!summary || activeSection === 'inbox') return ['all'] as MobileSpaceMemoryRecallFilter[];
    return summary.contract.recallFilters.length > 0
      ? summary.contract.recallFilters
      : (['all'] as MobileSpaceMemoryRecallFilter[]);
  }, [activeSection, summary]);

  const currentRecallSummary = summary?.sections[activeSection]?.recall;
  const currentRoleLabel = getRoleLabel(t, summary?.membershipRole ?? space?.membershipRole);

  const openCreateModal = useCallback(() => {
    setCreateTitle('');
    setCreateSummary('');
    setCreateCategory('general');
    setCreateVisible(true);
  }, []);

  const handleCreateDraft = useCallback(async () => {
    const title = createTitle.trim();
    if (!title || createSubmitting) return;

    setCreateSubmitting(true);

    try {
      await spaceMemoryApi.createCandidate(spaceId, {
        category: createCategory,
        summary: createSummary.trim() || undefined,
        title,
      });
      setCreateVisible(false);
      setCreateTitle('');
      setCreateSummary('');
      setCreateCategory('general');
      toast.show('success', t.memorySpaceCreateSuccess);
      void refreshData({ section: 'inbox' }, { showLoading: false });
    } catch {
      toast.show('error', t.memorySpaceCreateFailed);
    } finally {
      setCreateSubmitting(false);
    }
  }, [
    createCategory,
    createSubmitting,
    createSummary,
    createTitle,
    refreshData,
    spaceId,
    t.memorySpaceCreateFailed,
    t.memorySpaceCreateSuccess,
    toast,
  ]);

  const runEntryAction = useCallback(
    async (
      action: 'merge' | 'publish' | 'reject' | 'revalidate' | 'stale',
      entry: MobileSpaceMemoryEntryPreview,
    ) => {
      if (workingEntryId) return;

      setWorkingEntryId(entry.id);

      try {
        switch (action) {
          case 'merge': {
            const match =
              entry.reviewHint?.kind === 'duplicate_published' ? entry.reviewHint.match : null;
            if (!match) throw new Error('merge target missing');

            await spaceMemoryApi.mergeEntry(spaceId, {
              candidateId: entry.id,
              merge: {
                appendSources: (entry.reviewHint?.mergePreview.addedSourceCount ?? 0) > 0,
                applyContent: entry.reviewHint?.mergePreview.updatesContent ?? false,
                applySummary: entry.reviewHint?.mergePreview.updatesSummary ?? false,
                applyTitle: entry.reviewHint?.mergePreview.updatesTitle ?? false,
              },
              targetEntryId: match.id,
            });
            toast.show('success', t.memorySpaceMergeSuccess);
            break;
          }
          case 'publish': {
            await spaceMemoryApi.publishEntry(spaceId, entry.id);
            toast.show('success', t.memorySpacePublishSuccess);
            break;
          }
          case 'reject': {
            await spaceMemoryApi.rejectEntry(spaceId, entry.id);
            toast.show('success', t.memorySpaceRejectSuccess);
            break;
          }
          case 'revalidate': {
            await spaceMemoryApi.revalidateEntry(spaceId, entry.id);
            toast.show('success', t.memorySpaceRevalidateSuccess);
            break;
          }
          case 'stale': {
            await spaceMemoryApi.markEntryStale(spaceId, entry.id);
            toast.show('success', t.memorySpaceMarkNeedsReviewSuccess);
            break;
          }
        }

        await refreshData(undefined, { showLoading: false });
      } catch {
        toast.show('error', t.memorySpaceReviewActionFailed);
      } finally {
        setWorkingEntryId(null);
      }
    },
    [
      refreshData,
      spaceId,
      t.memorySpaceMarkNeedsReviewSuccess,
      t.memorySpaceMergeSuccess,
      t.memorySpacePublishSuccess,
      t.memorySpaceRejectSuccess,
      t.memorySpaceReviewActionFailed,
      t.memorySpaceRevalidateSuccess,
      toast,
      workingEntryId,
    ],
  );

  const renderEntry = useCallback(
    ({ item }: { item: MobileSpaceMemoryEntryPreview }) => {
      const isWorking = workingEntryId === item.id;
      const recallBlockedReason = item.recall?.recallBlockedReason ?? null;
      const publishedAt = formatDate(item.publishedAt);
      const updatedAt = formatDate(item.updatedAt);
      const actorName = getActorName(item.actor);
      const match = item.reviewHint?.kind === 'duplicate_published' ? item.reviewHint.match : null;

      return (
        <View style={{ width: contentWidth }}>
          <View
            className="mb-3 rounded-2xl border px-4 py-4"
            style={{
              backgroundColor: colors.fillQuaternary,
              borderColor: colors.borderSubtle,
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="mr-3 flex-1">
                <Text className="text-[16px] font-semibold text-foreground" numberOfLines={2}>
                  {item.title}
                </Text>
                <View className="mt-2 flex-row flex-wrap items-center" style={{ gap: 6 }}>
                  <View
                    className="rounded-full px-2 py-1"
                    style={{
                      backgroundColor:
                        item.kind === 'candidate' ? `${colors.primary}20` : `${colors.success}20`,
                    }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: item.kind === 'candidate' ? colors.primary : colors.success }}
                    >
                      {item.kind === 'candidate'
                        ? t.memorySpaceEntryCandidate
                        : t.memorySpaceEntryMemory}
                    </Text>
                  </View>
                  {item.category !== 'general' ? (
                    <View
                      className="rounded-full px-2 py-1"
                      style={{ backgroundColor: colors.fillTertiary }}
                    >
                      <Text
                        className="text-[11px] font-medium"
                        style={{ color: colors.secondaryText }}
                      >
                        {getCategoryLabel(t, item.category)}
                      </Text>
                    </View>
                  ) : null}
                  {recallBlockedReason ? (
                    <View
                      className="rounded-full px-2 py-1"
                      style={{ backgroundColor: `${colors.warning}20` }}
                    >
                      <Text className="text-[11px] font-medium" style={{ color: colors.warning }}>
                        {getRecallFilterLabel(t, recallBlockedReason)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {isWorking ? <ActivityIndicator color={colors.primary} size="small" /> : null}
            </View>

            {item.summary ? (
              <Text
                className="mt-3 text-[14px] leading-6"
                numberOfLines={4}
                style={{ color: colors.secondaryText }}
              >
                {item.summary}
              </Text>
            ) : item.content ? (
              <Text
                className="mt-3 text-[14px] leading-6"
                numberOfLines={4}
                style={{ color: colors.secondaryText }}
              >
                {item.content}
              </Text>
            ) : null}

            <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 10 }}>
              <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                {t.memorySpaceSourceCount.replace('{count}', String(item.sourceCount))}
              </Text>
              {updatedAt ? (
                <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                  {t.memorySpaceUpdatedAt.replace('{date}', updatedAt)}
                </Text>
              ) : null}
              {publishedAt ? (
                <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                  {t.memorySpacePublishedAt.replace('{date}', publishedAt)}
                </Text>
              ) : null}
              <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                {t.memorySpaceActor.replace('{name}', actorName)}
              </Text>
            </View>

            {match ? (
              <View
                className="mt-3 rounded-xl border px-3 py-3"
                style={{
                  backgroundColor: colors.primarySubtle,
                  borderColor: colors.primaryBorder,
                }}
              >
                <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
                  {t.memorySpaceReviewHintTitle}
                </Text>
                <Text
                  className="mt-1 text-[13px] leading-5"
                  style={{ color: colors.secondaryText }}
                >
                  {t.memorySpaceReviewHintMatchTitle.replace('{name}', match.title)}
                </Text>
                <Text
                  className="mt-1 text-[13px] leading-5"
                  style={{ color: colors.secondaryText }}
                >
                  {t.memorySpaceReviewHintDesc}
                </Text>
              </View>
            ) : null}

            <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
              {item.kind === 'candidate' && summary?.canReview ? (
                <>
                  {match ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      className="rounded-full px-3 py-2"
                      disabled={Boolean(workingEntryId)}
                      style={{ backgroundColor: colors.fillTertiary }}
                      onPress={() => void runEntryAction('merge', item)}
                    >
                      <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                        {t.memorySpaceMergeAction}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="rounded-full px-3 py-2"
                    disabled={Boolean(workingEntryId)}
                    style={{ backgroundColor: colors.primary }}
                    onPress={() => void runEntryAction('publish', item)}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: colors.iconOnPrimary }}
                    >
                      {t.memorySpacePublishAction}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="rounded-full px-3 py-2"
                    disabled={Boolean(workingEntryId)}
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={() => void runEntryAction('reject', item)}
                  >
                    <Text className="text-[12px] font-semibold" style={{ color: colors.danger }}>
                      {t.memorySpaceRejectAction}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
              {item.kind === 'memory' && summary?.contract.canManageRecall ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="rounded-full px-3 py-2"
                    disabled={Boolean(workingEntryId)}
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={() => void runEntryAction('revalidate', item)}
                  >
                    <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                      {t.memorySpaceRevalidateAction}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="rounded-full px-3 py-2"
                    disabled={Boolean(workingEntryId)}
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={() => void runEntryAction('stale', item)}
                  >
                    <Text className="text-[12px] font-semibold" style={{ color: colors.warning }}>
                      {t.memorySpaceMarkNeedsReviewAction}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </View>
      );
    },
    [
      colors.borderSubtle,
      colors.danger,
      colors.fillQuaternary,
      colors.fillTertiary,
      colors.iconOnPrimary,
      colors.primary,
      colors.primaryBorder,
      colors.primarySubtle,
      colors.secondaryText,
      colors.success,
      colors.warning,
      runEntryAction,
      summary?.canReview,
      summary?.contract.canManageRecall,
      t,
      workingEntryId,
    ],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        subtitle={t.memorySpacesDesc}
        title={space?.name?.trim() || t.memorySpacesTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightActions={
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <HeaderIconButton
              accessibilityLabel={t.retry}
              onPress={() => void refreshData(undefined, { showLoading: !summary })}
            >
              <RefreshCw color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </HeaderIconButton>
            {summary?.canCreate ? (
              <HeaderIconButton
                accessibilityLabel={t.memorySpaceCreateAction}
                onPress={openCreateModal}
              >
                <Plus color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              </HeaderIconButton>
            ) : null}
          </View>
        }
        onPressLeft={() => navigation.goBack()}
      >
        <View className="self-center pb-3" style={{ width: contentWidth }}>
          <View
            className="rounded-2xl border px-4 py-4"
            style={{
              backgroundColor: colors.fillQuaternary,
              borderColor: colors.borderSubtle,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="mr-3 flex-1">
                <Text className="text-[16px] font-semibold text-foreground">
                  {space?.name?.trim() || t.memorySpaceBrowse}
                </Text>
                <Text
                  className="mt-1 text-[13px] leading-5"
                  style={{ color: colors.secondaryText }}
                >
                  {t.memorySpacesDesc}
                </Text>
              </View>
              <View
                className="items-center justify-center rounded-2xl"
                style={{ backgroundColor: colors.primarySubtle, height: 40, width: 40 }}
              >
                <BrainCircuit
                  color={colors.primary}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </View>
            </View>

            <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
              {currentRoleLabel ? (
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: colors.fillTertiary }}
                >
                  <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                    {currentRoleLabel}
                  </Text>
                </View>
              ) : null}
              {summary?.canCreate ? (
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${colors.primary}18` }}
                >
                  <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                    {t.memorySpaceCanCreate}
                  </Text>
                </View>
              ) : null}
              {summary?.canReview ? (
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${colors.warning}18` }}
                >
                  <Text className="text-[11px] font-medium" style={{ color: colors.warning }}>
                    {t.memorySpaceCanReview}
                  </Text>
                </View>
              ) : null}
            </View>

            {summary ? (
              <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
                {availableSections.map((section) => (
                  <View
                    className="rounded-full px-2.5 py-1"
                    key={section}
                    style={{ backgroundColor: colors.fillTertiary }}
                  >
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.secondaryText }}
                    >
                      {getSectionCountLabel(t, summary, section)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View className="self-center" style={{ width: contentWidth }}>
          <ScrollView
            horizontal
            className="max-h-[44px]"
            contentContainerStyle={{ gap: 8 }}
            showsHorizontalScrollIndicator={false}
          >
            {availableSections.map((section) => {
              const active = activeSection === section;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="rounded-full px-4 py-2"
                  key={section}
                  style={{ backgroundColor: active ? colors.primary : colors.fillTertiary }}
                  onPress={() => {
                    setActiveSection(section);
                    void refreshData({ section }, { showLoading: false });
                  }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: active ? colors.iconOnPrimary : colors.secondaryText }}
                  >
                    {getSectionLabel(t, section)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {activeSection !== 'inbox' && availableRecallFilters.length > 1 ? (
          <View className="self-center" style={{ width: contentWidth }}>
            <ScrollView
              horizontal
              className="max-h-[40px] pb-1 pt-3"
              contentContainerStyle={{ gap: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {availableRecallFilters.map((filter) => {
                const active = recallFilter === filter;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="rounded-full px-3.5 py-1.5"
                    key={filter}
                    style={{ backgroundColor: active ? colors.primarySubtle : colors.fillTertiary }}
                    onPress={() => {
                      setRecallFilter(filter);
                      void refreshData({ recallFilter: filter }, { showLoading: false });
                    }}
                  >
                    <Text
                      className="text-[12px] font-medium"
                      style={{ color: active ? colors.primary : colors.secondaryText }}
                    >
                      {getRecallFilterLabel(t, filter)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {summary && currentRecallSummary && activeSection !== 'inbox' ? (
          <View className="self-center" style={{ width: contentWidth }}>
            <ScrollView
              horizontal
              className="max-h-[38px] pb-2 pt-2"
              contentContainerStyle={{ gap: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                  {t.memorySpaceRecallActive.replace(
                    '{count}',
                    String(currentRecallSummary.active),
                  )}
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                  {t.memorySpaceRecallDisabled.replace(
                    '{count}',
                    String(currentRecallSummary.disabled),
                  )}
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                  {t.memorySpaceRecallExpired.replace(
                    '{count}',
                    String(currentRecallSummary.expired),
                  )}
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                  {t.memorySpaceRecallStale.replace('{count}', String(currentRecallSummary.stale))}
                </Text>
              </View>
            </ScrollView>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : !summary ? (
          <View className="flex-1 items-center justify-center px-6">
            <View style={{ width: contentWidth }}>
              <EmptyState
                description={t.memorySpaceLoadFailed}
                iconVariant="memory"
                title={t.memorySpaceSummaryUnavailable}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                className="mt-4 rounded-full px-4 py-2 self-center"
                style={{ backgroundColor: colors.primary }}
                onPress={() => void refreshData(undefined, { showLoading: true })}
              >
                <Text className="text-[13px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                  {t.memorySpaceSummaryRetry}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderEntry}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ width: contentWidth }}>
                <EmptyState
                  description={t.memorySpaceEntriesEmptyDesc}
                  iconVariant="memory"
                  title={t.memorySpaceEntriesEmpty}
                />
              </View>
            }
            contentContainerStyle={{
              alignItems: 'center',
              flexGrow: entries.length === 0 ? 1 : undefined,
              justifyContent: entries.length === 0 ? 'center' : undefined,
              paddingBottom: 120,
              paddingTop: 12,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={colors.primary}
                onRefresh={() => void refreshData(undefined, { showLoading: false })}
              />
            }
          />
        )}

        <Modal
          accessibilityViewIsModal
          transparent
          animationType="slide"
          visible={createVisible}
          onRequestClose={() => {
            if (createSubmitting) return;
            setCreateVisible(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1 justify-end bg-black/40 px-5"
            onPress={() => {
              if (createSubmitting) return;
              setCreateVisible(false);
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="rounded-t-2xl bg-card px-5 pb-6 pt-4"
              style={{ alignSelf: 'center', maxWidth: modalWidth, width: '100%' }}
              onPress={(event) => event.stopPropagation()}
            >
              <Text className="text-[18px] font-bold text-foreground">
                {t.memorySpaceCreateAction}
              </Text>
              <TextInput
                autoFocus
                className="mt-4 rounded-xl px-4 py-3 text-[16px] text-foreground"
                editable={!createSubmitting}
                placeholder={t.memoryCreateTitlePlaceholder}
                placeholderTextColor={colors.muted}
                style={{ backgroundColor: colors.fillTertiary }}
                value={createTitle}
                onChangeText={setCreateTitle}
              />
              <TextInput
                multiline
                className="mt-3 rounded-xl px-4 py-3 text-[15px] text-foreground"
                editable={!createSubmitting}
                numberOfLines={4}
                placeholder={t.memoryCreateSummaryPlaceholder}
                placeholderTextColor={colors.muted}
                value={createSummary}
                style={{
                  backgroundColor: colors.fillTertiary,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                onChangeText={setCreateSummary}
              />
              <ScrollView
                horizontal
                className="max-h-[40px] pt-3"
                contentContainerStyle={{ gap: 8 }}
                showsHorizontalScrollIndicator={false}
              >
                {CATEGORY_ORDER.map((category) => {
                  const active = createCategory === category;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      className="rounded-full px-3.5 py-1.5"
                      key={category}
                      style={{
                        backgroundColor: active ? colors.primarySubtle : colors.fillTertiary,
                      }}
                      onPress={() => setCreateCategory(category)}
                    >
                      <Text
                        className="text-[12px] font-medium"
                        style={{ color: active ? colors.primary : colors.secondaryText }}
                      >
                        {getCategoryLabel(t, category)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View className="mt-4 flex-row" style={{ gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  className="flex-1 items-center rounded-xl py-3"
                  style={{ backgroundColor: colors.fillTertiary }}
                  onPress={() => setCreateVisible(false)}
                >
                  <Text className="text-[15px] font-medium" style={{ color: colors.secondaryText }}>
                    {t.cancel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="flex-1 items-center rounded-xl py-3"
                  disabled={!createTitle.trim() || createSubmitting}
                  style={{
                    backgroundColor:
                      !createTitle.trim() || createSubmitting
                        ? colors.fillQuaternary
                        : colors.primary,
                  }}
                  onPress={handleCreateDraft}
                >
                  {createSubmitting ? (
                    <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                  ) : (
                    <Text
                      className="text-[15px] font-semibold"
                      style={{ color: colors.iconOnPrimary }}
                    >
                      {t.memorySpaceCreateAction}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </ScreenHeader>
    </View>
  );
}
