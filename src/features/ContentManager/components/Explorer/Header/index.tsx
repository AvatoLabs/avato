'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { App } from 'antd';
import { cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavHeader from '@/features/NavHeader';
import { SpaceSurfaceTitle } from '@/features/ResourceSpaces';
import CategoryMenu from '@/routes/(main)/content/(home)/_layout/Header/CategoryMenu';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { selectors, useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useServerConfigStore } from '@/store/serverConfig';

import AddButton from '../../Header/AddButton';
import BatchActionsDropdown from '../ToolBar/BatchActionsDropdown';
import SortDropdown from '../ToolBar/SortDropdown';
import ViewSwitcher from '../ToolBar/ViewSwitcher';
import Breadcrumb from './Breadcrumb';
import SearchInput from './SearchInput';

/**
 * Toolbar for the resource explorer
 */
const Header = memo(() => {
  const { t } = useTranslation(['components', 'common', 'file', 'sourceSet']);
  const { modal, message } = App.useApp();
  const { currentFolderSlug } = useFolderPath();

  // Get state and actions from store
  const [sourceSetId, currentViewItemId, onActionClick, selectFileIds, spaceId] =
    useContentManagerStore((s) => [
      s.sourceSetId,
      s.currentViewItemId,
      s.onActionClick,
      s.selectedFileIds,
      s.spaceId,
    ]);
  const currentFile = useContentManagerStore(selectors.getCurrentFile);
  const selectCount = selectFileIds.length;
  const isMultiSelected = selectCount > 1;
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const showHeaderFilters = !isMultiSelected;

  // Scope-first navigation lives in the sidebar. The header shows workspace-aware
  // breadcrumb context once users drill into a file, folder, or source set.
  const leftContent = isMultiSelected ? (
    <Flexbox horizontal align={'center'} gap={8} style={{ marginLeft: 0 }}>
      {sourceSetId ? (
        <ActionIcon
          icon={RESOURCE_ENTRY_ICONS.sourceSetRemove}
          title={t('FileManager.actions.removeFromSourceSet')}
          onClick={() => {
            modal.confirm({
              okButtonProps: {
                danger: true,
              },
              onOk: async () => {
                await onActionClick('removeFromSourceSet');
                message.success(t('FileManager.actions.removeFromSourceSetSuccess'));
              },
              title: t('FileManager.actions.confirmRemoveFromSourceSet', {
                count: selectCount,
              }),
            });
          }}
        />
      ) : null}

      <ActionIcon
        icon={RESOURCE_ENTRY_ICONS.check}
        title={t('FileManager.actions.approveAssets')}
        onClick={async () => {
          try {
            await onActionClick('approveAssets');
            message.success(t('FileManager.actions.approveAssetsSuccess', { count: selectCount }));
          } catch (error) {
            console.error(error);
            message.error(t('FileManager.actions.approveAssetsError'));
          }
        }}
      />

      <ActionIcon
        icon={RESOURCE_ENTRY_ICONS.archive}
        title={t('FileManager.actions.archiveAssets')}
        onClick={() => {
          modal.confirm({
            onOk: async () => {
              try {
                await onActionClick('archiveAssets');
                message.success(
                  t('FileManager.actions.archiveAssetsSuccess', { count: selectCount }),
                );
              } catch (error) {
                console.error(error);
                message.error(t('FileManager.actions.archiveAssetsError'));
              }
            },
            title: t('FileManager.actions.confirmArchiveAssets', { count: selectCount }),
          });
        }}
      />

      <ActionIcon
        icon={RESOURCE_ENTRY_ICONS.chunk}
        title={t('FileManager.actions.batchChunking')}
        onClick={async () => {
          await onActionClick('batchChunking');
        }}
      />

      <ActionIcon
        icon={RESOURCE_ENTRY_ICONS.trash}
        title={t('delete', { ns: 'common' })}
        onClick={() => {
          modal.confirm({
            okButtonProps: {
              danger: true,
            },
            onOk: async () => {
              await onActionClick('delete');
              message.success(t('FileManager.actions.deleteSuccess'));
            },
            title: t('FileManager.actions.confirmDeleteMultiFiles', { count: selectCount }),
          });
        }}
      />
    </Flexbox>
  ) : !sourceSetId ? (
    <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
      {currentFolderSlug || currentViewItemId ? (
        <Breadcrumb fileName={currentFile?.name} />
      ) : (
        <SpaceSurfaceTitle
          spaceId={spaceId}
          surfaceLabel={t('tab.files', { defaultValue: 'Files', ns: 'common' })}
        />
      )}
    </Flexbox>
  ) : (
    <Flexbox style={{ marginLeft: 8 }}>
      <Breadcrumb fileName={currentViewItemId ? currentFile?.name : undefined} />
    </Flexbox>
  );

  return (
    <NavHeader
      children={showHeaderFilters ? <CategoryMenu /> : null}
      left={leftContent}
      showTogglePanelButton={!isMobile}
      right={
        <>
          <SearchInput />
          <SortDropdown />
          <BatchActionsDropdown selectCount={selectCount} onActionClick={onActionClick} />
          <ViewSwitcher />
          <Flexbox style={{ marginLeft: 8 }}>
            <AddButton />
          </Flexbox>
        </>
      }
      style={{
        borderBottom: `1px solid ${cssVar.colorBorderSecondary}`,
      }}
      styles={{
        center: showHeaderFilters ? { flex: 'none', minWidth: 0 } : undefined,
        left: { flex: 1, minWidth: 0 },
        right: showHeaderFilters
          ? { flex: 1, justifyContent: 'flex-end', minWidth: 0 }
          : { flex: 'none' },
      }}
    />
  );
});

export default Header;
