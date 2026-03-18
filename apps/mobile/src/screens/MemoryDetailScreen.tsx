/**
 * MemoryDetailScreen — Full-screen detail view for a single memory item.
 *
 * Uses the backend detail endpoint so mobile can show the same source/tag/category
 * metadata as the web side while keeping inline edit/delete support.
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Calendar,
  ChevronLeft,
  Clock,
  Edit3,
  ExternalLink,
  Link2,
  MapPin,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memoryApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type {
  MemoryActivityDetail,
  MemoryActivityItem,
  MemoryBaseDetail,
  MemoryContextDetail,
  MemoryContextItem,
  MemoryDetail,
  MemoryExperienceDetail,
  MemoryExperienceItem,
  MemoryIdentityDetail,
  MemoryIdentityItem,
  MemoryLayer,
  MemoryPreferenceDetail,
  MemoryPreferenceItem,
  MemorySource,
} from '../types';

type AnyMemoryItem =
  | MemoryActivityItem
  | MemoryContextItem
  | MemoryExperienceItem
  | MemoryIdentityItem
  | MemoryPreferenceItem;

const LAYER_COLORS: Record<MemoryLayer, string> = {
  activity: '#f59e0b',
  context: '#8b5cf6',
  experience: '#10b981',
  identity: '#3b82f6',
  preference: '#ec4899',
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatScore(value?: number | null) {
  if (value === undefined || value === null) return undefined;
  if (value <= 1) return `${Math.round(value * 100)}%`;

  return String(value);
}

function getDetailEntity(detail: MemoryDetail): AnyMemoryItem {
  switch (detail.layer) {
    case 'activity': {
      return (detail as MemoryActivityDetail).activity;
    }
    case 'context': {
      return (detail as MemoryContextDetail).context;
    }
    case 'experience': {
      return (detail as MemoryExperienceDetail).experience;
    }
    case 'identity': {
      return (detail as MemoryIdentityDetail).identity;
    }
    case 'preference': {
      return (detail as MemoryPreferenceDetail).preference;
    }
  }
}

function FieldSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </Text>
      {children}
    </View>
  );
}

function FieldText({ value }: { value?: string | null }) {
  if (!value) return <Text className="text-sm text-gray-300">—</Text>;

  return <Text className="text-sm leading-5 text-gray-700">{value}</Text>;
}

function EditableField({
  editing,
  label,
  multiline,
  onChangeText,
  value,
}: {
  editing: boolean;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <FieldSection label={label}>
      {editing ? (
        <TextInput
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
          multiline={multiline}
          style={multiline ? { minHeight: 80, textAlignVertical: 'top' } : undefined}
          value={value}
          onChangeText={onChangeText}
        />
      ) : (
        <FieldText value={value || undefined} />
      )}
    </FieldSection>
  );
}

function MetaChip({ color, label, subtle }: { color: string; label: string; subtle?: boolean }) {
  const colors = useThemeColors();
  return (
    <View
      className="mr-2 rounded-full px-2.5 py-1"
      style={{ backgroundColor: subtle ? colors.fillTertiary : `${color}15` }}
    >
      <Text className="text-xs font-semibold" style={{ color: subtle ? colors.secondaryText : color }}>
        {label}
      </Text>
    </View>
  );
}

function TagList({ color, tags }: { color: string; tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-2">
      {tags.map((tag) => (
        <View
          className="flex-row items-center rounded-full px-2.5 py-1"
          key={tag}
          style={{ backgroundColor: `${color}12` }}
        >
          <Tag color={color} size={10} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="ml-1 text-xs font-medium" style={{ color }}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ScoreBadge({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: number | null;
}) {
  const formatted = formatScore(value);
  if (!formatted) return null;

  return (
    <View
      className="mb-2 mr-2 items-center rounded-xl px-3 py-2"
      style={{ backgroundColor: `${color}10` }}
    >
      <Text className="text-lg font-bold" style={{ color }}>
        {formatted}
      </Text>
      <Text className="mt-0.5 text-[10px] text-gray-400">{label}</Text>
    </View>
  );
}

function SourceCard({
  canOpen,
  onPress,
  source,
  sourceLabel,
  subtitle,
}: {
  canOpen: boolean;
  onPress: () => void;
  source?: MemorySource | null;
  sourceLabel: string;
  subtitle?: string;
}) {
  const colors = useThemeColors();
  if (!source) return null;

  const title = source.title || source.id;

  return (
    <FieldSection label={sourceLabel}>
      <TouchableOpacity
        activeOpacity={canOpen ? 0.7 : 1}
        className="flex-row items-center rounded-xl bg-gray-100 px-4 py-3"
        disabled={!canOpen}
        onPress={onPress}
      >
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-white">
          {canOpen ? (
            <Link2 color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
          ) : (
            <ExternalLink
              color={colors.secondaryText}
              size={16}
              strokeWidth={tokens.icon.strokeWidth}
            />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {canOpen ? (
          <ExternalLink
            color={colors.secondaryText}
            size={14}
            strokeWidth={tokens.icon.strokeWidth}
          />
        ) : null}
      </TouchableOpacity>
    </FieldSection>
  );
}

export default function MemoryDetailScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const initialItem = route.params?.item as AnyMemoryItem | undefined;
  const layer = route.params?.layer as MemoryLayer | undefined;
  const itemId = initialItem?.id;

  const layerColor = layer ? LAYER_COLORS[layer] : '#6b7280';

  const [editing, setEditing] = useState(false);
  const [itemState, setItemState] = useState<AnyMemoryItem | undefined>(initialItem);
  const [memoryState, setMemoryState] = useState<MemoryBaseDetail | null>(null);
  const [detailState, setDetailState] = useState<MemoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [refreshingDetail, setRefreshingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editState, setEditState] = useState<Record<string, string>>({});

  const applyDetail = useCallback((detail: MemoryDetail) => {
    setDetailState(detail);
    setMemoryState(detail.memory);
    setItemState(getDetailEntity(detail));
  }, []);

  const loadDetail = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!itemId || !layer) {
        setLoadingDetail(false);
        return;
      }

      if (options?.silent) {
        setRefreshingDetail(true);
      } else {
        setLoadingDetail(true);
      }

      try {
        const detail = await memoryApi.getMemoryDetail(itemId, layer);
        if (detail) {
          applyDetail(detail);
        }
      } catch {
        /* best-effort fallback to route param */
      } finally {
        setLoadingDetail(false);
        setRefreshingDetail(false);
      }
    },
    [applyDetail, itemId, layer],
  );

  useEffect(() => {
    if (!itemId || !layer) {
      nav.goBack();
      return;
    }

    void loadDetail();
  }, [itemId, layer, loadDetail, nav]);

  const setField = (key: string) => (value: string) =>
    setEditState((prev) => ({ ...prev, [key]: value }));

  const resolvedType = useMemo(
    () =>
      (itemState as any)?.type ||
      memoryState?.memoryCategory ||
      memoryState?.memoryType ||
      undefined,
    [itemState, memoryState],
  );

  const resolvedTags = useMemo(() => {
    const layerTags = ((itemState as any)?.tags as string[] | undefined) || [];

    return layerTags.length > 0 ? layerTags : memoryState?.tags || [];
  }, [itemState, memoryState]);

  const resolvedSummary = useMemo(() => {
    if (layer === 'identity') {
      const identity = itemState as MemoryIdentityItem | undefined;

      return memoryState?.summary || identity?.summary || identity?.description || '';
    }

    return memoryState?.summary || '';
  }, [itemState, layer, memoryState]);

  const source = detailState?.source;
  const canOpenSource =
    detailState?.sourceType === 'chat_topic' && !!source?.sessionId && !!source?.id;

  const sourceSubtitle = useMemo(() => {
    if (!source) return undefined;

    if (detailState?.sourceType === 'chat_topic') {
      return source.sessionId ? `${t.topicTitle} • ${source.sessionId}` : t.topicTitle;
    }

    return detailState?.sourceType || undefined;
  }, [detailState?.sourceType, source, t.topicTitle]);

  const startEdit = useCallback(() => {
    if (!itemState || !layer) return;

    const fields: Record<string, string> = {};

    switch (layer) {
      case 'identity': {
        fields.title = (itemState as any).title || memoryState?.title || '';
        fields.summary = resolvedSummary;
        break;
      }
      case 'context': {
        const context = itemState as MemoryContextItem;
        fields.title = context.title || '';
        fields.description = context.description || '';
        fields.currentStatus = context.currentStatus || '';
        break;
      }
      case 'activity': {
        const activity = itemState as MemoryActivityItem;
        fields.narrative = activity.narrative || '';
        fields.notes = activity.notes || '';
        fields.status = activity.status || '';
        break;
      }
      case 'experience': {
        const experience = itemState as MemoryExperienceItem;
        fields.situation = experience.situation || '';
        fields.action = experience.action || '';
        fields.keyLearning = experience.keyLearning || '';
        fields.reasoning = experience.reasoning || '';
        break;
      }
      case 'preference': {
        const preference = itemState as MemoryPreferenceItem;
        fields.conclusionDirectives = preference.conclusionDirectives || '';
        fields.suggestions = preference.suggestions || '';
        break;
      }
    }

    setEditState(fields);
    setEditing(true);
  }, [itemState, layer, memoryState?.title, resolvedSummary]);

  const handleSave = useCallback(async () => {
    if (!itemState || !layer) return;

    setSaving(true);

    try {
      switch (layer) {
        case 'identity': {
          await memoryApi.updateIdentity(itemState.id, {
            summary: editState.summary,
            title: editState.title,
          });
          setMemoryState((prev) =>
            prev
              ? {
                  ...prev,
                  summary: editState.summary,
                  title: editState.title,
                }
              : prev,
          );
          break;
        }
        case 'context': {
          await memoryApi.updateContext(itemState.id, {
            currentStatus: editState.currentStatus,
            description: editState.description,
            title: editState.title,
          });
          setItemState((prev) =>
            prev
              ? {
                  ...(prev as MemoryContextItem),
                  currentStatus: editState.currentStatus,
                  description: editState.description,
                  title: editState.title,
                }
              : prev,
          );
          break;
        }
        case 'activity': {
          await memoryApi.updateActivity(itemState.id, {
            narrative: editState.narrative,
            notes: editState.notes,
            status: editState.status,
          });
          setItemState((prev) =>
            prev
              ? {
                  ...(prev as MemoryActivityItem),
                  narrative: editState.narrative,
                  notes: editState.notes,
                  status: editState.status,
                }
              : prev,
          );
          break;
        }
        case 'experience': {
          await memoryApi.updateExperience(itemState.id, {
            action: editState.action,
            keyLearning: editState.keyLearning,
            reasoning: editState.reasoning,
            situation: editState.situation,
          });
          setItemState((prev) =>
            prev
              ? {
                  ...(prev as MemoryExperienceItem),
                  action: editState.action,
                  keyLearning: editState.keyLearning,
                  reasoning: editState.reasoning,
                  situation: editState.situation,
                }
              : prev,
          );
          break;
        }
        case 'preference': {
          await memoryApi.updatePreference(itemState.id, {
            conclusionDirectives: editState.conclusionDirectives,
            suggestions: editState.suggestions,
          });
          setItemState((prev) =>
            prev
              ? {
                  ...(prev as MemoryPreferenceItem),
                  conclusionDirectives: editState.conclusionDirectives,
                  suggestions: editState.suggestions,
                }
              : prev,
          );
          break;
        }
      }

      await loadDetail({ silent: true });
      setEditing(false);
      Alert.alert(t.memorySaved);
    } catch {
      Alert.alert(t.errorUnknown);
    } finally {
      setSaving(false);
    }
  }, [editState, itemState, layer, loadDetail, t.errorUnknown, t.memorySaved]);

  const handleDelete = useCallback(() => {
    if (!itemState || !layer) return;

    Alert.alert(t.memoryDeleteConfirm, t.memoryDeleteDesc, [
      { style: 'cancel', text: t.cancel },
      {
        style: 'destructive',
        text: t.delete,
        onPress: async () => {
          try {
            switch (layer) {
              case 'identity': {
                await memoryApi.deleteIdentity(itemState.id);
                break;
              }
              case 'context': {
                await memoryApi.deleteContext(itemState.id);
                break;
              }
              case 'activity': {
                await memoryApi.deleteActivity(itemState.id);
                break;
              }
              case 'experience': {
                await memoryApi.deleteExperience(itemState.id);
                break;
              }
              case 'preference': {
                await memoryApi.deletePreference(itemState.id);
                break;
              }
            }

            nav.goBack();
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  }, [itemState, layer, nav, t]);

  const handleOpenSource = useCallback(() => {
    if (!canOpenSource || !source?.sessionId || !source.id) return;

    nav.navigate('ChatDetail', {
      sessionId: source.sessionId,
      topicId: source.id,
    });
  }, [canOpenSource, nav, source]);

  const getHeaderTitle = useCallback((): string => {
    if (!itemState || !layer) return t.memoryDetail;

    switch (layer) {
      case 'identity': {
        return editing
          ? editState.title
          : (itemState as any).title || memoryState?.title || t.memoryIdentity;
      }
      case 'context': {
        return editing
          ? editState.title
          : (itemState as MemoryContextItem).title || memoryState?.title || t.memoryContext;
      }
      case 'activity': {
        return (
          (itemState as any).title ||
          memoryState?.title ||
          (itemState as MemoryActivityItem).type ||
          t.memoryActivity
        );
      }
      case 'experience': {
        return (
          (itemState as any).title ||
          memoryState?.title ||
          (itemState as MemoryExperienceItem).type ||
          t.memoryExperience
        );
      }
      case 'preference': {
        return (
          (itemState as any).title ||
          memoryState?.title ||
          (itemState as MemoryPreferenceItem).type ||
          t.memoryPreference
        );
      }
    }
  }, [editState.title, editing, itemState, layer, memoryState?.title, t]);

  const renderCommonMeta = () => (
    <>
      <View className="mb-4 flex-row flex-wrap items-center">
        <MetaChip
          color={layerColor}
          label={
            (t as any)[`memory${layer?.charAt(0).toUpperCase()}${layer?.slice(1)}`] || layer || ''
          }
        />
        {resolvedType ? <MetaChip subtle color={layerColor} label={resolvedType} /> : null}
      </View>

      <SourceCard
        canOpen={canOpenSource}
        source={source}
        sourceLabel={t.skillsMemorySource}
        subtitle={sourceSubtitle}
        onPress={handleOpenSource}
      />

      {layer !== 'identity' && resolvedSummary ? (
        <FieldSection label={t.memorySummary}>
          <FieldText value={resolvedSummary} />
        </FieldSection>
      ) : null}
    </>
  );

  const renderContent = () => {
    if (!itemState || !layer) return null;

    const createdAt = (itemState as any).createdAt || memoryState?.createdAt;
    const updatedAt = (itemState as any).updatedAt || memoryState?.updatedAt;
    const capturedAt = (itemState as any).capturedAt || memoryState?.capturedAt;

    switch (layer) {
      case 'identity': {
        const identity = itemState as MemoryIdentityItem;

        return (
          <>
            {renderCommonMeta()}
            <EditableField
              multiline
              editing={editing}
              label={t.memorySummary}
              value={editing ? editState.summary : resolvedSummary}
              onChangeText={setField('summary')}
            />
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(createdAt)} />
            </FieldSection>
            {updatedAt ? (
              <FieldSection label={t.memoryUpdatedAt}>
                <FieldText value={formatDate(updatedAt)} />
              </FieldSection>
            ) : null}
            {identity.episodicDate ? (
              <FieldSection label={t.memoryCapturedAt}>
                <FieldText value={formatDate(identity.episodicDate)} />
              </FieldSection>
            ) : null}
            {resolvedTags.length > 0 ? (
              <FieldSection label={t.memoryTags}>
                <TagList color={layerColor} tags={resolvedTags} />
              </FieldSection>
            ) : null}
          </>
        );
      }
      case 'context': {
        const context = itemState as MemoryContextItem;

        return (
          <>
            {renderCommonMeta()}
            <EditableField
              multiline
              editing={editing}
              label={t.memoryDescription}
              value={editing ? editState.description : context.description || ''}
              onChangeText={setField('description')}
            />
            <EditableField
              editing={editing}
              label={t.memoryStatus}
              value={editing ? editState.currentStatus : context.currentStatus || ''}
              onChangeText={setField('currentStatus')}
            />
            <View className="flex-row flex-wrap">
              <ScoreBadge color="#f59e0b" label={t.memoryImpact} value={context.scoreImpact} />
              <ScoreBadge color="#ef4444" label={t.memoryUrgency} value={context.scoreUrgency} />
            </View>
            {context.associatedSubjects?.length ? (
              <FieldSection label={t.memoryAssociatedSubjects}>
                <TagList color={layerColor} tags={context.associatedSubjects} />
              </FieldSection>
            ) : null}
            {capturedAt ? (
              <FieldSection label={t.memoryCapturedAt}>
                <FieldText value={formatDate(capturedAt)} />
              </FieldSection>
            ) : null}
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(createdAt)} />
            </FieldSection>
            {updatedAt ? (
              <FieldSection label={t.memoryUpdatedAt}>
                <FieldText value={formatDate(updatedAt)} />
              </FieldSection>
            ) : null}
            {resolvedTags.length > 0 ? (
              <FieldSection label={t.memoryTags}>
                <TagList color={layerColor} tags={resolvedTags} />
              </FieldSection>
            ) : null}
          </>
        );
      }
      case 'activity': {
        const activity = itemState as MemoryActivityItem;

        return (
          <>
            {renderCommonMeta()}
            <EditableField
              multiline
              editing={editing}
              label={t.memoryNarrative}
              value={editing ? editState.narrative : activity.narrative || ''}
              onChangeText={setField('narrative')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryNotes}
              value={editing ? editState.notes : activity.notes || ''}
              onChangeText={setField('notes')}
            />
            <EditableField
              editing={editing}
              label={t.memoryStatus}
              value={editing ? editState.status : activity.status || ''}
              onChangeText={setField('status')}
            />
            {activity.feedback ? (
              <FieldSection label={t.memoryFeedback}>
                <FieldText value={activity.feedback} />
              </FieldSection>
            ) : null}
            <View className="mb-4 flex-row flex-wrap gap-4">
              {activity.startsAt ? (
                <View className="flex-row items-center">
                  <Calendar color="#9ca3af" size={14} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-1 text-xs text-gray-500">
                    {formatDate(activity.startsAt)}
                  </Text>
                </View>
              ) : null}
              {activity.endsAt ? (
                <View className="flex-row items-center">
                  <Clock color="#9ca3af" size={14} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-1 text-xs text-gray-500">{formatDate(activity.endsAt)}</Text>
                </View>
              ) : null}
              {activity.timezone ? (
                <View className="flex-row items-center">
                  <MapPin color="#9ca3af" size={14} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-1 text-xs text-gray-500">{activity.timezone}</Text>
                </View>
              ) : null}
            </View>
            {activity.associatedLocations?.length ? (
              <FieldSection label={t.memoryAssociatedLocations}>
                <TagList color={layerColor} tags={activity.associatedLocations} />
              </FieldSection>
            ) : null}
            {capturedAt ? (
              <FieldSection label={t.memoryCapturedAt}>
                <FieldText value={formatDate(capturedAt)} />
              </FieldSection>
            ) : null}
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(createdAt)} />
            </FieldSection>
            {updatedAt ? (
              <FieldSection label={t.memoryUpdatedAt}>
                <FieldText value={formatDate(updatedAt)} />
              </FieldSection>
            ) : null}
            {resolvedTags.length > 0 ? (
              <FieldSection label={t.memoryTags}>
                <TagList color={layerColor} tags={resolvedTags} />
              </FieldSection>
            ) : null}
          </>
        );
      }
      case 'experience': {
        const experience = itemState as MemoryExperienceItem;

        return (
          <>
            {renderCommonMeta()}
            <EditableField
              multiline
              editing={editing}
              label={t.memorySituation}
              value={editing ? editState.situation : experience.situation || ''}
              onChangeText={setField('situation')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryAction}
              value={editing ? editState.action : experience.action || ''}
              onChangeText={setField('action')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryKeyLearning}
              value={editing ? editState.keyLearning : experience.keyLearning || ''}
              onChangeText={setField('keyLearning')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryReasoning}
              value={editing ? editState.reasoning : experience.reasoning || ''}
              onChangeText={setField('reasoning')}
            />
            {experience.possibleOutcome ? (
              <FieldSection label={t.memoryOutcome}>
                <FieldText value={experience.possibleOutcome} />
              </FieldSection>
            ) : null}
            <View className="flex-row flex-wrap">
              <ScoreBadge
                color="#10b981"
                label={t.memoryConfidence}
                value={experience.scoreConfidence}
              />
            </View>
            {capturedAt ? (
              <FieldSection label={t.memoryCapturedAt}>
                <FieldText value={formatDate(capturedAt)} />
              </FieldSection>
            ) : null}
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(createdAt)} />
            </FieldSection>
            {updatedAt ? (
              <FieldSection label={t.memoryUpdatedAt}>
                <FieldText value={formatDate(updatedAt)} />
              </FieldSection>
            ) : null}
            {resolvedTags.length > 0 ? (
              <FieldSection label={t.memoryTags}>
                <TagList color={layerColor} tags={resolvedTags} />
              </FieldSection>
            ) : null}
          </>
        );
      }
      case 'preference': {
        const preference = itemState as MemoryPreferenceItem;

        return (
          <>
            {renderCommonMeta()}
            <EditableField
              multiline
              editing={editing}
              label={t.memoryConclusion}
              value={
                editing ? editState.conclusionDirectives : preference.conclusionDirectives || ''
              }
              onChangeText={setField('conclusionDirectives')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memorySuggestions}
              value={editing ? editState.suggestions : preference.suggestions || ''}
              onChangeText={setField('suggestions')}
            />
            <View className="flex-row flex-wrap">
              <ScoreBadge
                color="#ec4899"
                label={t.memoryPriority}
                value={preference.scorePriority}
              />
            </View>
            {capturedAt ? (
              <FieldSection label={t.memoryCapturedAt}>
                <FieldText value={formatDate(capturedAt)} />
              </FieldSection>
            ) : null}
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(createdAt)} />
            </FieldSection>
            {updatedAt ? (
              <FieldSection label={t.memoryUpdatedAt}>
                <FieldText value={formatDate(updatedAt)} />
              </FieldSection>
            ) : null}
            {resolvedTags.length > 0 ? (
              <FieldSection label={t.memoryTags}>
                <TagList color={layerColor} tags={resolvedTags} />
              </FieldSection>
            ) : null}
          </>
        );
      }
    }
  };

  if (!itemState || !layer) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 48 : 0}
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between px-5 py-3">
        <View className="flex-1 flex-row items-center">
          <TouchableOpacity className="mr-3" onPress={() => nav.goBack()}>
            <ChevronLeft color="#111" size={24} strokeWidth={1.8} />
          </TouchableOpacity>
          {editing && (layer === 'identity' || layer === 'context') ? (
            <TextInput
              className="flex-1 text-lg font-bold text-gray-900"
              value={editState.title}
              onChangeText={setField('title')}
            />
          ) : (
            <Text className="flex-1 text-lg font-bold text-gray-900" numberOfLines={1}>
              {getHeaderTitle()}
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-3">
          {loadingDetail || refreshingDetail ? (
            <ActivityIndicator color={layerColor} size="small" />
          ) : null}
          {editing ? (
            <>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <X color="#9ca3af" size={20} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={handleSave}>
                <Save color={layerColor} size={20} strokeWidth={1.8} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={startEdit}>
                <Edit3 color={colors.iconMuted} size={18} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Trash2 color="#ef4444" size={18} strokeWidth={1.8} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
