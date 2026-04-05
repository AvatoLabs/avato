import type {
  FileAssetClassification,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';
import type { TFunction } from 'i18next';

interface BuildFileAssetBadgesParams {
  assetClassification?: FileAssetClassification | null;
  assetReviewStatus?: FileAssetReviewStatus | null;
  assetUsagePolicy?: FileAssetUsagePolicy | null;
  t: TFunction;
}

export interface FileAssetBadgeDescriptor {
  color?: 'gold' | 'processing' | 'success';
  key: string;
  label: string;
  variant: 'filled' | 'outlined';
}

export const buildFileAssetBadges = ({
  assetClassification,
  assetReviewStatus,
  assetUsagePolicy,
  t,
}: BuildFileAssetBadgesParams): FileAssetBadgeDescriptor[] => {
  const badges: FileAssetBadgeDescriptor[] = [];

  if (assetReviewStatus === 'archived') {
    badges.push({
      color: 'gold',
      key: `review:${assetReviewStatus}`,
      label: t(`detail.asset.reviewStatus.${assetReviewStatus}`, { ns: 'file' }),
      variant: 'filled',
    });
  }

  if (assetUsagePolicy && assetUsagePolicy !== 'internal') {
    badges.push({
      color: assetUsagePolicy === 'restricted' ? 'gold' : 'processing',
      key: `usage:${assetUsagePolicy}`,
      label: t(`detail.asset.usagePolicy.${assetUsagePolicy}`, { ns: 'file' }),
      variant: 'outlined',
    });
  }

  if (assetClassification && assetClassification !== 'general') {
    badges.push({
      key: `classification:${assetClassification}`,
      label: t(`detail.asset.classification.${assetClassification}`, { ns: 'file' }),
      variant: 'outlined',
    });
  }

  return badges;
};
