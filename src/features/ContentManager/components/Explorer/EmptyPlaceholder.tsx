import { Center, FileTypeIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { Upload } from 'antd';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { BrainCircuitIcon, FilterXIcon, SlidersHorizontal, XIcon } from 'lucide-react';
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
  actionGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    width: 100%;

    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    touch-action: manipulation;
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 100%;
    min-height: 148px;
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: calc(${cssVar.borderRadiusLG} + 4px);

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
  cardUpload: css`
    display: block;
    width: 100%;

    .ant-upload {
      display: block;
      width: 100%;
    }
  `,
  cardContent: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 100%;
    height: 100%;
  `,
  intro: css`
    display: grid;
    gap: 10px;
    width: min(640px, 100%);
    text-align: center;
  `,
  introEyebrow: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
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
    gap: 10px;
    align-items: center;

    width: min(560px, 100%);
    padding-block: 14px;
    padding-inline: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: calc(${cssVar.borderRadiusLG} + 4px);

    text-align: center;

    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 76%, ${cssVar.colorBgContainer});
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
  governanceFilterActions: css`
    gap: 4px;
    align-items: center;
  `,
  governanceFilterActionButton: css`
    cursor: pointer;

    display: inline-flex;
    gap: 4px;
    align-items: center;

    padding: 0;
    border: 0;

    font: inherit;
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};

    appearance: none;
    background: transparent;

    transition: color 0.2s ease;

    &:hover {
      color: ${cssVar.colorText};
    }

    &:focus-visible {
      border-radius: 999px;
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
  shell: css`
    display: grid;
    gap: 18px;
    width: min(980px, 100%);
    padding: clamp(20px, 4vw, 36px);
  `,
}));

const EmptyPlaceholder = memo(() => {
  const { t } = useTranslation(['components', 'file']);
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const pushDockFileList = useFileStore((s) => s.pushDockFileList);

  const [
    assetClassification,
    assetRightsOwner,
    assetReviewStatus,
    assetUsagePolicy,
    sourceSetId,
    spaceId,
  ] = useContentManagerStore((s) => [
    s.assetClassification,
    s.assetRightsOwner,
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
  const translateText = (key: string, options?: Record<string, any>) =>
    t(key as any, options as any) as string;
  const spaceMemorySummary = spaceId ? spaceSummaryMap.get(spaceId) : undefined;
  const canReviewSpaceMemory = canReviewSpaceMemorySummary(spaceMemorySummary);
  const pendingCount = spaceId ? (pendingGovernanceCountBySpaceId.get(spaceId) ?? 0) : 0;
  const pendingTarget = spaceId ? (pendingGovernanceTargetBySpaceId.get(spaceId) ?? null) : null;
  const showOpenSpaceMemoryAction =
    currentSpace?.kind === 'team' && !!spaceMemorySummary && !canReviewSpaceMemory;
  const hasGovernanceFilters = Boolean(
    assetClassification || assetRightsOwner || assetReviewStatus || assetUsagePolicy,
  );
  const governanceFilterItems = useMemo(() => {
    const items: Array<{ label: string; queryKey: string; value: string }> = [];

    if (assetClassification) {
      items.push({
        label: translateText('detail.asset.classification.label'),
        queryKey: 'assetClassification',
        value: translateText(`detail.asset.classification.${assetClassification}`),
      });
    }

    if (assetRightsOwner) {
      items.push({
        label: translateText('detail.asset.rightsOwner.label'),
        queryKey: 'assetRightsOwner',
        value: assetRightsOwner,
      });
    }

    if (assetReviewStatus) {
      items.push({
        label: translateText('detail.asset.reviewStatus.label'),
        queryKey: 'assetReviewStatus',
        value: translateText(`detail.asset.reviewStatus.${assetReviewStatus}`),
      });
    }

    if (assetUsagePolicy) {
      items.push({
        label: translateText('detail.asset.usagePolicy.label'),
        queryKey: 'assetUsagePolicy',
        value: translateText(`detail.asset.usagePolicy.${assetUsagePolicy}`),
      });
    }

    return items;
  }, [assetClassification, assetRightsOwner, assetReviewStatus, assetUsagePolicy, translateText]);

  const { open } = useCreateSourceSetModal();

  const accentColors = [
    `color-mix(in srgb, ${cssVar.colorPrimary} 92%, ${cssVar.colorBgContainer} 8%)`,
    `color-mix(in srgb, ${cssVar.colorPrimary} 76%, ${cssVar.colorBgContainer} 24%)`,
    `color-mix(in srgb, ${cssVar.colorPrimary} 60%, ${cssVar.colorBgContainer} 40%)`,
  ];

  const clearGovernanceFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('assetClassification');
    nextParams.delete('assetRightsOwner');
    nextParams.delete('assetReviewStatus');
    nextParams.delete('assetUsagePolicy');

    const query = nextParams.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname);
  };

  const openGovernanceFilters = (focusFilter?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('openGovernance', '1');
    if (focusFilter) {
      nextParams.set('focusGovernance', focusFilter);
    } else {
      nextParams.delete('focusGovernance');
    }

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
      <div className={styles.shell}>
        <Flexbox className={styles.intro} justify={'center'}>
          {!hasGovernanceFilters && (
            <Text className={styles.introEyebrow}>{t('FileManager.emptyStatus.title')}</Text>
          )}
          <Text as={'h4'}>
            {hasGovernanceFilters
              ? translateText('filters.empty.title')
              : t('FileManager.emptyStatus.title')}
          </Text>
          <Text type={'secondary'}>
            {hasGovernanceFilters
              ? translateText('filters.empty.description')
              : t('FileManager.emptyStatus.or')}
          </Text>
        </Flexbox>
        {hasGovernanceFilters && (
          <Flexbox className={styles.governanceFiltersSummary}>
            <Text className={styles.governanceFilterMeta}>
              {translateText('filters.empty.activeTitle')}
            </Text>
            <Flexbox horizontal className={styles.governanceFilters} wrap={'wrap'}>
              {governanceFilterItems.map((item) => (
                <div className={styles.governanceFilterChip} key={item.queryKey}>
                  <span>{item.label}:</span>
                  <span className={styles.governanceFilterValue}>{item.value}</span>
                  <Flexbox horizontal className={styles.governanceFilterActions}>
                    <button
                      className={styles.governanceFilterActionButton}
                      type="button"
                      aria-label={translateText('filters.adjustGovernanceFilter', {
                        label: `${item.label}: ${item.value}`,
                      })}
                      onClick={() => openGovernanceFilters(item.queryKey)}
                    >
                      <Icon icon={SlidersHorizontal} size={12} />
                      <span>{translateText('filters.adjustGovernance')}</span>
                    </button>
                    <button
                      className={styles.governanceFilterActionButton}
                      type="button"
                      aria-label={translateText('filters.clearGovernanceFilter', {
                        label: `${item.label}: ${item.value}`,
                      })}
                      onClick={() => clearGovernanceFilter(item.queryKey)}
                    >
                      <Icon icon={XIcon} size={12} />
                    </button>
                  </Flexbox>
                </div>
              ))}
            </Flexbox>
          </Flexbox>
        )}
        <div className={styles.actionGrid}>
          {hasGovernanceFilters ? (
            <>
              <button
                className={cx(styles.card, styles.cardButton)}
                type="button"
                onClick={() => openGovernanceFilters()}
              >
                <Flexbox className={styles.cardContent}>
                  <span className={styles.actionTitle}>
                    {translateText('filters.adjustGovernance')}
                  </span>
                  <div className={styles.glow} style={{ background: accentColors[0] }} />
                  <FileTypeIcon
                    aria-hidden
                    className={styles.icon}
                    color={accentColors[0]}
                    icon={<Icon color={cssVar.colorTextLightSolid} icon={SlidersHorizontal} />}
                    size={ICON_SIZE}
                  />
                </Flexbox>
              </button>
              <button
                className={cx(styles.card, styles.cardButton)}
                type="button"
                onClick={clearGovernanceFilters}
              >
                <Flexbox className={styles.cardContent}>
                  <span className={styles.actionTitle}>
                    {translateText('filters.clearGovernance')}
                  </span>
                  <div className={styles.glow} style={{ background: accentColors[1] }} />
                  <FileTypeIcon
                    aria-hidden
                    className={styles.icon}
                    color={accentColors[1]}
                    icon={<Icon color={cssVar.colorTextLightSolid} icon={FilterXIcon} />}
                    size={ICON_SIZE}
                  />
                </Flexbox>
              </button>
            </>
          ) : (
            <>
              {currentSpace?.kind === 'team' && pendingCount > 0 && pendingTarget && (
                <button
                  className={cx(styles.card, styles.cardButton)}
                  type="button"
                  onClick={() =>
                    navigate(buildPendingGovernancePath(currentSpace.id, pendingTarget))
                  }
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
                      icon={
                        <Icon color={cssVar.colorTextLightSolid} icon={RESOURCE_ENTRY_ICONS.plus} />
                      }
                      size={ICON_SIZE}
                      type={'folder'}
                    />
                  </Flexbox>
                </button>
              )}
              <Upload
                className={styles.cardUpload}
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
                className={styles.cardUpload}
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
            </>
          )}
        </div>
      </div>
    </Center>
  );
});

EmptyPlaceholder.displayName = 'EmptyPlaceholder';

export default EmptyPlaceholder;
