import { FileAssetClassification, FileAssetUsagePolicy } from '@lobechat/types';
import { type DropdownItem } from '@lobehub/ui';
import { DropdownMenu, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { type MultiSelectActionType } from '@/routes/(main)/content/features/store/action';
import { useFileStore } from '@/store/file';
import { useSourceSetStore } from '@/store/sourceSet';

import ActionIconWithChevron from './ActionIconWithChevron';

interface BatchActionsDropdownProps {
  onActionClick: (type: MultiSelectActionType) => Promise<void>;
  selectCount: number;
}

const BatchActionsDropdown = memo<BatchActionsDropdownProps>(({ selectCount, onActionClick }) => {
  const { t } = useTranslation(['components', 'common', 'file', 'sourceSet']);
  const { modal, message } = App.useApp();

  const [sourceSetId, selectedFileIds, setSelectedFileIds] = useContentManagerStore((s) => [
    s.sourceSetId,
    s.selectedFileIds,
    s.setSelectedFileIds,
  ]);
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const updateFileAssetsGovernance = useFileStore((s) => s.updateFileAssetsGovernance);
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
    const applyBatchGovernance = async (
      patch: {
        classification?: FileAssetClassification;
        usagePolicy?: FileAssetUsagePolicy;
      },
      successKey: string,
    ) => {
      try {
        await updateFileAssetsGovernance(selectedFileIds, patch);
        setSelectedFileIds([]);
        message.success(t(successKey, { count: selectCount }));
      } catch (error) {
        console.error(error);
        message.error(t('FileManager.actions.updateAssetGovernanceError'));
      }
    };
    const classificationSubmenu: DropdownItem[] = Object.values(FileAssetClassification).map(
      (classification) => ({
        disabled: selectCount === 0,
        key: `set-classification-${classification}`,
        label: t(`detail.asset.classification.${classification}`, { ns: 'file' }),
        onClick: async () =>
          applyBatchGovernance(
            { classification },
            'FileManager.actions.updateClassificationSuccess',
          ),
      }),
    );
    const usagePolicySubmenu: DropdownItem[] = Object.values(FileAssetUsagePolicy).map(
      (usagePolicy) => ({
        disabled: selectCount === 0,
        key: `set-usage-policy-${usagePolicy}`,
        label: t(`detail.asset.usagePolicy.${usagePolicy}`, { ns: 'file' }),
        onClick: async () =>
          applyBatchGovernance({ usagePolicy }, 'FileManager.actions.updateUsagePolicySuccess'),
      }),
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
        children: classificationSubmenu as any,
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
        key: 'setAssetClassification',
        label: t('FileManager.actions.setAssetClassification'),
      },
      {
        children: usagePolicySubmenu as any,
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
        key: 'setAssetUsagePolicy',
        label: t('FileManager.actions.setAssetUsagePolicy'),
      },
      {
        type: 'divider',
      },
      {
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.check} />,
        key: 'approveAssets',
        label: t('FileManager.actions.approveAssets'),
        onClick: async () => {
          try {
            await onActionClick('approveAssets');
            message.success(t('FileManager.actions.approveAssetsSuccess', { count: selectCount }));
          } catch (error) {
            console.error(error);
            message.error(t('FileManager.actions.approveAssetsError'));
          }
        },
      },
      {
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.archive} />,
        key: 'archiveAssets',
        label: t('FileManager.actions.archiveAssets'),
        onClick: async () => {
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
        },
      },
      {
        type: 'divider',
      },
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
    updateFileAssetsGovernance,
    addFilesToSourceSet,
    t,
    modal,
    message,
    setSelectedFileIds,
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
