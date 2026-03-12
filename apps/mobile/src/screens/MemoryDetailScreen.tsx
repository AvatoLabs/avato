/**
 * MemoryDetailScreen — Full-screen detail view for a single memory item.
 *
 * Supports viewing all fields, editing, and deleting.
 * Aligns with web's right-panel detail view but adapted for mobile navigation.
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Calendar,
  ChevronLeft,
  Clock,
  Edit3,
  MapPin,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
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
import type {
  MemoryActivityItem,
  MemoryContextItem,
  MemoryExperienceItem,
  MemoryIdentityItem,
  MemoryLayer,
  MemoryPreferenceItem,
} from '../types';

type AnyMemoryItem =
  | MemoryActivityItem
  | MemoryContextItem
  | MemoryExperienceItem
  | MemoryIdentityItem
  | MemoryPreferenceItem;

const LAYER_COLORS: Record<string, string> = {
  activity: '#f59e0b',
  context: '#8b5cf6',
  experience: '#10b981',
  identity: '#3b82f6',
  preference: '#ec4899',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Field Section Component ──────────────────────────────────────────
function FieldSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </Text>
      {children}
    </View>
  );
}

function FieldText({ value }: { value?: string | null }) {
  if (!value) return <Text className="text-sm text-gray-300">—</Text>;
  return <Text className="text-sm text-gray-700 leading-5">{value}</Text>;
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
  onChangeText: (t: string) => void;
  value: string;
}) {
  return (
    <FieldSection label={label}>
      {editing ? (
        <TextInput
          className="text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2"
          multiline={multiline}
          style={multiline ? { minHeight: 80, textAlignVertical: 'top' } : {}}
          value={value}
          onChangeText={onChangeText}
        />
      ) : (
        <FieldText value={value || undefined} />
      )}
    </FieldSection>
  );
}

// ── Tags Display ─────────────────────────────────────────────────────
function TagsRow({ color, tags }: { color: string; tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5 mb-4">
      {tags.map((tag, i) => (
        <View
          className="flex-row items-center px-2.5 py-1 rounded-full"
          key={`${tag}-${i}`}
          style={{ backgroundColor: `${color}12` }}
        >
          <Tag color={color} size={10} strokeWidth={2} />
          <Text className="text-xs font-medium ml-1" style={{ color }}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Score Badge ──────────────────────────────────────────────────────
function ScoreBadge({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: number | null;
}) {
  if (value === undefined || value === null) return null;
  return (
    <View
      className="items-center px-3 py-2 rounded-xl mr-2 mb-2"
      style={{ backgroundColor: `${color}10` }}
    >
      <Text className="text-lg font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function MemoryDetailScreen() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const item: AnyMemoryItem = route.params?.item;
  const layer: MemoryLayer = route.params?.layer;
  const layerColor = LAYER_COLORS[layer] || '#6b7280';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields (varies by layer)
  const [editState, setEditState] = useState<Record<string, string>>({});

  const startEdit = useCallback(() => {
    // Pre-fill editable fields from current item
    const fields: Record<string, string> = {};
    switch (layer) {
      case 'identity': {
        fields.title = (item as MemoryIdentityItem).title || '';
        fields.summary = (item as MemoryIdentityItem).summary || '';
        break;
      }
      case 'context': {
        fields.title = (item as MemoryContextItem).title || '';
        fields.description = (item as MemoryContextItem).description || '';
        fields.currentStatus = (item as MemoryContextItem).currentStatus || '';
        break;
      }
      case 'activity': {
        fields.narrative = (item as MemoryActivityItem).narrative || '';
        fields.notes = (item as MemoryActivityItem).notes || '';
        fields.status = (item as MemoryActivityItem).status || '';
        break;
      }
      case 'experience': {
        fields.situation = (item as MemoryExperienceItem).situation || '';
        fields.action = (item as MemoryExperienceItem).action || '';
        fields.keyLearning = (item as MemoryExperienceItem).keyLearning || '';
        fields.reasoning = (item as MemoryExperienceItem).reasoning || '';
        break;
      }
      case 'preference': {
        fields.conclusionDirectives = (item as MemoryPreferenceItem).conclusionDirectives || '';
        fields.suggestions = (item as MemoryPreferenceItem).suggestions || '';
        break;
      }
    }
    setEditState(fields);
    setEditing(true);
  }, [item, layer]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      switch (layer) {
        case 'identity': {
          await memoryApi.updateIdentity(item.id, {
            summary: editState.summary,
            title: editState.title,
          } as any);
          break;
        }
        case 'context': {
          await memoryApi.updateContext(item.id, {
            currentStatus: editState.currentStatus,
            description: editState.description,
            title: editState.title,
          });
          break;
        }
        case 'activity': {
          await memoryApi.updateActivity(item.id, {
            narrative: editState.narrative,
            notes: editState.notes,
            status: editState.status,
          });
          break;
        }
        case 'experience': {
          await memoryApi.updateExperience(item.id, {
            action: editState.action,
            keyLearning: editState.keyLearning,
            reasoning: editState.reasoning,
            situation: editState.situation,
          });
          break;
        }
        case 'preference': {
          await memoryApi.updatePreference(item.id, {
            conclusionDirectives: editState.conclusionDirectives,
            suggestions: editState.suggestions,
          });
          break;
        }
      }
      Alert.alert(t.memorySaved);
      setEditing(false);
    } catch {
      Alert.alert(t.errorUnknown);
    } finally {
      setSaving(false);
    }
  }, [editState, item.id, layer, t]);

  const handleDelete = useCallback(() => {
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
            nav.goBack();
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  }, [item.id, layer, nav, t]);

  const setField = (key: string) => (val: string) =>
    setEditState((prev) => ({ ...prev, [key]: val }));

  // ── Render Layer-Specific Content ──────────────────────────────────
  function renderContent() {
    const tags: string[] = (item as any).tags || [];

    switch (layer) {
      case 'identity': {
        const it = item as MemoryIdentityItem;
        return (
          <>
            <TagsRow color={layerColor} tags={tags} />
            <EditableField
              multiline
              editing={editing}
              label={t.memorySummary}
              value={editing ? editState.summary : it.summary || ''}
              onChangeText={setField('summary')}
            />
            {it.memoryCategory && (
              <FieldSection label={t.memoryType}>
                <FieldText value={it.memoryCategory} />
              </FieldSection>
            )}
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(it.createdAt)} />
            </FieldSection>
            {it.updatedAt && (
              <FieldSection label={t.memoryUpdatedAt}>
                <FieldText value={formatDate(it.updatedAt)} />
              </FieldSection>
            )}
          </>
        );
      }
      case 'context': {
        const it = item as MemoryContextItem;
        return (
          <>
            <TagsRow color={layerColor} tags={tags} />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryDescription}
              value={editing ? editState.description : it.description || ''}
              onChangeText={setField('description')}
            />
            <EditableField
              editing={editing}
              label={t.memoryStatus}
              value={editing ? editState.currentStatus : it.currentStatus || ''}
              onChangeText={setField('currentStatus')}
            />
            <View className="flex-row flex-wrap">
              <ScoreBadge color="#f59e0b" label={t.memoryImpact} value={it.scoreImpact} />
              <ScoreBadge color="#ef4444" label={t.memoryUrgency} value={it.scoreUrgency} />
            </View>
            {it.associatedSubjects?.length ? (
              <FieldSection label={t.memoryAssociatedSubjects}>
                <View className="flex-row flex-wrap gap-1">
                  {it.associatedSubjects.map((s, i) => (
                    <View className="px-2 py-0.5 rounded bg-gray-100" key={i}>
                      <Text className="text-xs text-gray-600">{s}</Text>
                    </View>
                  ))}
                </View>
              </FieldSection>
            ) : null}
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(it.createdAt)} />
            </FieldSection>
          </>
        );
      }
      case 'activity': {
        const it = item as MemoryActivityItem;
        return (
          <>
            <TagsRow color={layerColor} tags={tags} />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryNarrative}
              value={editing ? editState.narrative : it.narrative || ''}
              onChangeText={setField('narrative')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryNotes}
              value={editing ? editState.notes : it.notes || ''}
              onChangeText={setField('notes')}
            />
            <EditableField
              editing={editing}
              label={t.memoryStatus}
              value={editing ? editState.status : it.status || ''}
              onChangeText={setField('status')}
            />
            {it.feedback && (
              <FieldSection label={t.memoryFeedback}>
                <FieldText value={it.feedback} />
              </FieldSection>
            )}
            <View className="flex-row flex-wrap gap-4 mb-4">
              {it.startsAt && (
                <View className="flex-row items-center">
                  <Calendar color="#9ca3af" size={14} strokeWidth={1.5} />
                  <Text className="text-xs text-gray-500 ml-1">{formatDate(it.startsAt)}</Text>
                </View>
              )}
              {it.endsAt && (
                <View className="flex-row items-center">
                  <Clock color="#9ca3af" size={14} strokeWidth={1.5} />
                  <Text className="text-xs text-gray-500 ml-1">{formatDate(it.endsAt)}</Text>
                </View>
              )}
              {it.timezone && (
                <View className="flex-row items-center">
                  <MapPin color="#9ca3af" size={14} strokeWidth={1.5} />
                  <Text className="text-xs text-gray-500 ml-1">{it.timezone}</Text>
                </View>
              )}
            </View>
            {it.associatedLocations?.length ? (
              <FieldSection label={t.memoryAssociatedLocations}>
                <View className="flex-row flex-wrap gap-1">
                  {it.associatedLocations.map((loc, i) => (
                    <View className="px-2 py-0.5 rounded bg-gray-100" key={i}>
                      <Text className="text-xs text-gray-600">{loc}</Text>
                    </View>
                  ))}
                </View>
              </FieldSection>
            ) : null}
            <FieldSection label={t.memoryCapturedAt}>
              <FieldText value={formatDate(it.capturedAt)} />
            </FieldSection>
          </>
        );
      }
      case 'experience': {
        const it = item as MemoryExperienceItem;
        return (
          <>
            <TagsRow color={layerColor} tags={tags} />
            <EditableField
              multiline
              editing={editing}
              label={t.memorySituation}
              value={editing ? editState.situation : it.situation || ''}
              onChangeText={setField('situation')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryAction}
              value={editing ? editState.action : it.action || ''}
              onChangeText={setField('action')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryKeyLearning}
              value={editing ? editState.keyLearning : it.keyLearning || ''}
              onChangeText={setField('keyLearning')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryReasoning}
              value={editing ? editState.reasoning : it.reasoning || ''}
              onChangeText={setField('reasoning')}
            />
            {it.possibleOutcome && (
              <FieldSection label={t.memoryOutcome}>
                <FieldText value={it.possibleOutcome} />
              </FieldSection>
            )}
            <View className="flex-row flex-wrap">
              <ScoreBadge color="#10b981" label={t.memoryConfidence} value={it.scoreConfidence} />
            </View>
            <FieldSection label={t.memoryCapturedAt}>
              <FieldText value={formatDate(it.capturedAt)} />
            </FieldSection>
          </>
        );
      }
      case 'preference': {
        const it = item as MemoryPreferenceItem;
        return (
          <>
            <TagsRow color={layerColor} tags={tags} />
            <EditableField
              multiline
              editing={editing}
              label={t.memoryConclusion}
              value={editing ? editState.conclusionDirectives : it.conclusionDirectives || ''}
              onChangeText={setField('conclusionDirectives')}
            />
            <EditableField
              multiline
              editing={editing}
              label={t.memorySuggestions}
              value={editing ? editState.suggestions : it.suggestions || ''}
              onChangeText={setField('suggestions')}
            />
            <View className="flex-row flex-wrap">
              <ScoreBadge color="#ec4899" label={t.memoryPriority} value={it.scorePriority} />
            </View>
            <FieldSection label={t.memoryCreatedAt}>
              <FieldText value={formatDate(it.createdAt)} />
            </FieldSection>
          </>
        );
      }
    }
  }

  // ── Get title for header ──────────────────────────────────────────
  function getHeaderTitle(): string {
    switch (layer) {
      case 'identity': {
        return editing ? editState.title : (item as MemoryIdentityItem).title || t.memoryIdentity;
      }
      case 'context': {
        return editing ? editState.title : (item as MemoryContextItem).title || t.memoryContext;
      }
      case 'activity': {
        return t.memoryActivity;
      }
      case 'experience': {
        return t.memoryExperience;
      }
      case 'preference': {
        return t.memoryPreference;
      }
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <View className="flex-row items-center flex-1">
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
            <Text className="text-lg font-bold text-gray-900 flex-1" numberOfLines={1}>
              {getHeaderTitle()}
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-3">
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
                <Edit3 color="#6b7280" size={18} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Trash2 color="#ef4444" size={18} strokeWidth={1.8} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Layer badge */}
      <View className="px-5 mb-3">
        <View className="flex-row items-center">
          <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${layerColor}15` }}>
            <Text className="text-xs font-bold uppercase" style={{ color: layerColor }}>
              {(t as any)[`memory${layer.charAt(0).toUpperCase() + layer.slice(1)}`] || layer}
            </Text>
          </View>
          {(item as any).type ? (
            <View className="px-2 py-0.5 rounded-full bg-gray-100 ml-2">
              <Text className="text-xs text-gray-500">{(item as any).type}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Content */}
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
