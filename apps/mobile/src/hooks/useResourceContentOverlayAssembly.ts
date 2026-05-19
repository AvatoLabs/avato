import type { ResourceContentOverlaysProps } from '../components/ui/ResourceContentOverlays';
import type { FileListItem } from '../types';

interface UseResourceContentOverlayAssemblyProps {
  attachment: {
    onClose: () => void;
    onOpenCreateFolder: () => void;
    onPickDocument: () => void | Promise<void>;
    onPickGallery: () => void | Promise<void>;
    sourceSetId: string | null;
    visible: boolean;
  };
  createFolder: {
    onCancel: () => void;
    onSubmit: (value: string) => void | Promise<void>;
    visible: boolean;
  };
  governance: {
    capabilityHint?: string;
    draftFilterCount: number;
    draftFilters: ResourceContentOverlaysProps['governance']['draftFilters'];
    draftTokens: ResourceContentOverlaysProps['governance']['draftTokens'];
    enabled: boolean;
    hasDraftChanges: boolean;
    onApply: () => void;
    onClearDraft: () => void;
    onClose: () => void;
    onRemoveDraftFilter: ResourceContentOverlaysProps['governance']['onRemoveDraftFilter'];
    onSetDraftFilters: ResourceContentOverlaysProps['governance']['onSetDraftFilters'];
    sections: ResourceContentOverlaysProps['governance']['sections'];
    visible: boolean;
  };
  headerMenus: {
    currentSortLabel: string;
    dropdownHorizontalPadding: number;
    dropdownTopPadding: number;
    headerMenuMinWidth: number;
    headerVisible: boolean;
    onCloseHeader: () => void;
    onCloseSort: () => void;
    onOpenSharedWithMe: () => void;
    onOpenSort: () => void;
    onOpenSourceSetManagement: () => void;
    onOpenTrash: () => void;
    onSelectSort: (next: 'createdAt' | 'name' | 'size', nextOrder: 'asc' | 'desc') => void;
    sortMenuMinWidth: number;
    sortOrder: 'asc' | 'desc';
    sortVisible: boolean;
    sorter: 'createdAt' | 'name' | 'size';
    sourceSetSelected: boolean;
  };
  itemAction: {
    actionItem: FileListItem | null;
    hasAnySourceSets: boolean;
    inSourceSetScope: boolean;
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
    otherSourceSetCount: number;
  };
  moveToFolder: {
    batchMoveCount: number;
    currentFolder: ResourceContentOverlaysProps['moveToFolder']['currentFolder'];
    currentRootLabel: string;
    folders: ResourceContentOverlaysProps['moveToFolder']['folders'];
    onBack: () => void;
    onClose: () => void;
    onEnterFolder: (folder: FileListItem) => void;
    onSelectFolder: (folderId: string | null) => void | Promise<void>;
    stackDepth: number;
    visible: boolean;
  };
  preview: {
    apiBaseUrl: string;
    initialCachedEntry: ResourceContentOverlaysProps['preview']['initialCachedEntry'];
    item: ResourceContentOverlaysProps['preview']['item'];
    onCacheReady: ResourceContentOverlaysProps['preview']['onCacheReady'];
    onClose: () => void;
    onReplaceItem: ResourceContentOverlaysProps['preview']['onReplaceItem'];
    origin: ResourceContentOverlaysProps['preview']['origin'];
    remoteHeaders: ResourceContentOverlaysProps['preview']['remoteHeaders'];
    visible: boolean;
  };
  rename: {
    defaultValue: string;
    onCancel: () => void;
    onSubmit: (value: string) => void | Promise<void>;
    visible: boolean;
  };
  scopeLauncher: {
    activeSpaceId: string | null;
    currentSpaceName: string;
    groups: ResourceContentOverlaysProps['scopeLauncher']['groups'];
    isAllFilesScope: boolean;
    isUnassignedScope: boolean;
    onChangeTab: (tab: 'spaces' | 'sources') => void;
    onClose: () => void;
    onCreateSourceSet: () => void;
    onCreateSpace: () => void;
    onOpenSharedWithMe: () => void;
    onOpenSpaceMemory?: () => void;
    onOpenSpaceSettings: (spaceId: string) => void;
    onOpenTrash: () => void;
    onSelectAllFiles: () => void;
    onSelectSourceSet: ResourceContentOverlaysProps['scopeLauncher']['onSelectSourceSet'];
    onSelectSpace: (spaceId: string) => void;
    onSelectUnassigned: () => void;
    pendingSourceSetSelectionId: string | null;
    selectedSourceSetId: string | null;
    selectedTab: 'spaces' | 'sources';
    showSpaceMemoryShortcut: boolean;
    spaces: ResourceContentOverlaysProps['scopeLauncher']['spaces'];
    visible: boolean;
    workspaceTrashLabel: string;
  };
  share: {
    manageTarget: ResourceContentOverlaysProps['shareManage']['target'];
    onCloseManage: () => void;
    onCloseShare: () => void;
    onCloseSharedWithMe: () => void;
    onPickSharedWithMe: ResourceContentOverlaysProps['sharedWithMe']['onPick'];
    optionTarget: ResourceContentOverlaysProps['shareOptions']['target'];
    sharedWithMeVisible: boolean;
  };
  sourceSet: {
    actionMode: 'add' | 'move';
    actionSubmitting: boolean;
    actionVisible: boolean;
    id: string | null;
    menuVisible: boolean;
    nameDraft: string;
    nameModalVisible: boolean;
    nameMode: 'create' | 'rename';
    onCloseAction: () => void;
    onCloseMenu: () => void;
    onCloseNameModal: () => void;
    onDelete: () => void;
    onManageShare: () => void;
    onRename: () => void;
    onSelectTarget: (id: string) => void | Promise<void>;
    onShare: () => void;
    onSubmitName: (value: string) => void | Promise<void>;
    sourceSets: ResourceContentOverlaysProps['sourceSetTarget']['sourceSets'];
  };
  spaceCreate: {
    descriptionDraft: string;
    nameDraft: string;
    onChangeDescription: (value: string) => void;
    onChangeName: (value: string) => void;
    onClose: () => void;
    onSubmit: () => void | Promise<void>;
    submitting: boolean;
    visible: boolean;
  };
  trash: {
    items: ResourceContentOverlaysProps['trash']['items'];
    loading: boolean;
    onClose: () => void;
    onRestore: (id: string) => void | Promise<void>;
    restoringId: string | null;
    visible: boolean;
  };
}

export function useResourceContentOverlayAssembly({
  attachment,
  createFolder,
  governance,
  headerMenus,
  itemAction,
  moveToFolder,
  preview,
  rename,
  scopeLauncher,
  share,
  sourceSet,
  spaceCreate,
  trash,
}: UseResourceContentOverlayAssemblyProps): ResourceContentOverlaysProps {
  return {
    attachment: {
      onClose: attachment.onClose,
      onDocument: () => void attachment.onPickDocument(),
      onGallery: () => void attachment.onPickGallery(),
      onOpenCreateFolder: attachment.onOpenCreateFolder,
      sourceSetId: attachment.sourceSetId,
      visible: attachment.visible,
    },
    createFolder: {
      onCancel: createFolder.onCancel,
      onSubmit: createFolder.onSubmit,
      visible: createFolder.visible,
    },
    governance: {
      capabilityHint: governance.capabilityHint,
      draftFilterCount: governance.draftFilterCount,
      draftFilters: governance.draftFilters,
      draftTokens: governance.draftTokens,
      enabled: governance.enabled,
      hasDraftChanges: governance.hasDraftChanges,
      onApply: governance.onApply,
      onClearDraft: governance.onClearDraft,
      onClose: governance.onClose,
      onRemoveDraftFilter: governance.onRemoveDraftFilter,
      onSetDraftFilters: governance.onSetDraftFilters,
      sections: governance.sections,
      visible: governance.visible,
    },
    headerMenus: {
      onOpenSharedWithMe: headerMenus.onOpenSharedWithMe,
      onOpenSourceSetManagement: headerMenus.onOpenSourceSetManagement,
      onOpenTrash: headerMenus.onOpenTrash,
      props: {
        dropdownHorizontalPadding: headerMenus.dropdownHorizontalPadding,
        dropdownTopPadding: headerMenus.dropdownTopPadding,
        headerMenuMinWidth: headerMenus.headerMenuMinWidth,
        headerVisible: headerMenus.headerVisible,
        onCloseHeader: headerMenus.onCloseHeader,
        onCloseSort: headerMenus.onCloseSort,
        onOpenSharedWithMe: headerMenus.onOpenSharedWithMe,
        onOpenSort: headerMenus.onOpenSort,
        onOpenSourceSetMenu: headerMenus.onOpenSourceSetManagement,
        onOpenTrash: headerMenus.onOpenTrash,
        onSelectSort: headerMenus.onSelectSort,
        sortLabel: headerMenus.currentSortLabel,
        sortMenuMinWidth: headerMenus.sortMenuMinWidth,
        sortOrder: headerMenus.sortOrder,
        sortVisible: headerMenus.sortVisible,
        sorter: headerMenus.sorter,
        sourceSetSelected: headerMenus.sourceSetSelected,
      },
    },
    itemAction: {
      actionItem: itemAction.actionItem,
      hasAnySourceSets: itemAction.hasAnySourceSets,
      inSourceSetScope: itemAction.inSourceSetScope,
      onAddToChatContext: itemAction.onAddToChatContext,
      onClose: itemAction.onClose,
      onConvertToDocument: itemAction.onConvertToDocument,
      onDeleteItem: itemAction.onDeleteItem,
      onManageShare: itemAction.onManageShare,
      onMoveToFolder: itemAction.onMoveToFolder,
      onOpenSourceSetAction: itemAction.onOpenSourceSetAction,
      onPreviewItem: itemAction.onPreviewItem,
      onRemoveFromSourceSet: itemAction.onRemoveFromSourceSet,
      onRename: itemAction.onRename,
      onShare: itemAction.onShare,
      otherSourceSetCount: itemAction.otherSourceSetCount,
      visible: !!itemAction.actionItem,
    },
    moveToFolder: {
      batchMoveCount: moveToFolder.batchMoveCount,
      currentFolder: moveToFolder.currentFolder,
      currentRootLabel: moveToFolder.currentRootLabel,
      folders: moveToFolder.folders,
      onBack: moveToFolder.onBack,
      onClose: moveToFolder.onClose,
      onEnterFolder: moveToFolder.onEnterFolder,
      onSelectCurrent: () =>
        void moveToFolder.onSelectFolder(moveToFolder.currentFolder?.id ?? null),
      onSelectRoot: () => void moveToFolder.onSelectFolder(null),
      stackDepth: moveToFolder.stackDepth,
      visible: moveToFolder.visible,
    },
    preview: {
      apiBaseUrl: preview.apiBaseUrl,
      initialCachedEntry: preview.initialCachedEntry,
      item: preview.item,
      onCacheReady: preview.onCacheReady,
      onClose: preview.onClose,
      onReplaceItem: preview.onReplaceItem,
      origin: preview.origin,
      remoteHeaders: preview.remoteHeaders,
      visible: preview.visible,
    },
    renameModal: {
      defaultValue: rename.defaultValue,
      onCancel: rename.onCancel,
      onSubmit: rename.onSubmit,
      visible: rename.visible,
    },
    scopeLauncher: {
      activeSpaceId: scopeLauncher.activeSpaceId,
      currentSpaceName: scopeLauncher.currentSpaceName,
      groups: scopeLauncher.groups,
      isAllFilesScope: scopeLauncher.isAllFilesScope,
      isUnassignedScope: scopeLauncher.isUnassignedScope,
      onChangeTab: scopeLauncher.onChangeTab,
      onClose: scopeLauncher.onClose,
      onCreateSourceSet: scopeLauncher.onCreateSourceSet,
      onCreateSpace: scopeLauncher.onCreateSpace,
      onOpenSharedWithMe: scopeLauncher.onOpenSharedWithMe,
      onOpenSpaceMemory: scopeLauncher.onOpenSpaceMemory,
      onOpenSpaceSettings: scopeLauncher.onOpenSpaceSettings,
      onOpenTrash: scopeLauncher.onOpenTrash,
      onSelectAllFiles: scopeLauncher.onSelectAllFiles,
      onSelectSourceSet: scopeLauncher.onSelectSourceSet,
      onSelectSpace: scopeLauncher.onSelectSpace,
      onSelectUnassigned: scopeLauncher.onSelectUnassigned,
      pendingSourceSetSelectionId: scopeLauncher.pendingSourceSetSelectionId,
      selectedSourceSetId: scopeLauncher.selectedSourceSetId,
      selectedTab: scopeLauncher.selectedTab,
      showSpaceMemoryShortcut: scopeLauncher.showSpaceMemoryShortcut,
      spaces: scopeLauncher.spaces,
      visible: scopeLauncher.visible,
      workspaceTrashLabel: scopeLauncher.workspaceTrashLabel,
    },
    shareManage: {
      onClose: share.onCloseManage,
      target: share.manageTarget,
      visible: !!share.manageTarget,
    },
    shareOptions: {
      onClose: share.onCloseShare,
      target: share.optionTarget,
      visible: !!share.optionTarget,
    },
    sharedWithMe: {
      onClose: share.onCloseSharedWithMe,
      onPick: share.onPickSharedWithMe,
      visible: share.sharedWithMeVisible,
    },
    sourceSetMenu: {
      onClose: sourceSet.onCloseMenu,
      onDelete: sourceSet.onDelete,
      onManageShare: sourceSet.onManageShare,
      onRename: sourceSet.onRename,
      onShare: sourceSet.onShare,
      visible: sourceSet.menuVisible,
    },
    sourceSetNameModal: {
      defaultValue: sourceSet.nameDraft,
      mode: sourceSet.nameMode,
      onCancel: sourceSet.onCloseNameModal,
      onSubmit: sourceSet.onSubmitName,
      visible: sourceSet.nameModalVisible,
    },
    sourceSetTarget: {
      mode: sourceSet.actionMode,
      onClose: sourceSet.onCloseAction,
      onSelect: sourceSet.onSelectTarget,
      sourceSets: sourceSet.sourceSets,
      submitting: sourceSet.actionSubmitting,
      visible: sourceSet.actionVisible,
    },
    spaceCreate: {
      descriptionDraft: spaceCreate.descriptionDraft,
      nameDraft: spaceCreate.nameDraft,
      onChangeDescription: spaceCreate.onChangeDescription,
      onChangeName: spaceCreate.onChangeName,
      onClose: spaceCreate.onClose,
      onSubmit: spaceCreate.onSubmit,
      submitting: spaceCreate.submitting,
      visible: spaceCreate.visible,
    },
    trash: {
      items: trash.items,
      loading: trash.loading,
      onClose: trash.onClose,
      onRestore: trash.onRestore,
      restoringId: trash.restoringId,
      visible: trash.visible,
    },
  };
}
