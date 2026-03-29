import { type DropdownItem } from '@lobehub/ui';
import { DropdownMenu, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useSourceSetStore } from '@/store/sourceSet';

import ActionIconWithChevron from './ActionIconWithChevron';

export type MultiSelectActionType =
  | 'addToSourceSet'
  | 'moveToSourceSet'
  | 'batchChunking'
  | 'delete'
  | 'deleteSourceSet'
  | 'removeFromSourceSet';

interface BatchActionsDropdownProps {
  onActionClick: (type: MultiSelectActionType) => Promise<void>;
  selectCount: number;
}

const BatchActionsDropdown = memo<BatchActionsDropdownProps>(({ selectCount, onActionClick }) => {
  const { t } = useTranslation(['components', 'common', 'file', 'sourceSet']);
  const { modal, message } = App.useApp();

  const [sourceSetId, selectedFileIds] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.selectedFileIds,
  ]);
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const [useFetchSourceSetList, addFilesToSourceSet] = useSourceSetStore((s) => [
    s.useFetchSourceSetList,
    s.addFilesToSourceSet,
  ]);
  const { data: sourceSets } = useFetchSourceSetList(spaceId);

  const menuItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = [];

    // Show delete-source-set only when inside a source set and no files are selected.
    if (sourceSetId && selectCount === 0) {
      items.push({
        danger: true,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
        key: 'deleteSourceSet',
        label: t('header.actions.deleteSourceSet', { ns: 'file' }),
        onClick: async () => {
          modal.confirm({
            okButtonProps: {
              danger: true,
            },
            onOk: async () => {
              await onActionClick('deleteSourceSet');
            },
            title: t('sourceSet.list.confirmRemoveSourceSet', { ns: 'file' }),
          });
        },
      });
      return items;
    }

    const availableSourceSets = (sourceSets || []).filter(
      (sourceSet) => sourceSet.id !== sourceSetId,
    );

    const addToSourceSetSubmenu: DropdownItem[] = availableSourceSets.map((sourceSet) => ({
      disabled: selectCount === 0,
      icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} />,
      key: `add-to-source-set-${sourceSet.id}`,
      label: <span style={{ marginLeft: 8 }}>{sourceSet.name}</span>,
      onClick: async () => {
        try {
          await addFilesToSourceSet(sourceSet.id, selectedFileIds);
          message.success(
            t('addToSourceSet.addSuccess', {
              count: selectCount,
              ns: 'sourceSet',
            }),
          );
        } catch (e) {
          console.error(e);
          message.error(t('addToSourceSet.error', { ns: 'sourceSet' }));
        }
      },
    }));

    if (sourceSetId) {
      items.push({
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetRemove} />,
        key: 'removeFromSourceSet',
        label: t('FileManager.actions.removeFromSourceSet'),
        onClick: () => {
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
        },
      });

      if (availableSourceSets.length > 0) {
        items.push({
          children: addToSourceSetSubmenu as any,
          disabled: selectCount === 0,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
          key: 'moveToSourceSet',
          label: t('FileManager.actions.moveToOtherSourceSet'),
        });
      }
    } else if (availableSourceSets.length > 0) {
      items.push({
        children: addToSourceSetSubmenu as any,
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
        key: 'addToSourceSet',
        label: t('FileManager.actions.addToSourceSet'),
      });
    }

    items.push(
      {
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.chunk} />,
        key: 'batchChunking',
        label: t('FileManager.actions.batchChunking'),
        onClick: async () => {
          await onActionClick('batchChunking');
        },
      },
      {
        type: 'divider',
      },
      {
        danger: true,
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
        key: 'delete',
        label: t('delete', { ns: 'common' }),
        onClick: async () => {
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
        },
      },
    );

    return items;
  }, [
    sourceSetId,
    selectCount,
    selectedFileIds,
    onActionClick,
    addFilesToSourceSet,
    t,
    modal,
    message,
    sourceSets,
  ]);

  return (
    <DropdownMenu nativeButton items={menuItems} placement="bottomLeft">
      <ActionIconWithChevron
        icon={RESOURCE_ENTRY_ICONS.more}
        title={t('FileManager.actions.batchActions', 'Batch actions')}
      />
    </DropdownMenu>
  );
});

BatchActionsDropdown.displayName = 'BatchActionsDropdown';

export default BatchActionsDropdown;
