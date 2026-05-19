import type {
  FileAssetCapabilities,
  FileListItem,
  MobileFileAssetClassification,
  MobileFileAssetRenditionKind,
  MobileFileAssetReviewStatus,
  MobileFileAssetUsagePolicy,
} from '../types';
import type { TranslationKeys } from './i18n';

export interface MobileGovernanceBadge {
  emphasis: 'accent' | 'neutral' | 'success' | 'warning';
  key: string;
  label: string;
  title?: string;
}

export interface MobileGovernanceFilterState {
  assetClassification?: MobileFileAssetClassification | null;
  assetReviewStatus?: MobileFileAssetReviewStatus | null;
  assetRightsOwner?: string | null;
  assetUsagePolicy?: MobileFileAssetUsagePolicy | null;
}

const CLASSIFICATION_TRANSLATION_KEYS: Record<
  MobileFileAssetClassification,
  keyof TranslationKeys
> = {
  brand: 'resourceGovernanceClassificationBrand',
  finance: 'resourceGovernanceClassificationFinance',
  general: 'resourceGovernanceClassificationGeneral',
  hr: 'resourceGovernanceClassificationHr',
  legal: 'resourceGovernanceClassificationLegal',
  product: 'resourceGovernanceClassificationProduct',
};

const REVIEW_TRANSLATION_KEYS: Record<MobileFileAssetReviewStatus, keyof TranslationKeys> = {
  approved: 'resourceGovernanceReviewApproved',
  archived: 'resourceGovernanceReviewArchived',
  draft: 'resourceGovernanceReviewDraft',
};

const USAGE_TRANSLATION_KEYS: Record<MobileFileAssetUsagePolicy, keyof TranslationKeys> = {
  internal: 'resourceGovernanceUsageInternal',
  public: 'resourceGovernanceUsagePublic',
  restricted: 'resourceGovernanceUsageRestricted',
};

const RENDITION_TRANSLATION_KEYS: Record<MobileFileAssetRenditionKind, keyof TranslationKeys> = {
  caption: 'resourceGovernanceRenditionCaption',
  embedding: 'resourceGovernanceRenditionEmbedding',
  preview: 'resourceGovernanceRenditionPreview',
  print: 'resourceGovernanceRenditionPrint',
  thumbnail: 'resourceGovernanceRenditionThumbnail',
  transcript: 'resourceGovernanceRenditionTranscript',
  web: 'resourceGovernanceRenditionWeb',
};

const normalizeCompactLabel = (value: string, maxLength = 14) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;

export const normalizeGovernanceRightsOwner = (value?: string | null) => {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
};

export function buildFileGovernanceBadges(
  item: Pick<
    FileListItem,
    | 'assetClassification'
    | 'assetPrimaryRenditionKind'
    | 'assetPrimaryRenditionLabel'
    | 'assetRenditionCount'
    | 'assetReviewStatus'
    | 'assetUsagePolicy'
    | 'assetVersionLabel'
  >,
  t: TranslationKeys,
  maxVisible = 3,
): MobileGovernanceBadge[] {
  const badges: MobileGovernanceBadge[] = [];

  if (item.assetUsagePolicy && item.assetUsagePolicy !== 'internal') {
    badges.push({
      emphasis: item.assetUsagePolicy === 'restricted' ? 'warning' : 'accent',
      key: `usage:${item.assetUsagePolicy}`,
      label: t[USAGE_TRANSLATION_KEYS[item.assetUsagePolicy]],
    });
  }

  if (item.assetReviewStatus && item.assetReviewStatus !== 'draft') {
    badges.push({
      emphasis: item.assetReviewStatus === 'archived' ? 'warning' : 'success',
      key: `review:${item.assetReviewStatus}`,
      label: t[REVIEW_TRANSLATION_KEYS[item.assetReviewStatus]],
    });
  }

  if (item.assetVersionLabel?.trim()) {
    const rawVersionLabel = item.assetVersionLabel.trim();
    badges.push({
      emphasis: 'success',
      key: `version:${rawVersionLabel}`,
      label: normalizeCompactLabel(rawVersionLabel),
      title: rawVersionLabel,
    });
  }

  if (item.assetPrimaryRenditionKind) {
    const baseLabel = t[RENDITION_TRANSLATION_KEYS[item.assetPrimaryRenditionKind]];
    const renditionLabel = item.assetPrimaryRenditionLabel?.trim();
    const extraCount = Math.max((item.assetRenditionCount ?? 0) - 1, 0);
    const fullLabel = [
      baseLabel,
      ...(renditionLabel ? [renditionLabel] : []),
      ...(extraCount > 0 ? [`+${extraCount}`] : []),
    ].join(' · ');

    badges.push({
      emphasis: 'accent',
      key: `rendition:${item.assetPrimaryRenditionKind}:${renditionLabel ?? ''}:${extraCount}`,
      label: [baseLabel, ...(extraCount > 0 ? [`+${extraCount}`] : [])].join(' · '),
      title: renditionLabel ? fullLabel : undefined,
    });
  }

  if (item.assetClassification && item.assetClassification !== 'general') {
    badges.push({
      emphasis: 'neutral',
      key: `classification:${item.assetClassification}`,
      label: t[CLASSIFICATION_TRANSLATION_KEYS[item.assetClassification]],
    });
  }

  if (badges.length > maxVisible) {
    const visible = badges.slice(0, maxVisible - 1);
    const hidden = badges.slice(maxVisible - 1);

    visible.push({
      emphasis: 'neutral',
      key: `overflow:${hidden.map((badge) => badge.key).join('|')}`,
      label: `+${hidden.length}`,
      title: hidden.map((badge) => badge.title ?? badge.label).join(' · '),
    });

    return visible;
  }

  return badges;
}

export function countActiveGovernanceFilters(filters: MobileGovernanceFilterState): number {
  return [
    filters.assetClassification,
    filters.assetReviewStatus,
    normalizeGovernanceRightsOwner(filters.assetRightsOwner),
    filters.assetUsagePolicy,
  ].filter(Boolean).length;
}

export function buildGovernanceFilterSummaryLabels(
  filters: MobileGovernanceFilterState,
  t: TranslationKeys,
): string[] {
  const labels: string[] = [];

  if (filters.assetUsagePolicy) {
    labels.push(t[USAGE_TRANSLATION_KEYS[filters.assetUsagePolicy]]);
  }

  if (filters.assetReviewStatus) {
    labels.push(t[REVIEW_TRANSLATION_KEYS[filters.assetReviewStatus]]);
  }

  if (filters.assetClassification) {
    labels.push(t[CLASSIFICATION_TRANSLATION_KEYS[filters.assetClassification]]);
  }

  const rightsOwner = normalizeGovernanceRightsOwner(filters.assetRightsOwner);

  if (rightsOwner) {
    labels.push(
      t.resourceGovernanceRightsOwnerSummary.replace('{rightsOwner}', rightsOwner),
    );
  }

  return labels;
}

export function buildGovernanceCapabilityHint(
  capabilities: FileAssetCapabilities | undefined,
  t: TranslationKeys,
) {
  if (!capabilities) return undefined;

  if (capabilities.canApprove || capabilities.canArchive) {
    return t.resourceGovernanceCapabilitiesManagerHint;
  }

  if (capabilities.canEditGovernance) {
    return t.resourceGovernanceCapabilitiesEditorHint;
  }

  return t.resourceGovernanceCapabilitiesViewerHint;
}
