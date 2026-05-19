import type { MobileSpaceMemoryGovernanceHistoryPreview } from '../types';
import { formatMobileDateTime } from './dateTime';
import type { I18nStore } from './i18n';
import { getMobileSpaceMemoryRecallLabel } from './spaceMemoryEntryMeta';

export interface MobileSpaceMemoryAuditRow {
  details: string[];
  meta: string;
  title: string;
}

const getAuditActionLabel = (
  t: I18nStore['t'],
  action: MobileSpaceMemoryGovernanceHistoryPreview['action'],
) => {
  if (action === 'merged') return t.memorySpaceAuditActionMerged;
  if (action === 'policy_updated') return t.memorySpaceAuditActionPolicyUpdated;

  return t.memorySpaceAuditActionPublished;
};

const getAuditFieldLabel = (
  t: I18nStore['t'],
  field: keyof NonNullable<MobileSpaceMemoryGovernanceHistoryPreview['changes']>,
) => {
  switch (field) {
    case 'content': {
      return t.memoryDescription;
    }
    case 'expiresAt': {
      return t.memorySpaceFieldExpiresAt;
    }
    case 'lastVerifiedAt': {
      return t.memorySpaceFieldLastVerifiedAt;
    }
    case 'recallEnabled': {
      return t.memorySpaceFieldRecall;
    }
    case 'staleAt': {
      return t.memorySpaceFieldStaleAt;
    }
    case 'summary': {
      return t.memorySummary;
    }
    case 'title': {
      return t.memorySpaceFieldTitle;
    }
    default: {
      return field;
    }
  }
};

const formatAuditValue = (
  t: I18nStore['t'],
  field: keyof NonNullable<MobileSpaceMemoryGovernanceHistoryPreview['changes']>,
  value: boolean | string | null | undefined,
) => {
  if (value == null || value === '') return null;
  if (field === 'recallEnabled' && typeof value === 'boolean') {
    return value ? getMobileSpaceMemoryRecallLabel(t, { recallEnabled: true }) : t.memorySpaceRecallStateDisabled;
  }
  if (
    field === 'expiresAt' ||
    field === 'lastVerifiedAt' ||
    field === 'staleAt'
  ) {
    return typeof value === 'string' ? formatMobileDateTime(value) : String(value);
  }

  return String(value);
};

export const buildMobileSpaceMemoryAuditRows = (
  history: MobileSpaceMemoryGovernanceHistoryPreview[] | undefined,
  t: I18nStore['t'],
): MobileSpaceMemoryAuditRow[] =>
  (history ?? []).map((item) => {
    const actorName = item.actor?.name || item.actor?.username || 'System';
    const details: string[] = [];

    if (item.resolution && item.sourceTitle) {
      details.push(t.memorySpaceAuditResolutionMerged.replace('{title}', item.sourceTitle));
    }

    for (const [field, diff] of Object.entries(item.changes ?? {}) as Array<
      [
        keyof NonNullable<MobileSpaceMemoryGovernanceHistoryPreview['changes']>,
        { after?: boolean | string | null; before?: boolean | string | null } | undefined,
      ]
    >) {
      if (!diff) continue;

      const label = getAuditFieldLabel(t, field);
      const beforeValue = formatAuditValue(t, field, diff.before);
      const afterValue = formatAuditValue(t, field, diff.after);

      if (beforeValue && afterValue) {
        details.push(
          t.memorySpaceAuditChangeFromTo
            .replace('{field}', label)
            .replace('{before}', beforeValue)
            .replace('{after}', afterValue),
        );
        continue;
      }

      if (afterValue) {
        details.push(
          t.memorySpaceAuditChangeSet.replace('{field}', label).replace('{value}', afterValue),
        );
        continue;
      }

      if (beforeValue) {
        details.push(t.memorySpaceAuditChangeUnset.replace('{field}', label));
      }
    }

    return {
      details,
      meta: t.memorySpaceAuditByline
        .replace('{name}', actorName)
        .replace('{date}', formatMobileDateTime(item.at)),
      title: getAuditActionLabel(t, item.action),
    };
  });
