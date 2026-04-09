'use client';

import { Button, Flexbox, Icon, Modal, Text } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { ChevronDownIcon, PlusIcon, Share2Icon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useFileScope } from '@/features/ContentManager/useFileScope';
import NavItem from '@/features/NavPanel/components/NavItem';
import {
  buildFilesRootPath,
  buildFilesTrashPath,
  buildSharedFilesPath,
  buildSpaceMemoryPath,
  buildSourceSetTrashPath,
  SpaceList,
  useSpaceName,
} from '@/features/ResourceSpaces';
import { SPACE_LIST_KEY } from '@/features/ResourceSpaces/SpaceList';
import {
  buildPendingGovernancePath,
  canReviewSpaceMemorySummary,
  useTeamSpaceMemoryScopeSummaries,
} from '@/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries';
import { useOpenCreateSpaceModal } from '@/features/ResourceSpaces/useOpenCreateSpaceModal';
import { lambdaClient } from '@/libs/trpc/client';
import { SourceSetTrashButton } from '@/routes/(main)/content/features/SourceSetTrashButton';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import CategoryMenu from './Header/CategoryMenu';

const styles = createStaticStyles(({ css, cssVar }) => ({
  categoryRow: css`
    min-width: 0;
    padding-inline: 10px;
    padding-block-end: 8px;
  `,
  launcher: css`
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 78%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 45%, transparent),
      0 10px 24px -24px color-mix(in srgb, ${cssVar.colorText} 32%, transparent);
    cursor: pointer;
  `,
  modalBody: css`
    gap: 12px;
    padding-block: 8px;
    padding-inline: 4px;
  `,
  modalSection: css`
    gap: 6px;
  `,
  modalSectionTitle: css`
    padding-inline: 8px;
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  `,
  quickAction: css`
    height: auto;
    padding-inline: 10px !important;
    padding-block: 6px !important;
    border-radius: 999px !important;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 78%, transparent) !important;
  `,
  topActions: css`
    position: sticky;
    z-index: 10;
    top: calc(${mobileHeaderSticky.top ?? 0} + 52px);

    gap: 6px;
    padding-block: 6px 8px;
    padding-inline: 10px;

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorBgElevated}) 0%,
      color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorBgLayout}) 100%
    );
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    backdrop-filter: blur(14px);
  `,
  workspaceSummary: css`
    gap: 6px;
    align-items: center;
    min-width: 0;
  `,
  workspaceSummaryMeta: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
  `,
  workspaceSummaryName: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  workspaceSummarySubtitle: css`
    overflow: hidden;

    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const ResourceMobileHeader = memo(() => {
  const { t } = useTranslation(['common', 'file', 'memory']);
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const currentSpaceName = useSpaceName(currentSpaceId);
  const { sourceSetId } = useFileScope(currentSpaceId);
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );
  const { data: spaces } = useSWR(
    currentSpaceId ? SPACE_LIST_KEY : null,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );
  const currentSpace = spaces?.find((space) => space.id === currentSpaceId);
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId, spaceSummaryMap } =
    useTeamSpaceMemoryScopeSummaries(currentSpace ? [currentSpace] : undefined);
  const currentSpaceSummary = currentSpaceId ? spaceSummaryMap.get(currentSpaceId) : null;
  const canReviewSpaceMemory = canReviewSpaceMemorySummary(currentSpaceSummary);
  const currentPendingCount = currentSpaceId
    ? (pendingGovernanceCountBySpaceId.get(currentSpaceId) ?? 0)
    : 0;
  const currentPendingTarget = currentSpaceId
    ? (pendingGovernanceTargetBySpaceId.get(currentSpaceId) ?? null)
    : null;

  const isOnShared = location.pathname === buildSharedFilesPath();
  const isOnTrash = location.pathname === buildFilesTrashPath(currentSpaceId);
  const isOnSettings = location.pathname.endsWith('/settings');
  const showTopActions = !isOnSettings && !isOnShared && !isOnTrash && Boolean(currentSpaceId);
  const sharedSurfaceTitle = `${t('space.quickAccessTitle', { ns: 'file' })} / ${t('shared.title', { ns: 'file' })}`;
  const trashSurfaceTitle = sourceSetName
    ? `${sourceSetName} / ${t('trash.title', { ns: 'file' })}`
    : currentSpaceName
      ? `${currentSpaceName} / ${t('trash.title', { ns: 'file' })}`
      : `${t('space.quickAccessTitle', { ns: 'file' })} / ${t('trash.title', { ns: 'file' })}`;

  const handleCreateSpace = useOpenCreateSpaceModal((spaceId) => {
    navigate(buildFilesRootPath(spaceId));
    setWorkspaceOpen(false);
  });

  const leftContent =
    isOnShared || isOnTrash ? (
      <Flexbox className={styles.launcher} horizontal align={'center'} gap={6}>
        <Text ellipsis fontSize={15} weight={500}>
          {isOnShared ? sharedSurfaceTitle : trashSurfaceTitle}
        </Text>
      </Flexbox>
    ) : (
      <Flexbox
        className={styles.launcher}
        horizontal
        align={'center'}
        gap={6}
        onClick={() => setWorkspaceOpen(true)}
      >
        <Text ellipsis fontSize={15} weight={500}>
          {currentSpaceName || t('space.sectionTitle', { ns: 'file' })}
        </Text>
        <Icon icon={ChevronDownIcon} size={16} />
      </Flexbox>
    );
  const trashTargetPath = sourceSetId
    ? buildSourceSetTrashPath(currentSpaceId, sourceSetId)
    : buildFilesTrashPath(currentSpaceId);
  const memoryShortcut =
    currentSpace?.kind === 'team' && currentPendingCount > 0 && currentPendingTarget ? (
      <Button
        className={styles.quickAction}
        size={'small'}
        title={t('scope.pendingHint', { count: currentPendingCount, ns: 'memory' })}
        type={'text'}
        onClick={() => navigate(buildPendingGovernancePath(currentSpace.id, currentPendingTarget))}
      >
        {t('scope.pending', { count: currentPendingCount, ns: 'memory' })}
      </Button>
    ) : currentSpace?.kind === 'team' && currentSpaceSummary && !canReviewSpaceMemory ? (
      <Button
        className={styles.quickAction}
        size={'small'}
        title={t('scope.openHint', { ns: 'memory' })}
        type={'text'}
        onClick={() => navigate(buildSpaceMemoryPath(currentSpace.id))}
      >
        {t('scope.open', { ns: 'memory' })}
      </Button>
    ) : null;
  const workspaceSurfaceTitle = memoryShortcut
    ? t('filters.governance', { ns: 'file' })
    : t('tab.files', { ns: 'common' });
  const workspaceSurfaceSubtitle = currentSpaceName
    ? `${t('space.sectionTitle', { ns: 'file' })} / ${currentSpaceName}`
    : t('space.sectionTitle', { ns: 'file' });

  return (
    <>
      <ChatHeader
        left={leftContent}
        right={!isOnShared && !isOnTrash ? <SourceSetTrashButton /> : null}
        style={{ ...mobileHeaderSticky, overflow: 'unset' }}
      />
      {showTopActions && (
        <Flexbox className={styles.topActions}>
          <Flexbox className={styles.workspaceSummary} horizontal>
            <Flexbox className={styles.workspaceSummaryMeta} gap={2}>
              <Text className={styles.workspaceSummaryName} fontSize={14} weight={500}>
                {workspaceSurfaceTitle}
              </Text>
              <Text className={styles.workspaceSummarySubtitle}>{workspaceSurfaceSubtitle}</Text>
            </Flexbox>
            {memoryShortcut ? <div>{memoryShortcut}</div> : null}
          </Flexbox>
          <div className={styles.categoryRow}>
            <CategoryMenu />
          </div>
        </Flexbox>
      )}
      <Modal
        open={workspaceOpen}
        title={t('space.sectionTitle', { ns: 'file' })}
        onCancel={() => setWorkspaceOpen(false)}
      >
        <Flexbox className={styles.modalBody}>
          <Flexbox className={styles.modalSection}>
            <Text className={styles.modalSectionTitle}>
              {t('space.quickAccessTitle', { ns: 'file' })}
            </Text>
            <NavItem
              active={isOnShared}
              icon={Share2Icon}
              title={sharedSurfaceTitle}
              onClick={() => {
                navigate(buildSharedFilesPath());
                setWorkspaceOpen(false);
              }}
            />
            <NavItem
              active={isOnTrash}
              icon={RESOURCE_ENTRY_ICONS.trash}
              title={trashSurfaceTitle}
              onClick={() => {
                navigate(trashTargetPath);
                setWorkspaceOpen(false);
              }}
            />
          </Flexbox>
          <Flexbox className={styles.modalSection}>
            <Text className={styles.modalSectionTitle}>
              {t('space.sectionTitle', { ns: 'file' })}
            </Text>
            <SpaceList
              currentSpaceId={currentSpaceId}
              onSelectSpace={(spaceId) => {
                navigate(buildFilesRootPath(spaceId));
                setWorkspaceOpen(false);
              }}
            />
          </Flexbox>
          <Flexbox paddingBlock={8} paddingInline={4}>
            <Button block icon={<Icon icon={PlusIcon} />} onClick={handleCreateSpace}>
              {t('space.create.title', { ns: 'file' })}
            </Button>
          </Flexbox>
        </Flexbox>
      </Modal>
    </>
  );
});

ResourceMobileHeader.displayName = 'ResourceMobileHeader';

export default ResourceMobileHeader;
