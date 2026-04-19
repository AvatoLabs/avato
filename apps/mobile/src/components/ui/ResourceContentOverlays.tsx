import React from 'react';

import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import type { FileListItem } from '../../types';
import AttachmentSheet from './AttachmentSheet';
import PromptModal from './PromptModal';
import ResourceGovernanceSheet from './ResourceGovernanceSheet';
import ResourceHeaderMenus from './ResourceHeaderMenus';
import ResourceItemActionSheet from './ResourceItemActionSheet';
import ResourceMoveToFolderSheet from './ResourceMoveToFolderSheet';
import ResourcePreviewModal from './ResourcePreviewModal';
import ResourceScopeLauncherSheet from './ResourceScopeLauncherSheet';
import ResourceShareManageSheet from './ResourceShareManageSheet';
import ResourceShareOptionsSheet from './ResourceShareOptionsSheet';
import ResourceSourceSetMenuSheet from './ResourceSourceSetMenuSheet';
import ResourceSourceSetTargetSheet from './ResourceSourceSetTargetSheet';
import ResourceSpaceCreateModal from './ResourceSpaceCreateModal';
import ResourceTrashSheet from './ResourceTrashSheet';
import SharedWithMeSheet from './SharedWithMeSheet';
import { useToast } from './Toast';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

export interface ResourceContentOverlaysProps {
  attachment: {
    sourceSetId: string | null;
    visible: boolean;
    onClose: () => void;
    onDocument: () => void;
    onGallery: () => void;
    onOpenCreateFolder: () => void;
  };
  createFolder: {
    visible: boolean;
    onCancel: () => void;
    onSubmit: (value: string) => void | Promise<void>;
  };
  governance: Omit<React.ComponentProps<typeof ResourceGovernanceSheet>, 'messages'> & {
    enabled: boolean;
  };
  headerMenus: {
    props: React.ComponentProps<typeof ResourceHeaderMenus>;
    onOpenSharedWithMe: () => void;
    onOpenSourceSetManagement: () => void;
    onOpenTrash: () => void;
  };
  itemAction: {
    actionItem: FileListItem | null;
    hasAnySourceSets: boolean;
    inSourceSetScope: boolean;
    otherSourceSetCount: number;
    visible: boolean;
    onAddToChatContext: (item: FileListItem) => void | Promise<void>;
    onClose: () => void;
    onConvertToDocument: () => void | Promise<void>;
    onDeleteItem: (id: string, name: string, isFolderItem: boolean) => void;
    onManageShare: (item: FileListItem) => void;
    onMoveToFolder: (item: FileListItem) => void;
    onOpenSourceSetAction: (ids: string[], mode: 'add' | 'move') => void;
    onPreviewItem: (item: FileListItem) => void;
    onRemoveFromSourceSet: (ids: string[]) => void | Promise<void>;
    onRename: () => void;
    onShare: (item: FileListItem) => void;
  };
  moveToFolder: React.ComponentProps<typeof ResourceMoveToFolderSheet>;
  preview: React.ComponentProps<typeof ResourcePreviewModal>;
  renameModal: {
    defaultValue: string;
    visible: boolean;
    onCancel: () => void;
    onSubmit: (value: string) => void | Promise<void>;
  };
  scopeLauncher: {
    activeSpaceId: string | null;
    currentSpaceName: string;
    groups: React.ComponentProps<typeof ResourceScopeLauncherSheet>['groups'];
    isAllFilesScope: boolean;
    isUnassignedScope: boolean;
    pendingSourceSetSelectionId: string | null;
    selectedSourceSetId: string | null;
    selectedTab: 'spaces' | 'sources';
    showSpaceMemoryShortcut: boolean;
    spaces: React.ComponentProps<typeof ResourceScopeLauncherSheet>['spaces'];
    visible: boolean;
    workspaceTrashLabel: string;
    onChangeTab: (tab: 'spaces' | 'sources') => void;
    onClose: () => void;
    onCreateSourceSet: () => void;
    onCreateSpace: () => void;
    onOpenSharedWithMe: () => void;
    onOpenSpaceMemory?: () => void;
    onOpenTrash: () => void;
    onSelectAllFiles: () => void;
    onSelectSourceSet: (
      item: React.ComponentProps<
        typeof ResourceScopeLauncherSheet
      >['groups'][number]['items'][number],
    ) => void;
    onSelectSpace: (spaceId: string) => void;
    onSelectUnassigned: () => void;
  };
  sharedWithMe: React.ComponentProps<typeof SharedWithMeSheet>;
  shareManage: Omit<React.ComponentProps<typeof ResourceShareManageSheet>, 'onActionError'>;
  shareOptions: Omit<
    React.ComponentProps<typeof ResourceShareOptionsSheet>,
    'onFail' | 'onSuccess'
  >;
  sourceSetMenu: {
    visible: boolean;
    onClose: () => void;
    onDelete: () => void;
    onManageShare: () => void;
    onRename: () => void;
    onShare: () => void;
  };
  sourceSetNameModal: {
    defaultValue: string;
    mode: 'create' | 'rename';
    visible: boolean;
    onCancel: () => void;
    onSubmit: (value: string) => void | Promise<void>;
  };
  sourceSetTarget: React.ComponentProps<typeof ResourceSourceSetTargetSheet>;
  spaceCreate: Omit<React.ComponentProps<typeof ResourceSpaceCreateModal>, 'messages'>;
  trash: React.ComponentProps<typeof ResourceTrashSheet>;
}

export default function ResourceContentOverlays({
  attachment,
  createFolder,
  governance,
  headerMenus,
  itemAction,
  moveToFolder,
  preview,
  renameModal,
  scopeLauncher,
  shareManage,
  shareOptions,
  sharedWithMe,
  sourceSetMenu,
  sourceSetNameModal,
  sourceSetTarget,
  spaceCreate,
  trash,
}: ResourceContentOverlaysProps) {
  const { t } = useI18n();
  const toast = useToast();

  return (
    <>
      <AttachmentSheet
        visible={attachment.visible}
        onClose={attachment.onClose}
        onDocument={() => void attachment.onDocument()}
        onGallery={() => void attachment.onGallery()}
        onNewFolder={
          attachment.sourceSetId
            ? () => {
                attachment.onClose();
                attachment.onOpenCreateFolder();
              }
            : undefined
        }
      />

      {governance.enabled ? (
        <ResourceGovernanceSheet
          {...governance}
          visible={governance.visible}
          messages={{
            resourceGovernanceApply: t.resourceGovernanceApply,
            resourceGovernanceClear: t.resourceGovernanceClear,
            resourceGovernanceFilters: t.resourceGovernanceFilters,
            resourceGovernanceFiltersSubtitle: t.resourceGovernanceFiltersSubtitle,
            resourceGovernanceNoFilters: t.resourceGovernanceNoFilters,
            resourceGovernanceRightsOwnerPlaceholder: t.resourceGovernanceRightsOwnerPlaceholder,
            resourceGovernanceSectionRightsOwner: t.resourceGovernanceSectionRightsOwner,
            resourceGovernanceSelectedFilters: t.resourceGovernanceSelectedFilters,
          }}
        />
      ) : null}

      <ResourcePreviewModal {...preview} />

      <ResourceShareOptionsSheet
        {...shareOptions}
        onFail={() => toast.show('error', t.resourceShareFailed)}
        onSuccess={() => haptics.success()}
      />

      <ResourceShareManageSheet
        {...shareManage}
        onActionError={() => toast.show('error', t.resourceShareFailed)}
      />

      <SharedWithMeSheet {...sharedWithMe} />

      <ResourceTrashSheet {...trash} />

      <ResourceSourceSetMenuSheet
        visible={sourceSetMenu.visible}
        onClose={sourceSetMenu.onClose}
        onRename={sourceSetMenu.onRename}
        onDelete={() => {
          sourceSetMenu.onClose();
          sourceSetMenu.onDelete();
        }}
        onManageShare={() => {
          sourceSetMenu.onClose();
          sourceSetMenu.onManageShare();
        }}
        onShare={() => {
          sourceSetMenu.onClose();
          sourceSetMenu.onShare();
        }}
      />

      <ResourceItemActionSheet
        actionItem={itemAction.actionItem}
        hasAnySourceSets={itemAction.hasAnySourceSets}
        inSourceSetScope={itemAction.inSourceSetScope}
        otherSourceSetCount={itemAction.otherSourceSetCount}
        visible={itemAction.visible}
        onAddToChatContext={itemAction.onAddToChatContext}
        onClose={itemAction.onClose}
        onConvertToDocument={itemAction.onConvertToDocument}
        onManageShare={itemAction.onManageShare}
        onRename={itemAction.onRename}
        onShare={itemAction.onShare}
        onAddToSourceSet={(item) => {
          itemAction.onClose();
          itemAction.onOpenSourceSetAction([item.id], 'add');
        }}
        onDelete={(item) => {
          itemAction.onClose();
          itemAction.onDeleteItem(item.id, item.name, isFolder(item));
        }}
        onMoveToFolder={(item) => {
          itemAction.onMoveToFolder(item);
          itemAction.onClose();
        }}
        onMoveToSourceSet={(item) => {
          itemAction.onClose();
          itemAction.onOpenSourceSetAction([item.id], 'move');
        }}
        onPreview={(item) => {
          haptics.light();
          itemAction.onPreviewItem(item);
          itemAction.onClose();
        }}
        onRemoveFromSourceSet={(item) => {
          itemAction.onClose();
          void itemAction.onRemoveFromSourceSet([item.id]);
        }}
      />

      <PromptModal
        defaultValue={renameModal.defaultValue}
        placeholder={t.resourceRenamePlaceholder}
        submitLabel={t.confirm}
        title={t.actionRename}
        visible={renameModal.visible}
        onCancel={renameModal.onCancel}
        onSubmit={renameModal.onSubmit}
      />

      <PromptModal
        defaultValue={sourceSetNameModal.defaultValue}
        placeholder={t.resourceCreateSourceSetPlaceholder}
        submitLabel={t.confirm}
        title={sourceSetNameModal.mode === 'create' ? t.resourceCreateSourceSet : t.actionRename}
        visible={sourceSetNameModal.visible}
        onCancel={sourceSetNameModal.onCancel}
        onSubmit={sourceSetNameModal.onSubmit}
      />

      <ResourceSourceSetTargetSheet {...sourceSetTarget} />

      <ResourceScopeLauncherSheet
        activeSpaceId={scopeLauncher.activeSpaceId}
        currentSpaceName={scopeLauncher.currentSpaceName}
        groups={scopeLauncher.groups}
        isAllFilesScope={scopeLauncher.isAllFilesScope}
        isUnassignedScope={scopeLauncher.isUnassignedScope}
        pendingSourceSetSelectionId={scopeLauncher.pendingSourceSetSelectionId}
        selectedSourceSetId={scopeLauncher.selectedSourceSetId}
        selectedTab={scopeLauncher.selectedTab}
        showSpaceMemoryShortcut={scopeLauncher.showSpaceMemoryShortcut}
        spaces={scopeLauncher.spaces}
        visible={scopeLauncher.visible}
        workspaceTrashLabel={scopeLauncher.workspaceTrashLabel}
        onChangeTab={scopeLauncher.onChangeTab}
        onClose={scopeLauncher.onClose}
        onCreateSourceSet={scopeLauncher.onCreateSourceSet}
        onCreateSpace={scopeLauncher.onCreateSpace}
        onSelectSourceSet={scopeLauncher.onSelectSourceSet}
        onSelectSpace={scopeLauncher.onSelectSpace}
        onOpenSharedWithMe={() => {
          scopeLauncher.onClose();
          scopeLauncher.onOpenSharedWithMe();
        }}
        onOpenSpaceMemory={
          scopeLauncher.onOpenSpaceMemory
            ? () => {
                scopeLauncher.onClose();
                scopeLauncher.onOpenSpaceMemory?.();
              }
            : undefined
        }
        onOpenTrash={() => {
          scopeLauncher.onClose();
          scopeLauncher.onOpenTrash();
        }}
        onSelectAllFiles={() => {
          scopeLauncher.onSelectAllFiles();
          scopeLauncher.onClose();
        }}
        onSelectUnassigned={() => {
          scopeLauncher.onSelectUnassigned();
          scopeLauncher.onClose();
        }}
      />

      <ResourceSpaceCreateModal
        {...spaceCreate}
        messages={{
          cancel: t.cancel,
          workspaceCreateConfirm: t.workspaceCreateConfirm,
          workspaceCreateCreating: t.workspaceCreateCreating,
          workspaceCreateDescriptionPlaceholder: t.workspaceCreateDescriptionPlaceholder,
          workspaceCreateNamePlaceholder: t.workspaceCreateNamePlaceholder,
          workspaceCreateTitle: t.workspaceCreateTitle,
        }}
      />

      <ResourceMoveToFolderSheet {...moveToFolder} />

      <ResourceHeaderMenus
        {...headerMenus.props}
        onOpenSharedWithMe={() => {
          headerMenus.props.onCloseHeader();
          headerMenus.onOpenSharedWithMe();
        }}
        onOpenSort={() => {
          headerMenus.props.onCloseHeader();
          headerMenus.props.onOpenSort();
        }}
        onOpenSourceSetMenu={() => {
          headerMenus.props.onCloseHeader();
          headerMenus.onOpenSourceSetManagement();
        }}
        onOpenTrash={() => {
          headerMenus.props.onCloseHeader();
          headerMenus.onOpenTrash();
        }}
      />

      <PromptModal
        placeholder={t.resourceCreateFolderPlaceholder}
        submitLabel={t.done}
        title={t.resourceCreateFolder}
        visible={createFolder.visible}
        onCancel={createFolder.onCancel}
        onSubmit={createFolder.onSubmit}
      />
    </>
  );
}
