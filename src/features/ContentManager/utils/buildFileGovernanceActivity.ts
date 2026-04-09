import type { FileAssetGovernanceAuditSnapshot } from '@lobechat/types';

import { formatDate, formatDateTime } from '@/utils/format';

type GovernanceTranslator = (...args: any[]) => string;

interface BuildFileGovernanceActivityParams {
  action?: string | null;
  actorDisplayName?: string | null;
  after?: Partial<FileAssetGovernanceAuditSnapshot> | null;
  before?: Partial<FileAssetGovernanceAuditSnapshot> | null;
  changedFields?: string[] | null;
  createdAt?: Date | string | null;
  t: GovernanceTranslator;
}

export interface FileGovernanceActivityDescriptor {
  label: string;
  title: string;
}

export const buildFileGovernanceActivity = ({
  action,
  actorDisplayName,
  after,
  before,
  changedFields,
  createdAt,
  t,
}: BuildFileGovernanceActivityParams): FileGovernanceActivityDescriptor | null => {
  if (!action || !createdAt) return null;

  const normalizedCreatedAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const actionLabel = t(`detail.asset.audit.${action}`, { defaultValue: action, ns: 'file' });
  const compactDate = formatDate(normalizedCreatedAt);
  const fullDateTime = formatDateTime(normalizedCreatedAt);
  const fieldLabels = {
    classification: t('detail.asset.classification.label', { ns: 'file' }),
    reviewStatus: t('detail.asset.reviewStatus.label', { ns: 'file' }),
    rightsOwner: t('detail.asset.rightsOwner.label', { ns: 'file' }),
    usagePolicy: t('detail.asset.usagePolicy.label', { ns: 'file' }),
  } satisfies Record<string, string>;

  const renderAuditFieldValue = (
    field: keyof typeof fieldLabels,
    value: string | null | undefined,
  ) => {
    if (field === 'classification') {
      return value
        ? t(`detail.asset.classification.${value}`, { defaultValue: String(value), ns: 'file' })
        : t('detail.asset.none', { ns: 'file' });
    }

    if (field === 'reviewStatus') {
      return value
        ? t(`detail.asset.reviewStatus.${value}`, { defaultValue: String(value), ns: 'file' })
        : t('detail.asset.none', { ns: 'file' });
    }

    if (field === 'usagePolicy') {
      return value
        ? t(`detail.asset.usagePolicy.${value}`, { defaultValue: String(value), ns: 'file' })
        : t('detail.asset.none', { ns: 'file' });
    }

    return value || t('detail.asset.none', { ns: 'file' });
  };

  const changedValueLines =
    changedFields?.flatMap((field) => {
      if (!(field in fieldLabels)) return [];

      const typedField = field as keyof typeof fieldLabels;
      const beforeValue = before?.[typedField];
      const afterValue = after?.[typedField];

      if (beforeValue === undefined && afterValue === undefined) return [];

      return [
        `${fieldLabels[typedField]}: ${renderAuditFieldValue(typedField, beforeValue as string | null | undefined)} -> ${renderAuditFieldValue(typedField, afterValue as string | null | undefined)}`,
      ];
    }) ?? [];

  const compactChange =
    changedFields?.find((field) => field in fieldLabels) &&
    after &&
    (() => {
      const firstField = changedFields.find((field) => field in fieldLabels);
      if (!firstField) return null;
      const typedField = firstField as keyof typeof fieldLabels;
      return `${fieldLabels[typedField]}: ${renderAuditFieldValue(typedField, after?.[typedField] as string | null | undefined)}`;
    })();

  return {
    label: compactChange ? `${actionLabel} · ${compactChange}` : `${actionLabel} · ${compactDate}`,
    title: [actionLabel, actorDisplayName, fullDateTime, ...changedValueLines]
      .filter(Boolean)
      .join(' · '),
  };
};
