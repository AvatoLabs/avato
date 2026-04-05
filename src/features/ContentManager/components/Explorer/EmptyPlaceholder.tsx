import { Center, FileTypeIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { Upload } from 'antd';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { BrainCircuitIcon, FilterXIcon, XIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildSpaceMemoryPath } from '@/features/ResourceSpaces/paths';
import { SPACE_LIST_KEY } from '@/features/ResourceSpaces/SpaceList';
import {
  buildPendingGovernancePath,
  canReviewSpaceMemorySummary,
  useTeamSpaceMemoryScopeSummaries,
} from '@/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { lambdaClient } from '@/libs/trpc/client';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';
import { useServerConfigStore } from '@/store/serverConfig';

const ICON_SIZE = 80;

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionTitle: css`
    margin-block-start: 12px;
    font-size: 16px;
    color: ${cssVar.colorText};
  `,
  card: css`
    touch-action: manipulation;
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 200px;
    height: 140px;
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    font: inherit;
    font-weight: 500;
    color: inherit;
    text-align: center;

    appearance: none;
    background: ${cssVar.colorBgContainer};

    transition:
      transform 0.25s ease,
      border-color 0.25s ease,
      background 0.25s ease,
      box-shadow 0.25s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 60%, ${cssVar.colorBorder} 40%);
      background: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBg} 14%,
        ${cssVar.colorFillSecondary} 86%
      );
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
      box-shadow: 0 0 0 4px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);
    }
  `,
  cardButton: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;

    border: 0;
  `,
  cardContent: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 100%;
    height: 100%;
  `,
  glow: css`
    position: absolute;
    inset-block-end: -12px;
    inset-inline-end: 0;

    width: 48px;
    height: 48px;

    opacity: 0.5;
    filter: blur(24px);
  `,
  icon: css`
    position: absolute;
    z-index: 1;
    inset-block-end: -24px;
    inset-inline-end: 8px;

    flex: none;
  `,
  governanceFilters: css`
    gap: 8px;
    align-items: center;
    justify-content: center;
  `,
  governanceFiltersSummary: css`
    gap: 8px;
    align-items: center;
    width: min(560px, 100%);
    text-align: center;
  `,
  governanceFilterChip: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    padding-block: 6px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    font: inherit;
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorText};
    white-space: nowrap;

    background: color-mix(
      in srgb,
      ${cssVar.colorFillSecondary} 80%,
      ${cssVar.colorBgContainer} 20%
    );

    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      transform 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 60%, ${cssVar.colorBorder} 40%);
      background: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBg} 18%,
        ${cssVar.colorFillSecondary} 82%
      );
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }
  `,
  governanceFilterMeta: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  governanceFilterValue: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

const EmptyPlaceholder = memo(() => {
  const { t } = useTranslation(['components', 'file']);
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const pushDockFileList = useFileStore((s) => s.pushDockFileList);

  const [assetClassification, assetReviewStatus, assetUsagePolicy, sourceSetId, spaceId] =
    useContentManagerStore((s) => [
      s.assetClassification,
      s.assetReviewStatus,
      s.assetUsagePolicy,
      s.sourceSetId,
      s.spaceId,
    ]);
  const { data: spaces } = useSWR(
    spaceId ? SPACE_LIST_KEY : null,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );
  const currentSpace = spaces?.find((space) => space.id === spaceId);
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId, spaceSummaryMap } =
    useTeamSpaceMemoryScopeSummaries(currentSpace ? [currentSpace] : undefined);
  const spaceMemorySummary = spaceId ? spaceSummaryMap.get(spaceId) : undefined;
  const canReviewSpaceMemory = canReviewSpaceMemorySummary(spaceMemorySummary);
  const pendingCount = spaceId ? (pendingGovernanceCountBySpaceId.get(spaceId) ?? 0) : 0;
  const pendingTarget = spaceId ? (pendingGovernanceTargetBySpaceId.get(spaceId) ?? null) : null;
  const showOpenSpaceMemoryAction =
    currentSpace?.kind === 'team' && !!spaceMemorySummary && !canReviewSpaceMemory;
  const hasGovernanceFilters = Boolean(
    assetClassification || assetReviewStatus || assetUsagePolicy,
  );
  const governanceFilterItems = useMemo(() => {
    const items = [];

    if (assetClassification) {
      items.push({
        label: t('detail.asset.classification.label'),
        queryKey: 'assetClassification',
        value: t(`detail.asset.classification.${assetClassification}`),
      });
    }

    if (assetReviewStatus) {
      items.push({
        label: t('detail.asset.reviewStatus.label'),
        queryKey: 'assetReviewStatus',
        value: t(`detail.asset.reviewStatus.${assetReviewStatus}`),
      });
    }

    if (assetUsagePolicy) {
      items.push({
        label: t('detail.asset.usagePolicy.label'),
        queryKey: 'assetUsagePolicy',
        value: t(`detail.asset.usagePolicy.${assetUsagePolicy}`),
      });
    }

    return items;
  }, [assetClassification, assetReviewStatus, assetUsagePolicy, t]);

  const { open } = useCreateSourceSetModal();

  const accentColors = [
    `color-mix(in srgb, ${cssVar.colorPrimary} 92%, ${cssVar.colorBgContainer} 8%)`,
    `color-mix(in srgb, ${cssVar.colorPrimary} 76%, ${cssVar.colorBgContainer} 24%)`,
    `color-mix(in srgb, ${cssVar.colorPrimary} 60%, ${cssVar.colorBgContainer} 40%)`,
  ];

  const clearGovernanceFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('assetClassification');
    nextParams.delete('assetReviewStatus');
    nextParams.delete('assetUsagePolicy');

    const query = nextParams.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname);
  };

  const clearGovernanceFilter = (queryKey: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(queryKey);

    const query = nextParams.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname);
  };

  return (
    <Center gap={24} height={'100%'} style={{ paddingBottom: 100 }} width={'100%'}>
      <Flexbox justify={'center'} style={{ textAlign: 'center' }}>
        <Text as={'h4'}>
          {hasGovernanceFilters ? t('filters.empty.title') : t('FileManager.emptyStatus.title')}
        </Text>
        <Text type={'secondary'}>
          {hasGovernanceFilters ? t('filters.empty.description') : t('FileManager.emptyStatus.or')}
        </Text>
      </Flexbox>
      {hasGovernanceFilters && (
        <Flexbox className={styles.governanceFiltersSummary}>
          <Text className={styles.governanceFilterMeta}>{t('filters.empty.activeTitle')}</Text>
          <Flexbox horizontal className={styles.governanceFilters} wrap={'wrap'}>
            {governanceFilterItems.map((item) => (
              <button
                className={styles.governanceFilterChip}
                key={item.queryKey}
                type="button"
                aria-label={t('filters.clearGovernanceFilter', {
                  label: `${item.label}: ${item.value}`,
                })}
                onClick={() => clearGovernanceFilter(item.queryKey)}
              >
                <span>{item.label}:</span>
                <span className={styles.governanceFilterValue}>{item.value}</span>
                <Icon icon={XIcon} size={{ fontSize: 12 }} />
              </button>
            ))}
          </Flexbox>
        </Flexbox>
      )}
      <Flexbox gap={12} horizontal={!isMobile}>
        {hasGovernanceFilters && (
          <button
            className={cx(styles.card, styles.cardButton)}
            type="button"
            onClick={clearGovernanceFilters}
          >
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>{t('filters.clearGovernance')}</span>
              <div className={styles.glow} style={{ background: accentColors[0] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[0]}
                icon={<Icon color={cssVar.colorTextLightSolid} icon={FilterXIcon} />}
                size={ICON_SIZE}
              />
            </Flexbox>
          </button>
        )}
        {currentSpace?.kind === 'team' && pendingCount > 0 && pendingTarget && (
          <button
            className={cx(styles.card, styles.cardButton)}
            type="button"
            onClick={() => navigate(buildPendingGovernancePath(currentSpace.id, pendingTarget))}
          >
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('space.home.recall.actions.review', { count: pendingCount, ns: 'file' })}
              </span>
              <div className={styles.glow} style={{ background: accentColors[0] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[0]}
                icon={<Icon color={cssVar.colorTextLightSolid} icon={BrainCircuitIcon} />}
                size={ICON_SIZE}
              />
            </Flexbox>
          </button>
        )}
        {showOpenSpaceMemoryAction && (
          <button
            className={cx(styles.card, styles.cardButton)}
            type="button"
            onClick={() => navigate(buildSpaceMemoryPath(currentSpace.id))}
          >
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('space.home.recall.actions.open', { ns: 'file' })}
              </span>
              <div className={styles.glow} style={{ background: accentColors[0] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[0]}
                icon={<Icon color={cssVar.colorTextLightSolid} icon={BrainCircuitIcon} />}
                size={ICON_SIZE}
              />
            </Flexbox>
          </button>
        )}
        {!sourceSetId && (
          <button
            className={cx(styles.card, styles.cardButton)}
            type="button"
            onClick={() => {
              open({ spaceId });
            }}
          >
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('FileManager.emptyStatus.actions.sourceSet')}
              </span>
              <div className={styles.glow} style={{ background: accentColors[0] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[0]}
                icon={<Icon color={cssVar.colorTextLightSolid} icon={RESOURCE_ENTRY_ICONS.plus} />}
                size={ICON_SIZE}
                type={'folder'}
              />
            </Flexbox>
          </button>
        )}
        <Upload
          multiple={true}
          showUploadList={false}
          beforeUpload={async (file) => {
            await pushDockFileList([file], sourceSetId, undefined, spaceId);

            return false;
          }}
        >
          <button className={cx(styles.card, styles.cardButton)} type="button">
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('FileManager.emptyStatus.actions.file')}
              </span>
              <div className={styles.glow} style={{ background: accentColors[1] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[1]}
                size={ICON_SIZE}
                icon={
                  <Icon
                    color={cssVar.colorTextLightSolid}
                    icon={RESOURCE_ENTRY_ICONS.uploadArrow}
                  />
                }
              />
            </Flexbox>
          </button>
        </Upload>
        <Upload
          directory
          multiple={true}
          showUploadList={false}
          beforeUpload={async (file) => {
            await pushDockFileList([file], sourceSetId, undefined, spaceId);

            return false;
          }}
        >
          <button className={cx(styles.card, styles.cardButton)} type="button">
            <Flexbox className={styles.cardContent}>
              <span className={styles.actionTitle}>
                {t('FileManager.emptyStatus.actions.folder')}
              </span>
              <div className={styles.glow} style={{ background: accentColors[2] }} />
              <FileTypeIcon
                aria-hidden
                className={styles.icon}
                color={accentColors[2]}
                size={ICON_SIZE}
                type={'folder'}
                icon={
                  <Icon
                    color={cssVar.colorTextLightSolid}
                    icon={RESOURCE_ENTRY_ICONS.uploadArrow}
                  />
                }
              />
            </Flexbox>
          </button>
        </Upload>
      </Flexbox>
    </Center>
  );
});

EmptyPlaceholder.displayName = 'EmptyPlaceholder';

export default EmptyPlaceholder;
