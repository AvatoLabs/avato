'use client';

import { type MenuProps } from '@lobehub/ui';
import { ActionIcon, Button, DropdownMenu, Icon } from '@lobehub/ui';
import { type ChangeEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useFileStore } from '@/store/file';
import { useServerConfigStore } from '@/store/serverConfig';
import { FilesTabs } from '@/types/files';

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
  const createContentItemAndSync = useFileStore((s) => s.createContentItemAndSync);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  const [sourceSetId, category, currentFolderId, spaceId, setCategory, setPendingRenameItemId] =
    useContentManagerStore((s) => [
      s.sourceSetId,
      s.category,
      s.currentFolderId,
      s.spaceId,
      s.setCategory,
      s.setPendingRenameItemId,
    ]);

  const handleCreateFolder = useCallback(async () => {
    // Navigate to "Home" category first if not already there
    if (category !== FilesTabs.Home) {
      setCategory(FilesTabs.Home);
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
      const realId = await createContentItemAndSync({
        content: '',
        fileType: 'custom/folder',
        sourceSetId,
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
    createContentItemAndSync,
    currentFolderId,
    sourceSetId,
    setCategory,
    setPendingRenameItemId,
    spaceId,
    t,
  ]);

  const { handleFolderUpload } = useUploadFolder({
    currentFolderId,
    sourceSetId,
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

      await pushDockFileList(files, sourceSetId, currentFolderId ?? undefined, spaceId);
      event.target.value = '';
    },
    [currentFolderId, sourceSetId, pushDockFileList, spaceId],
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
      ...(sourceSetId
        ? [
            {
              icon: <Icon icon={RESOURCE_ENTRY_ICONS.folder} />,
              key: 'create-folder',
              label: t('header.actions.newFolder'),
              onClick: handleCreateFolder,
            },
            {
              type: 'divider',
            },
          ]
        : []),
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
    ],
    [handleCreateFolder, sourceSetId, openFileUploadDialog, openFolderUploadDialog, t],
  );

  const trigger = useCompact ? (
    <ActionIcon
      data-no-highlight
      icon={RESOURCE_ENTRY_ICONS.plus}
      size="small"
      title={t('addSourceSet')}
    />
  ) : (
    <Button data-no-highlight icon={RESOURCE_ENTRY_ICONS.plus} type="primary">
      {t('addSourceSet')}
    </Button>
  );

  return (
    <>
      <DropdownMenu
        items={items}
        nativeButton={!useCompact}
        open={menuOpen}
        placement="bottomRight"
        trigger="both"
        onOpenChange={setMenuOpen}
      >
        {trigger}
      </DropdownMenu>
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
    </>
  );
};

export default AddButton;
