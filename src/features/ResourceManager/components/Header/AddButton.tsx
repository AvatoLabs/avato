'use client';

import { FILE_URL } from '@lobechat/business-const';
import { Notion } from '@lobehub/icons';
import { type MenuProps } from '@lobehub/ui';
import { ActionIcon, Button, DropdownMenu, Icon } from '@lobehub/ui';
import { type ChangeEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import GuideModal from '@/components/GuideModal';
import GuideVideo from '@/components/GuideVideo';
import { ACTION_ENTRY_ICONS } from '@/config/entryIcons';
import { RESOURCE_ENTRY_ICONS } from '@/config/resourceIcons';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useFileStore } from '@/store/file';
import { useServerConfigStore } from '@/store/serverConfig';
import { FilesTabs } from '@/types/files';

import useNotionImport from './hooks/useNotionImport';
import useUploadFolder from './hooks/useUploadFolder';

const getAcceptedFileTypes = (category: FilesTabs): string | undefined => {
  switch (category) {
    case FilesTabs.Videos: {
      return 'video/*';
    }
    case FilesTabs.Audios: {
      return 'audio/*';
    }
    case FilesTabs.Documents: {
      return '.pdf,.doc,.docx,.md,.markdown,.xls,.xlsx';
    }
    case FilesTabs.Images: {
      return 'image/*';
    }
    default: {
      return undefined;
    }
  }
};

interface AddButtonProps {
  /** Compact mode: icon-only, for mobile toolbars */
  compact?: boolean;
}

const AddButton = ({ compact }: AddButtonProps) => {
  const { t } = useTranslation('file');
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const useCompact = compact ?? isMobile;
  const pushDockFileList = useFileStore((s) => s.pushDockFileList);
  const uploadFolderWithStructure = useFileStore((s) => s.uploadFolderWithStructure);
  const createResourceAndSync = useFileStore((s) => s.createResourceAndSync);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  // TODO: Migrate Notion import to use createResource
  // Keep old functions temporarily for components not yet migrated
  const createDocument = useFileStore((s) => s.createDocument);

  const [
    libraryId,
    category,
    currentFolderId,
    spaceId,
    setCategory,
    setCurrentViewItemId,
    setMode,
    setPendingRenameItemId,
  ] = useResourceManagerStore((s) => [
    s.libraryId,
    s.category,
    s.currentFolderId,
    s.spaceId,
    s.setCategory,
    s.setCurrentViewItemId,
    s.setMode,
    s.setPendingRenameItemId,
  ]);

  const handleOpenPageEditor = useCallback(async () => {
    // Navigate to "All" category first if not already there
    if (category !== FilesTabs.All) {
      setCategory(FilesTabs.All);
    }

    // Create a new page and wait for server sync - ensures page editor can load the document
    const untitledTitle = t('pageList.untitled');
    const realId = await createResourceAndSync({
      content: '',
      fileType: 'custom/document',
      knowledgeBaseId: libraryId,
      parentId: currentFolderId ?? undefined,
      spaceId,
      sourceType: 'document',
      title: untitledTitle,
    });

    // Switch to page view mode with real ID
    setCurrentViewItemId(realId);
    setMode('page');
  }, [
    category,
    createResourceAndSync,
    currentFolderId,
    libraryId,
    setCategory,
    setCurrentViewItemId,
    setMode,
    spaceId,
    t,
  ]);

  const handleCreateFolder = useCallback(async () => {
    // Navigate to "All" category first if not already there
    if (category !== FilesTabs.All) {
      setCategory(FilesTabs.All);
    }

    // Create folder and wait for sync to complete before triggering rename
    try {
      // Get current resource list to check for duplicate folder names
      const resourceList = useFileStore.getState().resourceList || [];

      // Filter for folders at the same level
      const foldersAtSameLevel = resourceList.filter(
        (item) =>
          item.fileType === 'custom/folder' &&
          (item.parentId ?? null) === (currentFolderId ?? null),
      );

      // Generate unique folder name
      const baseName = 'Untitled';
      const existingNames = new Set(foldersAtSameLevel.map((folder) => folder.name));

      let uniqueName = baseName;
      let counter = 1;

      while (existingNames.has(uniqueName)) {
        uniqueName = `${baseName} ${counter}`;
        counter++;
      }

      // Wait for sync to complete to get the real ID
      const realId = await createResourceAndSync({
        content: '',
        fileType: 'custom/folder',
        knowledgeBaseId: libraryId,
        parentId: currentFolderId ?? undefined,
        spaceId,
        sourceType: 'document',
        title: uniqueName,
      });

      // Trigger auto-rename with the real ID (after sync completes)
      setPendingRenameItemId(realId);
    } catch (error) {
      message.error(t('header.actions.createFolderError'));
      console.error('Failed to create folder:', error);
    }
  }, [
    category,
    createResourceAndSync,
    currentFolderId,
    libraryId,
    setCategory,
    setPendingRenameItemId,
    spaceId,
    t,
  ]);

  const {
    handleCloseNotionGuide,
    handleNotionImport,
    handleOpenNotionGuide,
    handleStartNotionImport,
    notionGuideOpen,
    notionInputRef,
  } = useNotionImport({
    createDocument,
    currentFolderId,
    libraryId,
    spaceId,
    refetchResources: async () => {
      const { revalidateResources } = await import('@/store/file/slices/resource/hooks');
      await revalidateResources();
    },
    t,
  });

  const { handleFolderUpload } = useUploadFolder({
    currentFolderId,
    libraryId,
    spaceId,
    t,
    uploadFolderWithStructure,
  });
  const handleFolderUploadWithClose = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setMenuOpen(false);
      return handleFolderUpload(event);
    },
    [handleFolderUpload],
  );

  const handleFileUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      await pushDockFileList(files, libraryId, currentFolderId ?? undefined, spaceId);
      event.target.value = '';
    },
    [currentFolderId, libraryId, pushDockFileList, spaceId],
  );

  const openFileUploadDialog = useCallback(() => {
    setMenuOpen(false);
    fileUploadInputRef.current?.click();
  }, []);

  const openFolderUploadDialog = useCallback(() => {
    setMenuOpen(false);
    folderUploadInputRef.current?.click();
  }, []);

  const items = useMemo<MenuProps['items']>(
    () => [
      {
        icon: <Icon icon={ACTION_ENTRY_ICONS.createPage} />,
        key: 'create-note',
        label: t('header.actions.newPage'),
        onClick: handleOpenPageEditor,
      },
      ...(libraryId
        ? [
            {
              icon: <Icon icon={RESOURCE_ENTRY_ICONS.folder} />,
              key: 'create-folder',
              label: t('header.actions.newFolder'),
              onClick: handleCreateFolder,
            },
          ]
        : []),
      {
        type: 'divider',
      },
      {
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.fileUpload} />,
        key: 'upload-file',
        label: t('header.actions.uploadFile'),
        onClick: openFileUploadDialog,
      },
      {
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.folderUpload} />,
        key: 'upload-folder',
        label: t('header.actions.uploadFolder'),
        onClick: openFolderUploadDialog,
      },
      {
        type: 'divider',
      },
      {
        children: [
          {
            icon: <Notion />,
            key: 'connect-notion',
            label: 'Notion',
            onClick: handleOpenNotionGuide,
          },
        ],
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.link} />,
        key: 'connect',
        label: t('header.actions.connect'),
      },
    ],
    [
      handleCreateFolder,
      handleOpenPageEditor,
      handleOpenNotionGuide,
      libraryId,
      openFileUploadDialog,
      openFolderUploadDialog,
      t,
    ],
  );

  const trigger = useCompact ? (
    <ActionIcon
      data-no-highlight
      icon={RESOURCE_ENTRY_ICONS.plus}
      size="small"
      title={t('addLibrary')}
    />
  ) : (
    <Button data-no-highlight icon={RESOURCE_ENTRY_ICONS.plus} type="primary">
      {t('addLibrary')}
    </Button>
  );

  return (
    <>
      <DropdownMenu
        items={items}
        open={menuOpen}
        placement="bottomRight"
        trigger="both"
        onOpenChange={setMenuOpen}
      >
        {trigger}
      </DropdownMenu>
      <GuideModal
        cancelText={t('header.actions.notionGuide.cancel')}
        cover={<GuideVideo height={269} src={FILE_URL.importFromNotionGuide} width={358} />}
        desc={t('header.actions.notionGuide.desc')}
        okText={t('header.actions.notionGuide.ok')}
        open={notionGuideOpen}
        title={t('header.actions.notionGuide.title')}
        onCancel={handleCloseNotionGuide}
        onOk={handleStartNotionImport}
      />
      <input
        multiple
        accept={getAcceptedFileTypes(category)}
        ref={fileUploadInputRef}
        style={{ display: 'none' }}
        type="file"
        onChange={handleFileUpload}
      />
      <input
        multiple
        ref={folderUploadInputRef}
        style={{ display: 'none' }}
        type="file"
        // @ts-expect-error - webkitdirectory is not in the React types
        webkitdirectory=""
        onChange={handleFolderUploadWithClose}
      />
      <input
        accept=".zip"
        ref={notionInputRef}
        style={{ display: 'none' }}
        type="file"
        onChange={handleNotionImport}
      />
    </>
  );
};

export default AddButton;
