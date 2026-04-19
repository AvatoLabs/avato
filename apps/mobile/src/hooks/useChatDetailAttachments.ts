import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '../components/ui/Toast';
import { getApiUrl, sessionApi } from '../lib/api';
import {
  createPendingAttachmentId,
  createPickedAttachment,
  createWorkspacePendingAttachment,
} from '../lib/chatAttachments';
import {
  createChatContextSelectionFromResource,
  isChatContextEligibleResource,
} from '../lib/chatContext';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { getCanonicalResourceKind } from '../lib/resourceList';
import { useFileStore } from '../store/file';
import type { ConversationFileItem, FileListItem } from '../types';

export function useChatDetailAttachments({ sessionId }: { sessionId?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const addFile = useFileStore((s) => s.addFile);
  const addSessionChatContextSelection = useFileStore((s) => s.addSessionChatContextSelection);

  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [resourcePickerVisible, setResourcePickerVisible] = useState(false);
  const [conversationFiles, setConversationFiles] = useState<ConversationFileItem[]>([]);

  useEffect(() => {
    setConversationFiles([]);
  }, [sessionId]);

  const loadConversationFiles = useCallback(async () => {
    if (!sessionId) {
      setConversationFiles([]);
      return;
    }

    try {
      const nextFiles = await sessionApi.getConversationFiles({ sessionId });
      setConversationFiles((nextFiles ?? []).filter((item) => item.enabled));
    } catch (error) {
      console.warn('[ChatDetailScreen] Failed to load conversation files', {
        error,
        sessionId,
      });
      setConversationFiles([]);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadConversationFiles();
    }, [loadConversationFiles]),
  );

  const pickImage = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
            : await ImagePicker.launchImageLibraryAsync({
                allowsMultipleSelection: true,
                mediaTypes: 'images',
                quality: 0.8,
              });

        if (result.canceled) return;

        for (const asset of result.assets) {
          addFile(
            createPickedAttachment({
              fallbackName: 'image.jpg',
              fallbackType: 'image/jpeg',
              id: createPendingAttachmentId(),
              name: asset.fileName,
              size: asset.fileSize,
              type: asset.mimeType,
              uri: asset.uri,
            }),
            { sessionId },
          );
        }
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ERR_CANCELED'
        ) {
          return;
        }

        toast.show('error', t.fileUploadError);
      }
    },
    [addFile, sessionId, t.fileUploadError, toast],
  );

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      for (const asset of result.assets) {
        addFile(
          createPickedAttachment({
            fallbackName: 'file',
            fallbackType: 'application/octet-stream',
            id: createPendingAttachmentId(),
            name: asset.name,
            size: asset.size,
            type: asset.mimeType,
            uri: asset.uri,
          }),
          { sessionId },
        );
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_CANCELED') {
        return;
      }

      toast.show('error', t.fileUploadError);
    }
  }, [addFile, sessionId, t.fileUploadError, toast]);

  const openAttachmentSheet = useCallback(() => {
    haptics.selection();
    setAttachmentSheetVisible(true);
  }, []);

  const closeAttachmentSheet = useCallback(() => {
    setAttachmentSheetVisible(false);
  }, []);

  const openResourcePicker = useCallback(() => {
    setResourcePickerVisible(true);
  }, []);

  const closeResourcePicker = useCallback(() => {
    setResourcePickerVisible(false);
  }, []);

  const handleRemoveConversationFile = useCallback(
    async (fileId: string) => {
      if (!sessionId) return;

      try {
        await sessionApi.deleteConversationFile(fileId, { sessionId });
        setConversationFiles((prev) => prev.filter((item) => item.id !== fileId));
      } catch (error) {
        console.warn('[ChatDetailScreen] Failed to remove conversation file', {
          error,
          fileId,
          sessionId,
        });
        toast.show('error', t.fileUploadFailed);
      }
    },
    [sessionId, t.fileUploadFailed, toast],
  );

  const handleWorkspaceSelect = useCallback(
    async (items: FileListItem[]) => {
      const base = await getApiUrl();
      const baseUrl = base?.replace(/\/$/, '') ?? '';
      const conversationFileIds = new Set<string>();
      let failedContextCount = 0;

      for (const item of items) {
        if (!item.id) continue;

        const itemKind = getCanonicalResourceKind(item);

        if (isChatContextEligibleResource(item)) {
          const context = await createChatContextSelectionFromResource(item).catch(() => null);
          if (context) {
            if (sessionId) addSessionChatContextSelection(sessionId, context);
            continue;
          }

          if (itemKind === 'document') {
            failedContextCount += 1;
            continue;
          }
        }

        if (itemKind !== 'file') continue;

        if (sessionId) {
          conversationFileIds.add(item.id);
          continue;
        }

        addFile(
          createWorkspacePendingAttachment(
            item,
            baseUrl,
            `workspace-${item.id}-${createPendingAttachmentId()}`,
          ),
          { sessionId },
        );
      }

      if (sessionId && conversationFileIds.size > 0) {
        try {
          await sessionApi.addConversationFiles([...conversationFileIds], { sessionId });
          await loadConversationFiles();
          toast.show('success', t.fileAddToConversationSuccess);
        } catch (error) {
          console.warn('[ChatDetailScreen] Failed to add conversation files', {
            error,
            fileIds: [...conversationFileIds],
            sessionId,
          });
          toast.show('error', t.fileUploadFailed);
        }
      }

      if (failedContextCount > 0) {
        toast.show('error', t.fileUploadFailed);
      }
    },
    [
      addFile,
      addSessionChatContextSelection,
      loadConversationFiles,
      sessionId,
      t.fileAddToConversationSuccess,
      t.fileUploadFailed,
      toast,
    ],
  );

  return {
    attachmentSheetVisible,
    closeAttachmentSheet,
    closeResourcePicker,
    conversationFiles,
    handleRemoveConversationFile,
    handleWorkspaceSelect,
    loadConversationFiles,
    openAttachmentSheet,
    openResourcePicker,
    pickDocument,
    pickImage,
    resourcePickerVisible,
  };
}
