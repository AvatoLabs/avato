'use client';

import { Button, Flexbox, Icon, Segmented, type SegmentedProps } from '@lobehub/ui';
import { Popover, Select } from 'antd';
import { createStaticStyles } from 'antd-style';
import { SlidersHorizontal } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildFilesRootPath, stripFilesItemPath } from '@/features/ResourceSpaces';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useServerConfigStore } from '@/store/serverConfig';
import { FileAssetClassification, FileAssetUsagePolicy, FilesTabs } from '@/types/files';

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
  const [activeKey, sourceSetId, setMode] = useContentManagerStore((s) => [
    s.category,
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
  const usagePolicyParam =
    (searchParams.get('assetUsagePolicy') as FileAssetUsagePolicy | null) || undefined;
  const showCategoryTabs = !sourceSetId;
  const activeGovernanceFilterCount =
    Number(Boolean(classificationParam)) + Number(Boolean(usagePolicyParam));

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

  const classificationOptions = useMemo(
    () => [
      { label: t('detail.asset.classification.all'), value: 'all' },
      { label: t('detail.asset.classification.general'), value: FileAssetClassification.General },
      { label: t('detail.asset.classification.brand'), value: FileAssetClassification.Brand },
      { label: t('detail.asset.classification.product'), value: FileAssetClassification.Product },
      { label: t('detail.asset.classification.legal'), value: FileAssetClassification.Legal },
      { label: t('detail.asset.classification.finance'), value: FileAssetClassification.Finance },
      { label: t('detail.asset.classification.hr'), value: FileAssetClassification.Hr },
    ],
    [t],
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

  const usagePolicyOptions = useMemo(
    () => [
      { label: t('detail.asset.usagePolicy.all'), value: 'all' },
      { label: t('detail.asset.usagePolicy.internal'), value: FileAssetUsagePolicy.Internal },
      { label: t('detail.asset.usagePolicy.public'), value: FileAssetUsagePolicy.Public },
      { label: t('detail.asset.usagePolicy.restricted'), value: FileAssetUsagePolicy.Restricted },
    ],
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

  const getClearedGovernanceUrl = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('file');
    nextParams.delete('files');
    nextParams.delete('assetClassification');
    nextParams.delete('assetUsagePolicy');

    const queryString = nextParams.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const governanceLabel =
    activeGovernanceFilterCount > 0
      ? t('filters.governanceActive', { count: activeGovernanceFilterCount })
      : t('filters.governance');

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
    </Flexbox>
  );
});

CategoryMenu.displayName = 'CategoryMenu';

export default CategoryMenu;
