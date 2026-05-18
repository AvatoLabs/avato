'use client';

import { Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { BrainCircuitIcon, PlusIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildSourceSetFileScope, useFileScope } from '@/features/ContentManager/useFileScope';
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
import { useSourceSetStore } from '@/store/sourceSet';

const styles = createStaticStyles(({ css }) => ({
  card: css`
    touch-action: manipulation;
    cursor: pointer;

    display: flex;
    flex-shrink: 0;
    gap: 10px;
    align-items: center;

    min-width: 120px;
    padding-block: 12px;
    padding-inline: 16px;
    border: 0;
    border-radius: 12px;

    font: inherit;
    color: inherit;

    appearance: none;
    background: ${cssVar.colorFillTertiary};

    transition:
      background 0.2s,
      box-shadow 0.2s;

    &:active {
      background: ${cssVar.colorFillSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
      box-shadow: 0 0 0 4px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);
    }
  `,
  createCard: css`
    border: 1px dashed ${cssVar.colorBorder};
  `,
  list: css`
    overflow-x: auto;
    padding-inline: 12px;

    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  sectionTitle: css`
    margin-block-end: 8px;
    padding-inline: 12px;
  `,
}));

/**
 * Horizontal source-set list for mobile space home.
 * Renders when on mobile, not inside a source set, and space has source sets.
 */
const SourceSetListSection = memo(() => {
  const { t } = useTranslation(['file', 'components']);
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const { setScope } = useFileScope(spaceId);
  const navigate = useNavigate();

  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets, isLoading } = useFetchSourceSetList(spaceId);
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

  const { open } = useCreateSourceSetModal();

  const handleCreate = () => {
    open({ spaceId });
  };

  if (isLoading || !sourceSets?.length) {
    return (
      <Flexbox gap={8} paddingBlock={12} style={{ flexShrink: 0 }}>
        <Text className={styles.sectionTitle} fontSize={14} type="secondary" weight={500}>
          {t('collection.title', { defaultValue: 'Source Sets' })}
        </Text>
        <Flexbox horizontal className={styles.list} gap={12}>
          {currentSpace?.kind === 'team' && pendingCount > 0 && pendingTarget && (
            <button
              className={styles.card}
              type="button"
              onClick={() => navigate(buildPendingGovernancePath(currentSpace.id, pendingTarget))}
            >
              <Icon aria-hidden icon={BrainCircuitIcon} size={20} />
              <Text fontSize={14}>
                {t('space.home.recall.actions.review', { count: pendingCount })}
              </Text>
            </button>
          )}
          {showOpenSpaceMemoryAction && (
            <button
              className={styles.card}
              type="button"
              onClick={() => navigate(buildSpaceMemoryPath(currentSpace.id))}
            >
              <Icon aria-hidden icon={BrainCircuitIcon} size={20} />
              <Text fontSize={14}>{t('space.home.recall.actions.open', { ns: 'file' })}</Text>
            </button>
          )}
          <button
            className={cx(styles.card, styles.createCard)}
            type="button"
            onClick={handleCreate}
          >
            <Icon aria-hidden icon={PlusIcon} size={20} />
            <Text fontSize={14}>{t('collection.new', { defaultValue: 'New Source Set' })}</Text>
          </button>
        </Flexbox>
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={8} paddingBlock={12} style={{ flexShrink: 0 }}>
      <Text className={styles.sectionTitle} fontSize={14} type="secondary" weight={500}>
        {t('collection.title', { defaultValue: 'Source Sets' })}
      </Text>
      <Flexbox horizontal className={styles.list} gap={12}>
        {currentSpace?.kind === 'team' && pendingCount > 0 && pendingTarget && (
          <button
            className={styles.card}
            type="button"
            onClick={() => navigate(buildPendingGovernancePath(currentSpace.id, pendingTarget))}
          >
            <Icon aria-hidden icon={BrainCircuitIcon} size={20} />
            <Text fontSize={14}>
              {t('space.home.recall.actions.review', { count: pendingCount })}
            </Text>
          </button>
        )}
        {showOpenSpaceMemoryAction && (
          <button
            className={styles.card}
            type="button"
            onClick={() => navigate(buildSpaceMemoryPath(currentSpace.id))}
          >
            <Icon aria-hidden icon={BrainCircuitIcon} size={20} />
            <Text fontSize={14}>{t('space.home.recall.actions.open', { ns: 'file' })}</Text>
          </button>
        )}
        {sourceSets.map((sourceSet) => (
          <button
            className={styles.card}
            key={sourceSet.id}
            title={sourceSet.name}
            type="button"
            onClick={() =>
              setScope(buildSourceSetFileScope(sourceSet.id), sourceSet.spaceId ?? spaceId)
            }
          >
            <Icon aria-hidden icon={RESOURCE_ENTRY_ICONS.sourceSet} size={20} />
            <Text ellipsis fontSize={14} style={{ maxWidth: 100 }}>
              {sourceSet.name}
            </Text>
          </button>
        ))}
        <button className={cx(styles.card, styles.createCard)} type="button" onClick={handleCreate}>
          <Icon aria-hidden icon={PlusIcon} size={20} />
          <Text fontSize={14}>{t('collection.new', { defaultValue: 'New Source Set' })}</Text>
        </button>
      </Flexbox>
    </Flexbox>
  );
});

SourceSetListSection.displayName = 'SourceSetListSection';

export default SourceSetListSection;
