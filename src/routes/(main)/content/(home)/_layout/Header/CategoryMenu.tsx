'use client';

import { Button, Flexbox, Icon, Segmented, type SegmentedProps } from '@lobehub/ui';
import { Popover, Select } from 'antd';
import { createStaticStyles } from 'antd-style';
import { SlidersHorizontal, X } from 'lucide-react';
import { memo, useMemo } from 'react';
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
  governanceFilters: css`
    flex-wrap: wrap;
  `,
  governanceFilterChip: css`
    flex-shrink: 0;
  `,
  governanceSummaryText: css`
    flex-shrink: 0;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
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
  const navigate = useNavigate();
  const rootPath = buildFilesRootPath(spaceId);
  const basePath = useMemo(() => {
    const currentPath = stripFilesItemPath(location.pathname);

    return currentPath.startsWith(rootPath) ? currentPath : rootPath;
  }, [location.pathname, rootPath]);
  const classificationParam =
    (searchParams.get('assetClassification') as FileAssetClassification | null) || undefined;
  const reviewStatusParam =
    (searchParams.get('assetReviewStatus') as FileAssetReviewStatus | null) || undefined;
  const usagePolicyParam =
    (searchParams.get('assetUsagePolicy') as FileAssetUsagePolicy | null) || undefined;
  const showCategoryTabs = !sourceSetId;
  const activeGovernanceFilterCount =
    Number(Boolean(classificationParam)) +
    Number(Boolean(reviewStatusParam)) +
    Number(Boolean(usagePolicyParam));
  const fileScope = getFileScope(searchParams);
  const governanceSummaryParams = useMemo(
    () =>
      buildExplorerQueryParams({
        assetClassification: classificationParam,
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
    nextParams.delete('files');

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
    nextParams.delete('files');

    if (!value || value === 'all') {
      nextParams.delete('assetClassification');
    } else {
      nextParams.set('assetClassification', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getClearedClassificationUrl = () => getClassificationUrl('all');

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
    nextParams.delete('files');

    if (!value || value === 'all') {
      nextParams.delete('assetUsagePolicy');
    } else {
      nextParams.set('assetUsagePolicy', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getClearedUsagePolicyUrl = () => getUsagePolicyUrl('all');

  const getReviewStatusUrl = (value?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete('files');

    if (!value || value === 'all') {
      nextParams.delete('assetReviewStatus');
    } else {
      nextParams.set('assetReviewStatus', value);
    }

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getClearedReviewStatusUrl = () => getReviewStatusUrl('all');

  const getClearedGovernanceUrl = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete('files');
    nextParams.delete('assetClassification');
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

  const activeGovernanceFilters = useMemo(
    () =>
      [
        classificationParam
          ? {
              clearUrl: getClearedClassificationUrl(),
              key: 'classification',
              label: `${t('detail.asset.classification.label')}: ${
                classificationLabels[classificationParam] ?? classificationParam
              }`,
            }
          : null,
        reviewStatusParam
          ? {
              clearUrl: getClearedReviewStatusUrl(),
              key: 'reviewStatus',
              label: `${t('detail.asset.reviewStatus.label')}: ${
                reviewStatusLabels[reviewStatusParam] ?? reviewStatusParam
              }`,
            }
          : null,
        usagePolicyParam
          ? {
              clearUrl: getClearedUsagePolicyUrl(),
              key: 'usagePolicy',
              label: `${t('detail.asset.usagePolicy.label')}: ${
                usagePolicyLabels[usagePolicyParam] ?? usagePolicyParam
              }`,
            }
          : null,
      ].filter(Boolean) as Array<{ clearUrl: string; key: string; label: string }>,
    [
      classificationLabels,
      classificationParam,
      reviewStatusLabels,
      reviewStatusParam,
      t,
      usagePolicyLabels,
      usagePolicyParam,
    ],
  );

  return (
    <Flexbox
      horizontal
      align={'center'}
      className={isMobile ? styles.containerMobile : undefined}
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
      <Popover
        destroyOnHidden
        placement={'bottomLeft'}
        trigger={['click']}
        content={
          <Flexbox className={styles.governancePopover} gap={12}>
            <Flexbox className={styles.governanceSection} gap={6}>
              <span>{t('detail.asset.classification.label')}</span>
              <Select
                aria-label={t('detail.asset.classification.label')}
                className={styles.governanceSelect}
                options={classificationOptions}
                size={'small'}
                value={classificationParam ?? 'all'}
                onChange={(value) => {
                  setMode('explorer');
                  navigate(getClassificationUrl(value), { replace: true });
                }}
              />
            </Flexbox>
            <Flexbox className={styles.governanceSection} gap={6}>
              <span>{t('detail.asset.usagePolicy.label')}</span>
              <Select
                aria-label={t('detail.asset.usagePolicy.label')}
                className={styles.governanceSelect}
                options={usagePolicyOptions}
                size={'small'}
                value={usagePolicyParam ?? 'all'}
                onChange={(value) => {
                  setMode('explorer');
                  navigate(getUsagePolicyUrl(value), { replace: true });
                }}
              />
            </Flexbox>
            <Flexbox className={styles.governanceSection} gap={6}>
              <span>{t('detail.asset.reviewStatus.label')}</span>
              <Select
                aria-label={t('detail.asset.reviewStatus.label')}
                className={styles.governanceSelect}
                options={reviewStatusOptions}
                size={'small'}
                value={reviewStatusParam ?? 'all'}
                onChange={(value) => {
                  setMode('explorer');
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
          variant={activeGovernanceFilterCount > 0 ? 'filled' : 'borderless'}
        >
          {governanceLabel}
        </Button>
      </Popover>
      {activeGovernanceFilters.length > 0 && (
        <Flexbox horizontal className={styles.governanceFilters} gap={6}>
          {typeof matchingFilesCount === 'number' && (
            <span className={styles.governanceSummaryText}>
              {t('filters.matchingFiles', { count: matchingFilesCount })}
            </span>
          )}
          {activeGovernanceFilters.map((filter) => (
            <Button
              aria-label={t('filters.clearGovernanceFilter', { label: filter.label })}
              className={styles.governanceFilterChip}
              icon={X}
              key={filter.key}
              size={'small'}
              variant={'outlined'}
              onClick={() => {
                setMode('explorer');
                navigate(filter.clearUrl, { replace: true });
              }}
            >
              {filter.label}
            </Button>
          ))}
        </Flexbox>
      )}
    </Flexbox>
  );
});

CategoryMenu.displayName = 'CategoryMenu';

export default CategoryMenu;
