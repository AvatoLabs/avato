'use client';

import { Button, Flexbox, Icon, Segmented, type SegmentedProps } from '@lobehub/ui';
import { Drawer, Input, Popover, Select } from 'antd';
import { createStaticStyles } from 'antd-style';
import { SlidersHorizontal } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import {
  buildExplorerQueryParams,
  getExplorerCategoryFilter,
} from '@/features/ContentManager/components/Explorer/queryParams';
import { getFileScope } from '@/features/ContentManager/useFileScope';
import { buildFilesRootPath, stripFilesItemPath } from '@/features/ResourceSpaces';
import {
  useContentManagerFetchGovernanceSummary,
  useContentManagerStore,
} from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';
import { useServerConfigStore } from '@/store/serverConfig';
import {
  FileAssetClassification,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
  FilesTabs,
} from '@/types/files';

const GOVERNANCE_PANEL_QUERY_KEY = 'openGovernance';
const GOVERNANCE_PANEL_FOCUS_QUERY_KEY = 'focusGovernance';

const styles = createStaticStyles(({ css, cssVar }) => ({
  containerMobile: css`
    scrollbar-width: none;
    overflow-x: auto;
    width: 100%;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  option: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  `,
  segmented: css`
    flex-shrink: 0;

    padding: 2px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorFillTertiary} 72%, ${cssVar.colorBgContainer} 28%);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 8%, transparent),
      0 1px 2px color-mix(in srgb, ${cssVar.colorText} 6%, transparent);

    :global(.ant-segmented-group) {
      gap: 2px;
    }

    :global(.ant-segmented-item) {
      color: ${cssVar.colorTextSecondary};
      transition: color ${cssVar.motionDurationMid};
    }

    :global(.ant-segmented-item-selected) {
      color: ${cssVar.colorText};
    }

    :global(.ant-segmented-item-label) {
      min-height: 28px;
      padding-block: 0;
      padding-inline: 10px;
    }

    :global(.ant-segmented-thumb) {
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 999px;
      background: ${cssVar.colorBgContainer};
      box-shadow: 0 10px 24px color-mix(in srgb, ${cssVar.colorText} 10%, transparent);
    }
  `,
  segmentedMobile: css`
    width: max-content;
    min-width: 100%;
  `,
  governanceButton: css`
    flex-shrink: 0;
  `,
  governanceButtonMobile: css`
    border-radius: 999px !important;
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 45%, transparent),
      0 10px 24px -24px color-mix(in srgb, ${cssVar.colorText} 24%, transparent);
  `,
  governanceToolbar: css`
    flex-wrap: nowrap;
    min-width: 0;
  `,
  governanceToolbarMobile: css`
    flex-wrap: wrap;
    gap: 6px;
  `,
  governanceSummaryBar: css`
    flex-wrap: wrap;
    align-items: center;
    min-width: 0;
  `,
  governanceSummaryBarMobile: css`
    padding: 8px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 76%, transparent);
  `,
  governanceSummaryActions: css`
    flex-shrink: 0;
  `,
  governanceSummaryActionsMobile: css`
    width: 100%;

    :global(button) {
      flex: 1;
    }
  `,
  governanceSummaryMeta: css`
    min-width: 0;
  `,
  governanceSummaryMetaMobile: css`
    gap: 6px;
    width: 100%;
  `,
  governanceSummaryLabels: css`
    overflow: hidden;
    flex: 1;
    min-width: 160px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  governanceSummaryText: css`
    flex-shrink: 0;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;
  `,
  governanceSummaryTextMobile: css`
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  `,
  mobileSummaryLead: css`
    color: ${cssVar.colorText};
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  `,
  governancePopover: css`
    min-width: 216px;
  `,
  governanceSelect: css`
    width: 100%;
  `,
  governanceSection: css`
    gap: 6px;
  `,
  governanceSectionFocused: css`
    padding: 8px;
    border: 1px solid ${cssVar.colorPrimaryBorder};
    border-radius: ${cssVar.borderRadius}px;
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 52%, ${cssVar.colorBgContainer} 48%);
  `,
  governanceSectionActions: css`
    justify-content: flex-end;
  `,
}));

const CategoryMenu = memo(() => {
  const { t } = useTranslation('file');
  const { spaceId } = useParams<{ spaceId?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeKey, currentFolderId, sourceSetId, setMode] = useContentManagerStore((s) => [
    s.category,
    s.currentFolderId,
    s.sourceSetId,
    s.setMode,
  ]);
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const navigate = useNavigate();
  const rootPath = buildFilesRootPath(spaceId);
  const basePath = useMemo(() => {
    const currentPath = stripFilesItemPath(location.pathname);

    return currentPath.startsWith(rootPath) ? currentPath : rootPath;
  }, [location.pathname, rootPath]);
  const classificationParam =
    (searchParams.get('assetClassification') as FileAssetClassification | null) || undefined;
  const rightsOwnerParam = searchParams.get('assetRightsOwner')?.trim() || undefined;
  const reviewStatusParam =
    (searchParams.get('assetReviewStatus') as FileAssetReviewStatus | null) || undefined;
  const usagePolicyParam =
    (searchParams.get('assetUsagePolicy') as FileAssetUsagePolicy | null) || undefined;
  const focusedGovernanceFilter = searchParams.get(GOVERNANCE_PANEL_FOCUS_QUERY_KEY) || undefined;
  const showCategoryTabs = !sourceSetId;
  const activeGovernanceFilterCount =
    Number(Boolean(classificationParam)) +
    Number(Boolean(rightsOwnerParam)) +
    Number(Boolean(reviewStatusParam)) +
    Number(Boolean(usagePolicyParam));
  const [draftRightsOwner, setDraftRightsOwner] = useState(rightsOwnerParam ?? '');
  const fileScope = getFileScope(searchParams);
  const governanceSummaryParams = useMemo(
    () =>
      buildExplorerQueryParams({
        assetClassification: classificationParam,
        assetRightsOwner: rightsOwnerParam,
        assetReviewStatus: reviewStatusParam,
        assetUsagePolicy: usagePolicyParam,
        category: getExplorerCategoryFilter(activeKey, sourceSetId),
        currentFolderSlug: currentFolderId,
        scope: fileScope === 'unassigned' ? 'unassigned' : 'all',
        sourceSetId,
        spaceId,
      }),
    [
      activeKey,
      classificationParam,
      currentFolderId,
      fileScope,
      rightsOwnerParam,
      reviewStatusParam,
      sourceSetId,
      spaceId,
      usagePolicyParam,
    ],
  );
  const { data: governanceSummary } =
    useContentManagerFetchGovernanceSummary(governanceSummaryParams);

  const withGovernanceCount = (label: string, count?: number) =>
    governanceSummary ? `${label} (${count ?? 0})` : label;

  useEffect(() => {
    setDraftRightsOwner(rightsOwnerParam ?? '');
  }, [rightsOwnerParam]);

  useEffect(() => {
    if (searchParams.get(GOVERNANCE_PANEL_QUERY_KEY) === '1') {
      setGovernanceOpen(true);
    }
  }, [searchParams]);

  const items = useMemo<SegmentedProps['options']>(
    () => [
      {
        key: FilesTabs.Home,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.all} size={14} />
            {t('tab.all', { defaultValue: 'All' })}
          </span>
        ),
        value: FilesTabs.Home,
      },
      {
        key: FilesTabs.Images,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.images} size={14} />
            {t('tab.images')}
          </span>
        ),
        value: FilesTabs.Images,
      },
      {
        key: FilesTabs.Audios,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.audios} size={14} />
            {t('tab.audios')}
          </span>
        ),
        value: FilesTabs.Audios,
      },
      {
        key: FilesTabs.Videos,
        label: (
          <span className={styles.option}>
            <Icon icon={RESOURCE_ENTRY_ICONS.videos} size={14} />
            {t('tab.videos')}
          </span>
        ),
        value: FilesTabs.Videos,
      },
    ],
    [t],
  );

  const getCategoryUrl = (value: FilesTabs) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);

    if (value === FilesTabs.Home) {
      nextParams.delete('category');
    } else {
      nextParams.set('category', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const classificationLabels = useMemo(
    () => ({
      [FileAssetClassification.Brand]: t('detail.asset.classification.brand'),
      [FileAssetClassification.Finance]: t('detail.asset.classification.finance'),
      [FileAssetClassification.General]: t('detail.asset.classification.general'),
      [FileAssetClassification.Hr]: t('detail.asset.classification.hr'),
      [FileAssetClassification.Legal]: t('detail.asset.classification.legal'),
      [FileAssetClassification.Product]: t('detail.asset.classification.product'),
    }),
    [t],
  );

  const classificationOptions = useMemo(
    () => [
      {
        label: withGovernanceCount(
          t('detail.asset.classification.all'),
          governanceSummary?.classification.total,
        ),
        value: 'all',
      },
      {
        label: withGovernanceCount(
          t('detail.asset.classification.general'),
          governanceSummary?.classification.counts[FileAssetClassification.General],
        ),
        value: FileAssetClassification.General,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.classification.brand'),
          governanceSummary?.classification.counts[FileAssetClassification.Brand],
        ),
        value: FileAssetClassification.Brand,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.classification.product'),
          governanceSummary?.classification.counts[FileAssetClassification.Product],
        ),
        value: FileAssetClassification.Product,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.classification.legal'),
          governanceSummary?.classification.counts[FileAssetClassification.Legal],
        ),
        value: FileAssetClassification.Legal,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.classification.finance'),
          governanceSummary?.classification.counts[FileAssetClassification.Finance],
        ),
        value: FileAssetClassification.Finance,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.classification.hr'),
          governanceSummary?.classification.counts[FileAssetClassification.Hr],
        ),
        value: FileAssetClassification.Hr,
      },
    ],
    [governanceSummary, t],
  );

  const getClassificationUrl = (value?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);

    if (!value || value === 'all') {
      nextParams.delete('assetClassification');
    } else {
      nextParams.set('assetClassification', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const usagePolicyOptions = useMemo(
    () => [
      {
        label: withGovernanceCount(
          t('detail.asset.usagePolicy.all'),
          governanceSummary?.usagePolicy.total,
        ),
        value: 'all',
      },
      {
        label: withGovernanceCount(
          t('detail.asset.usagePolicy.internal'),
          governanceSummary?.usagePolicy.counts[FileAssetUsagePolicy.Internal],
        ),
        value: FileAssetUsagePolicy.Internal,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.usagePolicy.public'),
          governanceSummary?.usagePolicy.counts[FileAssetUsagePolicy.Public],
        ),
        value: FileAssetUsagePolicy.Public,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.usagePolicy.restricted'),
          governanceSummary?.usagePolicy.counts[FileAssetUsagePolicy.Restricted],
        ),
        value: FileAssetUsagePolicy.Restricted,
      },
    ],
    [governanceSummary, t],
  );

  const usagePolicyLabels = useMemo(
    () => ({
      [FileAssetUsagePolicy.Internal]: t('detail.asset.usagePolicy.internal'),
      [FileAssetUsagePolicy.Public]: t('detail.asset.usagePolicy.public'),
      [FileAssetUsagePolicy.Restricted]: t('detail.asset.usagePolicy.restricted'),
    }),
    [t],
  );

  const reviewStatusOptions = useMemo(
    () => [
      {
        label: withGovernanceCount(
          t('detail.asset.reviewStatus.all'),
          governanceSummary?.reviewStatus.total,
        ),
        value: 'all',
      },
      {
        label: withGovernanceCount(
          t('detail.asset.reviewStatus.draft'),
          governanceSummary?.reviewStatus.counts[FileAssetReviewStatus.Draft],
        ),
        value: FileAssetReviewStatus.Draft,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.reviewStatus.approved'),
          governanceSummary?.reviewStatus.counts[FileAssetReviewStatus.Approved],
        ),
        value: FileAssetReviewStatus.Approved,
      },
      {
        label: withGovernanceCount(
          t('detail.asset.reviewStatus.archived'),
          governanceSummary?.reviewStatus.counts[FileAssetReviewStatus.Archived],
        ),
        value: FileAssetReviewStatus.Archived,
      },
    ],
    [governanceSummary, t],
  );

  const reviewStatusLabels = useMemo(
    () => ({
      [FileAssetReviewStatus.Approved]: t('detail.asset.reviewStatus.approved'),
      [FileAssetReviewStatus.Archived]: t('detail.asset.reviewStatus.archived'),
      [FileAssetReviewStatus.Draft]: t('detail.asset.reviewStatus.draft'),
    }),
    [t],
  );

  const getUsagePolicyUrl = (value?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);

    if (!value || value === 'all') {
      nextParams.delete('assetUsagePolicy');
    } else {
      nextParams.set('assetUsagePolicy', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getRightsOwnerUrl = (value?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);

    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      nextParams.delete('assetRightsOwner');
    } else {
      nextParams.set('assetRightsOwner', normalizedValue);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getReviewStatusUrl = (value?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);

    if (!value || value === 'all') {
      nextParams.delete('assetReviewStatus');
    } else {
      nextParams.set('assetReviewStatus', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getClearedGovernanceUrl = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);
    nextParams.delete('assetClassification');
    nextParams.delete('assetRightsOwner');
    nextParams.delete('assetReviewStatus');
    nextParams.delete('assetUsagePolicy');

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const governanceLabel =
    activeGovernanceFilterCount > 0
      ? t('filters.governanceActive', { count: activeGovernanceFilterCount })
      : t('filters.governance');
  const matchingFilesCount = useFileStore((s) => s.total);
  const hasPendingRightsOwnerDraft = draftRightsOwner.trim() !== (rightsOwnerParam ?? '');

  const activeGovernanceFilters = useMemo(
    () =>
      [
        classificationParam
          ? {
              focusKey: 'assetClassification',
              key: 'classification',
              label: `${t('detail.asset.classification.label')}: ${
                classificationLabels[classificationParam] ?? classificationParam
              }`,
            }
          : null,
        rightsOwnerParam
          ? {
              focusKey: 'assetRightsOwner',
              key: 'rightsOwner',
              label: `${t('detail.asset.rightsOwner.label')}: ${rightsOwnerParam}`,
            }
          : null,
        reviewStatusParam
          ? {
              focusKey: 'assetReviewStatus',
              key: 'reviewStatus',
              label: `${t('detail.asset.reviewStatus.label')}: ${
                reviewStatusLabels[reviewStatusParam] ?? reviewStatusParam
              }`,
            }
          : null,
        usagePolicyParam
          ? {
              focusKey: 'assetUsagePolicy',
              key: 'usagePolicy',
              label: `${t('detail.asset.usagePolicy.label')}: ${
                usagePolicyLabels[usagePolicyParam] ?? usagePolicyParam
              }`,
            }
          : null,
      ].filter(Boolean) as Array<{
        focusKey: string;
        key: string;
        label: string;
      }>,
    [
      classificationLabels,
      classificationParam,
      rightsOwnerParam,
      reviewStatusLabels,
      reviewStatusParam,
      t,
      usagePolicyLabels,
      usagePolicyParam,
    ],
  );
  const activeGovernanceSummary = activeGovernanceFilters.map((filter) => filter.label).join(' · ');

  const applyRightsOwnerFilter = (value = draftRightsOwner, options?: { close?: boolean }) => {
    setMode('explorer');
    if (options?.close) setGovernanceOpen(false);
    navigate(getRightsOwnerUrl(value), { replace: true });
  };

  const resetDraftRightsOwner = () => {
    setDraftRightsOwner(rightsOwnerParam ?? '');
  };

  const closeGovernancePanel = () => {
    resetDraftRightsOwner();
    setGovernanceOpen(false);

    if (searchParams.get(GOVERNANCE_PANEL_QUERY_KEY) !== '1') return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(GOVERNANCE_PANEL_QUERY_KEY);
    nextParams.delete(GOVERNANCE_PANEL_FOCUS_QUERY_KEY);
    const queryString = nextParams.toString();
    navigate(queryString ? `${basePath}?${queryString}` : basePath, { replace: true });
  };

  const getFocusedGovernanceUrl = (focusFilter: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.set(GOVERNANCE_PANEL_QUERY_KEY, '1');
    nextParams.set(GOVERNANCE_PANEL_FOCUS_QUERY_KEY, focusFilter);

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  return (
    <Flexbox gap={6} style={{ minWidth: 0 }}>
      <Flexbox
        horizontal
        align={'center'}
        className={`${styles.governanceToolbar}${
          isMobile ? ` ${styles.governanceToolbarMobile} ${styles.containerMobile}` : ''
        }`}
        gap={8}
      >
        {showCategoryTabs && (
          <Segmented
            className={`${styles.segmented}${isMobile ? ` ${styles.segmentedMobile}` : ''}`}
            options={items}
            size={'small'}
            value={activeKey}
            onChange={(value) => {
              setMode('explorer');
              navigate(getCategoryUrl(value as FilesTabs), { replace: true });
            }}
          />
        )}
        {isMobile ? (
          <>
            <Button
              className={`${styles.governanceButton} ${styles.governanceButtonMobile}`}
              color={activeGovernanceFilterCount > 0 ? 'primary' : undefined}
              icon={SlidersHorizontal}
              size={'small'}
              variant={activeGovernanceFilterCount > 0 ? 'filled' : 'text'}
              onClick={() => setGovernanceOpen(true)}
            >
              {governanceLabel}
            </Button>
            <Drawer
              destroyOnHidden
              height={'auto'}
              open={governanceOpen}
              placement={'bottom'}
              title={t('filters.governance')}
              onClose={closeGovernancePanel}
            >
              <Flexbox className={styles.governancePopover} gap={12}>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetClassification'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetClassification'}
                  data-testid="governance-section-assetClassification"
                  gap={6}
                >
                  <span>{t('detail.asset.classification.label')}</span>
                  <Select
                    aria-label={t('detail.asset.classification.label')}
                    className={styles.governanceSelect}
                    options={classificationOptions}
                    size={'small'}
                    value={classificationParam ?? 'all'}
                    onChange={(value) => {
                      setMode('explorer');
                      setGovernanceOpen(false);
                      navigate(getClassificationUrl(value), { replace: true });
                    }}
                  />
                </Flexbox>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetUsagePolicy'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetUsagePolicy'}
                  data-testid="governance-section-assetUsagePolicy"
                  gap={6}
                >
                  <span>{t('detail.asset.usagePolicy.label')}</span>
                  <Select
                    aria-label={t('detail.asset.usagePolicy.label')}
                    className={styles.governanceSelect}
                    options={usagePolicyOptions}
                    size={'small'}
                    value={usagePolicyParam ?? 'all'}
                    onChange={(value) => {
                      setMode('explorer');
                      setGovernanceOpen(false);
                      navigate(getUsagePolicyUrl(value), { replace: true });
                    }}
                  />
                </Flexbox>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetRightsOwner'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetRightsOwner'}
                  data-testid="governance-section-assetRightsOwner"
                  gap={6}
                >
                  <span>{t('detail.asset.rightsOwner.label')}</span>
                  <Input
                    allowClear
                    aria-label={t('detail.asset.rightsOwner.label')}
                    className={styles.governanceSelect}
                    placeholder={t('detail.asset.rightsOwner.placeholder')}
                    size={'small'}
                    value={draftRightsOwner}
                    onChange={(event) => setDraftRightsOwner(event.target.value)}
                    onPressEnter={() => {
                      applyRightsOwnerFilter(draftRightsOwner, { close: true });
                    }}
                  />
                  {hasPendingRightsOwnerDraft && (
                    <Flexbox className={styles.governanceSectionActions} horizontal>
                      <Button
                        size={'small'}
                        type={'primary'}
                        onClick={() => applyRightsOwnerFilter(draftRightsOwner, { close: true })}
                      >
                        {t('filters.apply')}
                      </Button>
                    </Flexbox>
                  )}
                </Flexbox>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetReviewStatus'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetReviewStatus'}
                  data-testid="governance-section-assetReviewStatus"
                  gap={6}
                >
                  <span>{t('detail.asset.reviewStatus.label')}</span>
                  <Select
                    aria-label={t('detail.asset.reviewStatus.label')}
                    className={styles.governanceSelect}
                    options={reviewStatusOptions}
                    size={'small'}
                    value={reviewStatusParam ?? 'all'}
                    onChange={(value) => {
                      setMode('explorer');
                      setGovernanceOpen(false);
                      navigate(getReviewStatusUrl(value), { replace: true });
                    }}
                  />
                </Flexbox>
                {activeGovernanceFilterCount > 0 && (
                  <Flexbox horizontal justify={'flex-end'}>
                    <Button
                      size={'small'}
                      type={'text'}
                      onClick={() => {
                        setMode('explorer');
                        setGovernanceOpen(false);
                        navigate(getClearedGovernanceUrl(), { replace: true });
                      }}
                    >
                      {t('filters.clearGovernance')}
                    </Button>
                  </Flexbox>
                )}
              </Flexbox>
            </Drawer>
          </>
        ) : (
          <Popover
            destroyOnHidden
            open={governanceOpen}
            placement={'bottomLeft'}
            trigger={['click']}
            onOpenChange={(open) => {
              if (!open) {
                closeGovernancePanel();
                return;
              }

              setGovernanceOpen(true);
            }}
            content={
              <Flexbox className={styles.governancePopover} gap={12}>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetClassification'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetClassification'}
                  data-testid="governance-section-assetClassification"
                  gap={6}
                >
                  <span>{t('detail.asset.classification.label')}</span>
                  <Select
                    aria-label={t('detail.asset.classification.label')}
                    className={styles.governanceSelect}
                    options={classificationOptions}
                    size={'small'}
                    value={classificationParam ?? 'all'}
                    onChange={(value) => {
                      setMode('explorer');
                      setGovernanceOpen(false);
                      navigate(getClassificationUrl(value), { replace: true });
                    }}
                  />
                </Flexbox>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetUsagePolicy'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetUsagePolicy'}
                  data-testid="governance-section-assetUsagePolicy"
                  gap={6}
                >
                  <span>{t('detail.asset.usagePolicy.label')}</span>
                  <Select
                    aria-label={t('detail.asset.usagePolicy.label')}
                    className={styles.governanceSelect}
                    options={usagePolicyOptions}
                    size={'small'}
                    value={usagePolicyParam ?? 'all'}
                    onChange={(value) => {
                      setMode('explorer');
                      setGovernanceOpen(false);
                      navigate(getUsagePolicyUrl(value), { replace: true });
                    }}
                  />
                </Flexbox>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetRightsOwner'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetRightsOwner'}
                  data-testid="governance-section-assetRightsOwner"
                  gap={6}
                >
                  <span>{t('detail.asset.rightsOwner.label')}</span>
                  <Input
                    allowClear
                    aria-label={t('detail.asset.rightsOwner.label')}
                    className={styles.governanceSelect}
                    placeholder={t('detail.asset.rightsOwner.placeholder')}
                    size={'small'}
                    value={draftRightsOwner}
                    onChange={(event) => setDraftRightsOwner(event.target.value)}
                    onPressEnter={() => applyRightsOwnerFilter(draftRightsOwner, { close: true })}
                  />
                  {hasPendingRightsOwnerDraft && (
                    <Flexbox className={styles.governanceSectionActions} horizontal>
                      <Button
                        size={'small'}
                        type={'primary'}
                        onClick={() => applyRightsOwnerFilter(draftRightsOwner, { close: true })}
                      >
                        {t('filters.apply')}
                      </Button>
                    </Flexbox>
                  )}
                </Flexbox>
                <Flexbox
                  className={`${styles.governanceSection}${
                    focusedGovernanceFilter === 'assetReviewStatus'
                      ? ` ${styles.governanceSectionFocused}`
                      : ''
                  }`}
                  data-focused={focusedGovernanceFilter === 'assetReviewStatus'}
                  data-testid="governance-section-assetReviewStatus"
                  gap={6}
                >
                  <span>{t('detail.asset.reviewStatus.label')}</span>
                  <Select
                    aria-label={t('detail.asset.reviewStatus.label')}
                    className={styles.governanceSelect}
                    options={reviewStatusOptions}
                    size={'small'}
                    value={reviewStatusParam ?? 'all'}
                    onChange={(value) => {
                      setMode('explorer');
                      setGovernanceOpen(false);
                      navigate(getReviewStatusUrl(value), { replace: true });
                    }}
                  />
                </Flexbox>
                {activeGovernanceFilterCount > 0 && (
                  <Flexbox horizontal justify={'flex-end'}>
                    <Button
                      size={'small'}
                      type={'text'}
                      onClick={() => {
                        setMode('explorer');
                        setGovernanceOpen(false);
                        navigate(getClearedGovernanceUrl(), { replace: true });
                      }}
                    >
                      {t('filters.clearGovernance')}
                    </Button>
                  </Flexbox>
                )}
              </Flexbox>
            }
          >
            <Button
              className={styles.governanceButton}
              color={activeGovernanceFilterCount > 0 ? 'primary' : undefined}
              icon={SlidersHorizontal}
              size={'small'}
              variant={activeGovernanceFilterCount > 0 ? 'filled' : 'text'}
            >
              {governanceLabel}
            </Button>
          </Popover>
        )}
      </Flexbox>
      {activeGovernanceFilters.length > 0 && (
        <Flexbox
          horizontal={!isMobile}
          className={`${styles.governanceSummaryBar}${
            isMobile ? ` ${styles.governanceSummaryBarMobile}` : ''
          }`}
          data-testid="governance-summary-bar"
          gap={8}
        >
          <Flexbox
            className={`${styles.governanceSummaryMeta}${
              isMobile ? ` ${styles.governanceSummaryMetaMobile}` : ''
            }`}
            gap={isMobile ? 6 : 0}
          >
            <Flexbox horizontal gap={8} wrap={isMobile ? 'wrap' : undefined}>
              {typeof matchingFilesCount === 'number' && (
                <span className={isMobile ? styles.mobileSummaryLead : styles.governanceSummaryText}>
                  {t('filters.matchingFiles', { count: matchingFilesCount })}
                </span>
              )}
              <span
                className={`${styles.governanceSummaryText}${
                  isMobile ? ` ${styles.governanceSummaryTextMobile}` : ''
                }`}
              >
                {governanceLabel}
              </span>
            </Flexbox>
            <span className={styles.governanceSummaryLabels} title={activeGovernanceSummary}>
              {activeGovernanceSummary}
            </span>
          </Flexbox>
          <Flexbox
            horizontal
            className={`${styles.governanceSummaryActions}${
              isMobile ? ` ${styles.governanceSummaryActionsMobile}` : ''
            }`}
            gap={4}
          >
            <Button
              aria-label={t('filters.adjustGovernance')}
              block={isMobile}
              size={'small'}
              variant={'outlined'}
              onClick={() => {
                const focusKey = activeGovernanceFilters[0]?.focusKey;
                if (!focusKey) return;
                setMode('explorer');
                navigate(getFocusedGovernanceUrl(focusKey), { replace: true });
              }}
            >
              {t('filters.adjustGovernance')}
            </Button>
            <Button
              block={isMobile}
              size={'small'}
              type={'text'}
              onClick={() => {
                setMode('explorer');
                navigate(getClearedGovernanceUrl(), { replace: true });
              }}
            >
              {t('filters.clearGovernance')}
            </Button>
          </Flexbox>
        </Flexbox>
      )}
    </Flexbox>
  );
});

CategoryMenu.displayName = 'CategoryMenu';

export default CategoryMenu;
