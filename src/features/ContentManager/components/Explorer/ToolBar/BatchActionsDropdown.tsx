import {
  type FileAssetCapabilities,
  FileAssetClassification,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';
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
import { createBatchRightsOwnerModal } from './BatchRightsOwnerModal';

interface BatchActionsDropdownProps {
  governanceCapabilities?: FileAssetCapabilities;
  onActionClick: (type: MultiSelectActionType) => Promise<void>;
  selectCount: number;
}

const BatchActionsDropdown = memo<BatchActionsDropdownProps>(
  ({ governanceCapabilities, selectCount, onActionClick }) => {
    const { t } = useTranslation(['components', 'common', 'file', 'sourceSet']);
    const translateText = (key: string, options?: Record<string, any>) =>
      t(key as any, options as any) as string;
    const { modal, message } = App.useApp();
    const canEditGovernanceAssets = governanceCapabilities?.canEditGovernance ?? false;
    const canApproveAssets = governanceCapabilities?.canApprove ?? false;
    const canArchiveAssets = governanceCapabilities?.canArchive ?? false;

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
      const runAction = async (
        type: MultiSelectActionType,
        options: { errorKey: string; successKey?: string; successOptions?: Record<string, any> },
      ) => {
        try {
          await onActionClick(type);
          if (options.successKey) {
            message.success(t(options.successKey as any, options.successOptions as any));
          }
        } catch (error) {
          console.error(error);
          message.error(t(options.errorKey as any));
        }
      };

      // Show delete-source-set only when inside a source set and no files are selected.
      if (sourceSetId && selectCount === 0) {
        items.push({
          danger: true,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
          key: 'deleteSourceSet',
          label: t('header.actions.deleteCollection', { ns: 'file' }),
          onClick: async () => {
            modal.confirm({
              okButtonProps: {
                danger: true,
              },
              onOk: async () => {
                await runAction('deleteSourceSet', {
                  errorKey: 'collection.list.removeError',
                  successKey: undefined,
                });
              },
              title: t('collection.list.confirmRemoveSourceSet', { ns: 'file' }),
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
          reviewStatus?: FileAssetReviewStatus;
          rightsOwner?: string | null;
          usagePolicy?: FileAssetUsagePolicy;
        },
        successKey: string,
      ) => {
        try {
          await updateFileAssetsGovernance(selectedFileIds, patch);
          setSelectedFileIds([]);
          message.success(translateText(successKey, { count: selectCount }));
        } catch (error) {
          console.error(error);
          message.error(t('FileManager.actions.updateAssetGovernanceError'));
        }
      };
      const classificationSubmenu: DropdownItem[] = canEditGovernanceAssets
        ? Object.values(FileAssetClassification).map((classification) => ({
            disabled: selectCount === 0,
            key: `set-classification-${classification}`,
            label: t(`detail.asset.classification.${classification}`, { ns: 'file' }),
            onClick: async () =>
              applyBatchGovernance(
                { classification },
                'FileManager.actions.updateClassificationSuccess',
              ),
          }))
        : [];
      const usagePolicySubmenu: DropdownItem[] = canEditGovernanceAssets
        ? Object.values(FileAssetUsagePolicy).map((usagePolicy) => ({
            disabled: selectCount === 0,
            key: `set-usage-policy-${usagePolicy}`,
            label: t(`detail.asset.usagePolicy.${usagePolicy}`, { ns: 'file' }),
            onClick: async () =>
              applyBatchGovernance({ usagePolicy }, 'FileManager.actions.updateUsagePolicySuccess'),
          }))
        : [];
      const reviewStatusSubmenu: DropdownItem[] = canEditGovernanceAssets
        ? [
            {
              disabled: selectCount === 0,
              key: `set-review-status-${FileAssetReviewStatus.Draft}`,
              label: t(`detail.asset.reviewStatus.${FileAssetReviewStatus.Draft}`, { ns: 'file' }),
              onClick: async () =>
                applyBatchGovernance(
                  { reviewStatus: FileAssetReviewStatus.Draft },
                  'FileManager.actions.updateReviewStatusSuccess',
                ),
            },
            ...(canApproveAssets
              ? [
                  {
                    disabled: selectCount === 0,
                    key: `set-review-status-${FileAssetReviewStatus.Approved}`,
                    label: t(`detail.asset.reviewStatus.${FileAssetReviewStatus.Approved}`, {
                      ns: 'file',
                    }),
                    onClick: async () =>
                      applyBatchGovernance(
                        { reviewStatus: FileAssetReviewStatus.Approved },
                        'FileManager.actions.updateReviewStatusSuccess',
                      ),
                  },
                ]
              : []),
            ...(canArchiveAssets
              ? [
                  {
                    disabled: selectCount === 0,
                    key: `set-review-status-${FileAssetReviewStatus.Archived}`,
                    label: t(`detail.asset.reviewStatus.${FileAssetReviewStatus.Archived}`, {
                      ns: 'file',
                    }),
                    onClick: async () =>
                      applyBatchGovernance(
                        { reviewStatus: FileAssetReviewStatus.Archived },
                        'FileManager.actions.updateReviewStatusSuccess',
                      ),
                  },
                ]
              : []),
          ]
        : [];
      const openRightsOwnerModal = () =>
        createBatchRightsOwnerModal({
          count: selectCount,
          onSubmit: async (rightsOwner) =>
            applyBatchGovernance({ rightsOwner }, 'FileManager.actions.updateRightsOwnerSuccess'),
        });

      const addToSourceSetSubmenu: DropdownItem[] = availableSourceSets.map((sourceSet) => ({
        disabled: selectCount === 0,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} />,
        key: `add-to-source-set-${sourceSet.id}`,
        label: <span style={{ marginLeft: 8 }}>{sourceSet.name}</span>,
        onClick: async () => {
          try {
            await addFilesToSourceSet(sourceSet.id, selectedFileIds);
            message.success(
              t('addToCollection.addSuccess', {
                count: selectCount,
                ns: 'sourceSet',
              }),
            );
          } catch (e) {
            console.error(e);
            message.error(t('addToCollection.error', { ns: 'sourceSet' }));
          }
        },
      }));

      if (sourceSetId) {
        items.push({
          disabled: selectCount === 0,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetRemove} />,
          key: 'removeFromSourceSet',
          label: t('FileManager.actions.removeFromCollection'),
          onClick: () => {
            modal.confirm({
              okButtonProps: {
                danger: true,
              },
              onOk: async () => {
                await runAction('removeFromSourceSet', {
                  errorKey: 'FileManager.actions.removeFromCollectionError',
                  successKey: 'FileManager.actions.removeFromCollectionSuccess',
                });
              },
              title: t('FileManager.actions.confirmRemoveFromCollection', {
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
            label: t('FileManager.actions.moveToOtherCollection'),
          });
        }
      } else if (availableSourceSets.length > 0) {
        items.push({
          children: addToSourceSetSubmenu as any,
          disabled: selectCount === 0,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
          key: 'addToSourceSet',
          label: t('FileManager.actions.addToCollection'),
        });
      }

      items.push(
        ...(canEditGovernanceAssets
          ? [
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
                children: reviewStatusSubmenu as any,
                disabled: selectCount === 0,
                icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
                key: 'setAssetReviewStatus',
                label: t('FileManager.actions.setAssetReviewStatus'),
              },
              {
                disabled: selectCount === 0,
                icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
                key: 'setAssetRightsOwner',
                label: t('FileManager.actions.setAssetRightsOwner'),
                onClick: openRightsOwnerModal,
              },
            ]
          : []),
        {
          type: 'divider',
        },
        ...(canApproveAssets
          ? [
              {
                disabled: selectCount === 0,
                icon: <Icon icon={RESOURCE_ENTRY_ICONS.check} />,
                key: 'approveAssets',
                label: t('FileManager.actions.approveAssets'),
                onClick: async () => {
                  try {
                    await onActionClick('approveAssets');
                    message.success(
                      t('FileManager.actions.approveAssetsSuccess', { count: selectCount }),
                    );
                  } catch (error) {
                    console.error(error);
                    message.error(t('FileManager.actions.approveAssetsError'));
                  }
                },
              },
            ]
          : []),
        ...(canArchiveAssets
          ? [
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
            ]
          : []),
        {
          type: 'divider',
        },
        {
          disabled: selectCount === 0,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.chunk} />,
          key: 'batchChunking',
          label: t('FileManager.actions.batchChunking'),
          onClick: async () => {
            await runAction('batchChunking', {
              errorKey: 'FileManager.actions.batchChunkingError',
            });
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
                await runAction('delete', {
                  errorKey: 'FileManager.actions.deleteError',
                  successKey: 'FileManager.actions.deleteSuccess',
                });
              },
              title: t('FileManager.actions.confirmDeleteMultiFiles', { count: selectCount }),
            });
          },
        },
      );

      return items;
    }, [
      canEditGovernanceAssets,
      canApproveAssets,
      canArchiveAssets,
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
          label={
            selectCount > 0 ? t('FileManager.actions.batchActions', 'Batch actions') : undefined
          }
          title={t('FileManager.actions.batchActions', 'Batch actions')}
        />
      </DropdownMenu>
    );
  },
);

BatchActionsDropdown.displayName = 'BatchActionsDropdown';

export default BatchActionsDropdown;
