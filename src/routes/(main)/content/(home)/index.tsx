'use client';

import { memo, useLayoutEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import ContentManager from '@/features/ContentManager';
import { getFileScope, getSourceSetScopeId } from '@/features/ContentManager/useFileScope';
import {
  type FileAssetClassification,
  type FileAssetReviewStatus,
  type FileAssetUsagePolicy,
  FilesTabs,
} from '@/types/files';

import { useInitFileCheck } from '../features/hooks/useInitFileCheck';
import { useContentManagerStore } from '../features/store';

const ContentHomePage = memo(() => {
  const [searchParams] = useSearchParams();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const [
    assetClassification,
    assetRightsOwner,
    assetReviewStatus,
    assetUsagePolicy,
    category,
    currentSourceSetId,
    currentSpaceId,
    setAssetClassification,
    setAssetRightsOwner,
    setAssetReviewStatus,
    setAssetUsagePolicy,
    setCategory,
    setActiveSourceSetId,
    setSpaceId,
  ] = useContentManagerStore((s) => [
    s.assetClassification,
    s.assetRightsOwner,
    s.assetReviewStatus,
    s.assetUsagePolicy,
    s.category,
    s.sourceSetId,
    s.spaceId,
    s.setAssetClassification,
    s.setAssetRightsOwner,
    s.setAssetReviewStatus,
    s.setAssetUsagePolicy,
    s.setCategory,
    s.setSourceSetId,
    s.setSpaceId,
  ]);

  const assetClassificationParam =
    (searchParams.get('assetClassification') as FileAssetClassification | null) || undefined;
  const assetRightsOwnerParam = searchParams.get('assetRightsOwner')?.trim() || undefined;
  const assetReviewStatusParam =
    (searchParams.get('assetReviewStatus') as FileAssetReviewStatus | null) || undefined;
  const assetUsagePolicyParam =
    (searchParams.get('assetUsagePolicy') as FileAssetUsagePolicy | null) || undefined;
  const categoryParam = (searchParams.get('category') as FilesTabs) || FilesTabs.Home;
  const scopedSourceSetId = getSourceSetScopeId(getFileScope(searchParams)) ?? undefined;
  const isRouteStateReady =
    currentSpaceId === spaceId &&
    currentSourceSetId === scopedSourceSetId &&
    assetClassification === assetClassificationParam &&
    assetRightsOwner === assetRightsOwnerParam &&
    assetReviewStatus === assetReviewStatusParam &&
    assetUsagePolicy === assetUsagePolicyParam &&
    category === categoryParam;

  useLayoutEffect(() => {
    setActiveSourceSetId(scopedSourceSetId);
    setSpaceId(spaceId);
  }, [scopedSourceSetId, setActiveSourceSetId, setSpaceId, spaceId]);

  useLayoutEffect(() => {
    setAssetClassification(assetClassificationParam);
    setAssetRightsOwner(assetRightsOwnerParam);
    setAssetReviewStatus(assetReviewStatusParam);
    setAssetUsagePolicy(assetUsagePolicyParam);
    setCategory(categoryParam);
  }, [
    assetClassificationParam,
    assetRightsOwnerParam,
    assetReviewStatusParam,
    assetUsagePolicyParam,
    categoryParam,
    setAssetClassification,
    setAssetRightsOwner,
    setAssetReviewStatus,
    setAssetUsagePolicy,
    setCategory,
  ]);

  // Sync file view mode from URL
  useInitFileCheck();

  if (!isRouteStateReady) return null;

  return <ContentManager />;
});

ContentHomePage.displayName = 'ContentHomePage';

export default ContentHomePage;
