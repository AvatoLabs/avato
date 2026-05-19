import type {
  MemoryActivityItem,
  MemoryBaseDetail,
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

export type MemoryEditFields = Record<string, string>;

export function buildMemoryEditState(params: {
  item: AnyMemoryItem;
  layer: MemoryLayer;
  memory?: MemoryBaseDetail | null;
  summary?: string;
}): MemoryEditFields {
  const { item, layer, memory, summary } = params;
  const fields: MemoryEditFields = {};

  switch (layer) {
    case 'identity': {
      fields.summary = summary || '';
      fields.title = (item as MemoryIdentityItem).title || memory?.title || '';
      return fields;
    }
    case 'context': {
      const context = item as MemoryContextItem;
      fields.currentStatus = context.currentStatus || '';
      fields.description = context.description || '';
      fields.title = context.title || '';
      return fields;
    }
    case 'activity': {
      const activity = item as MemoryActivityItem;
      fields.narrative = activity.narrative || '';
      fields.notes = activity.notes || '';
      fields.status = activity.status || '';
      return fields;
    }
    case 'experience': {
      const experience = item as MemoryExperienceItem;
      fields.action = experience.action || '';
      fields.keyLearning = experience.keyLearning || '';
      fields.reasoning = experience.reasoning || '';
      fields.situation = experience.situation || '';
      return fields;
    }
    case 'preference': {
      const preference = item as MemoryPreferenceItem;
      fields.conclusionDirectives = preference.conclusionDirectives || '';
      fields.suggestions = preference.suggestions || '';
      return fields;
    }
  }
}

export function hasMemoryEditChanges(params: {
  editState: MemoryEditFields;
  item: AnyMemoryItem;
  layer: MemoryLayer;
  memory?: MemoryBaseDetail | null;
  summary?: string;
}): boolean {
  const { editState, item, layer, memory, summary } = params;
  const initial = buildMemoryEditState({ item, layer, memory, summary });
  const keys = new Set([...Object.keys(initial), ...Object.keys(editState)]);

  for (const key of keys) {
    if ((editState[key] ?? '') !== (initial[key] ?? '')) return true;
  }

  return false;
}
