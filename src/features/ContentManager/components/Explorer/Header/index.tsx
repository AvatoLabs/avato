'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { App } from 'antd';
import { cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavHeader from '@/features/NavHeader';
import CategoryMenu from '@/routes/(main)/content/(home)/_layout/Header/CategoryMenu';
import { useFolderPath } from '@/routes/(main)/content/features/hooks/useFolderPath';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
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
  const [sourceSetId, category, onActionClick, selectFileIds] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.category,
    s.onActionClick,
    s.selectedFileIds,
  ]);
  const selectCount = selectFileIds.length;
  const isMultiSelected = selectCount > 1;
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const showCategoryFilter = !sourceSetId && !isMultiSelected;

  // Scope-first navigation lives in the sidebar. Content types are secondary filters,
  // so the desktop home view renders them here instead of inside the sidebar.
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
      {currentFolderSlug ? (
        <Breadcrumb category={category} />
      ) : (
        <Text ellipsis style={{ maxWidth: 280 }} type={'secondary'} weight={600}>
          {t('spaceContent.title', { defaultValue: 'Content', ns: 'file' })}
        </Text>
      )}
    </Flexbox>
  ) : (
    <Flexbox style={{ marginLeft: 8 }}>
      <Breadcrumb category={category} sourceSetId={sourceSetId} />
    </Flexbox>
  );

  return (
    <NavHeader
      children={showCategoryFilter ? <CategoryMenu /> : null}
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
        center: showCategoryFilter ? { flex: 'none', minWidth: 0 } : undefined,
        left: { flex: 1, minWidth: 0 },
        right: showCategoryFilter
          ? { flex: 1, justifyContent: 'flex-end', minWidth: 0 }
          : { flex: 'none' },
      }}
    />
  );
});

export default Header;
