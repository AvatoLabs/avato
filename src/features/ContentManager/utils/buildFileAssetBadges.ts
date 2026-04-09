import type {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';

type AssetBadgeTranslator = (...args: any[]) => string;

interface BuildFileAssetBadgesParams {
  assetClassification?: FileAssetClassification | null;
  assetPrimaryRenditionKind?: FileAssetRenditionKind | null;
  assetPrimaryRenditionLabel?: string | null;
  assetRenditionCount?: number | null;
  assetReviewStatus?: FileAssetReviewStatus | null;
  assetUsagePolicy?: FileAssetUsagePolicy | null;
  assetVersionLabel?: string | null;
  compact?: boolean;
  maxVisible?: number;
  t: AssetBadgeTranslator;
}

export interface FileAssetBadgeDescriptor {
  color?: 'gold' | 'processing' | 'success';
  key: string;
  label: string;
  title?: string;
  variant: 'filled' | 'outlined';
}

export const buildFileAssetBadges = ({
  assetClassification,
  compact = false,
  assetPrimaryRenditionKind,
  assetPrimaryRenditionLabel,
  assetReviewStatus,
  assetRenditionCount,
  assetUsagePolicy,
  assetVersionLabel,
  t,
  maxVisible,
}: BuildFileAssetBadgesParams): FileAssetBadgeDescriptor[] => {
  const badges: FileAssetBadgeDescriptor[] = [];
  const normalizeCompactLabel = (value: string, maxLength = 14) =>
    value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;

  if (assetUsagePolicy && assetUsagePolicy !== 'internal') {
    badges.push({
      color: assetUsagePolicy === 'restricted' ? 'gold' : 'processing',
      key: `usage:${assetUsagePolicy}`,
      label: t(`detail.asset.usagePolicy.${assetUsagePolicy}`, {
        defaultValue: String(assetUsagePolicy),
        ns: 'file',
      }),
      variant: 'outlined',
    });
  }

  if (assetReviewStatus && assetReviewStatus !== 'draft') {
    badges.push({
      color: assetReviewStatus === 'archived' ? 'gold' : 'success',
      key: `review:${assetReviewStatus}`,
      label: t(`detail.asset.reviewStatus.${assetReviewStatus}`, {
        defaultValue: String(assetReviewStatus),
        ns: 'file',
      }),
      variant: 'filled',
    });
  }

  if (assetVersionLabel?.trim()) {
    const rawVersionLabel = assetVersionLabel.trim();
    const versionLabel = compact ? normalizeCompactLabel(rawVersionLabel) : rawVersionLabel;
    badges.push({
      color: 'success',
      key: `version:${rawVersionLabel}`,
      label: versionLabel,
      title: compact && versionLabel !== rawVersionLabel ? rawVersionLabel : undefined,
      variant: 'filled',
    });
  }

  if (assetPrimaryRenditionKind) {
    const baseLabel = t(`detail.asset.rendition.${assetPrimaryRenditionKind}`, {
      defaultValue: String(assetPrimaryRenditionKind),
      ns: 'file',
    });
    const renditionLabel = assetPrimaryRenditionLabel?.trim();
    const extraCount = Math.max((assetRenditionCount ?? 0) - 1, 0);
    const fullLabelParts = [
      baseLabel,
      ...(renditionLabel ? [renditionLabel] : []),
      ...(extraCount > 0 ? [`+${extraCount}`] : []),
    ];
    const labelParts = compact
      ? [baseLabel, ...(extraCount > 0 ? [`+${extraCount}`] : [])]
      : [
          baseLabel,
          ...(renditionLabel ? [normalizeCompactLabel(renditionLabel, 18)] : []),
          ...(extraCount > 0 ? [`+${extraCount}`] : []),
        ];

    badges.push({
      color: 'processing',
      key: `rendition:${assetPrimaryRenditionKind}:${renditionLabel ?? ''}:${extraCount}`,
      label: labelParts.join(' · '),
      title: compact && renditionLabel ? fullLabelParts.join(' · ') : undefined,
      variant: 'outlined',
    });
  }

  if (assetClassification && assetClassification !== 'general') {
    badges.push({
      key: `classification:${assetClassification}`,
      label: t(`detail.asset.classification.${assetClassification}`, {
        defaultValue: String(assetClassification),
        ns: 'file',
      }),
      variant: 'outlined',
    });
  }

  if (compact && maxVisible && badges.length > maxVisible) {
    const visibleBadges = badges.slice(0, maxVisible - 1);
    const hiddenBadges = badges.slice(maxVisible - 1);

    visibleBadges.push({
      key: `overflow:${hiddenBadges.map((badge) => badge.key).join('|')}`,
      label: `+${hiddenBadges.length}`,
      title: hiddenBadges.map((badge) => badge.title ?? badge.label).join(' · '),
      variant: 'outlined',
    });

    return visibleBadges;
  }

  return badges;
};
