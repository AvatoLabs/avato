/**
 * FilePreview — Horizontal strip showing pending file attachments and document contexts.
 * Non-image files and document contexts use icon cards.
 * Existing resources open on tap and remove on long press.
 */
import { useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { File, FileAudio, FileImage, FileText, FileVideo, LibraryBig } from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { navigateToNotebook, navigateToResources } from '../../lib/navigation';
import {
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
} from '../../lib/portalNavigation';
import { useFileStore } from '../../store/file';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { ChatContextSelection, ConversationFileItem, FileAttachment } from '../../types';

const CARD_SIZE = 40;
const CONTEXT_CARD_WIDTH = 148;
const ICON_SIZE = 20;
const DOUBLE_TAP_DELAY = 300;

function FileTypeIcon({
  fileType,
  color,
  size = ICON_SIZE,
}: {
  fileType: string;
  color: string;
  fileName?: string;
  size?: number;
}) {
  if (fileType.startsWith('image/'))
    return <FileImage color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (fileType.startsWith('audio/'))
    return <FileAudio color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (fileType.startsWith('video/'))
    return <FileVideo color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (
    fileType.startsWith('application/pdf') ||
    fileType.startsWith('text/') ||
    fileType.startsWith('application/msword') ||
    fileType.startsWith('application/vnd')
  ) {
    return <FileText color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  }
  return <File color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
}

interface FilePreviewProps {
  conversationFiles?: ConversationFileItem[];
  onRemoveConversationFile?: (fileId: string) => void | Promise<void>;
  sessionId?: string;
  threadId?: string;
  topicId?: string;
}

interface ConversationPreviewItem {
  file: ConversationFileItem;
  id: string;
  kind: 'conversation';
}

interface ContextPreviewItem {
  context: ChatContextSelection;
  id: string;
  kind: 'context';
}

interface PendingPreviewItem {
  file: FileAttachment;
  id: string;
  kind: 'pending';
}

type PreviewItem = ConversationPreviewItem | ContextPreviewItem | PendingPreviewItem;

const FilePreview = memo<FilePreviewProps>(
  ({ conversationFiles = [], onRemoveConversationFile, sessionId, threadId, topicId }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const route = useRoute();
    const chatContextSelections = useFileStore((s) =>
      sessionId ? (s.sessionChatContextSelections[sessionId] ?? []) : s.chatContextSelections,
    );
    const pendingFiles = useFileStore((s) => s.pendingFiles);
    const removeFile = useFileStore((s) => s.removeFile);
    const removeChatContextSelection = useFileStore((s) => s.removeChatContextSelection);
    const removeSessionChatContextSelection = useFileStore(
      (s) => s.removeSessionChatContextSelection,
    );
    const uploadFile = useFileStore((s) => s.uploadFile);
    const lastTapRef = useRef<Record<string, number>>({});
    const conversationOrigin = useMemo(
      () => createConversationOrigin({ sessionId, threadId, topicId }),
      [sessionId, threadId, topicId],
    );
    const previewItems = useMemo<PreviewItem[]>(
      () => [
        ...conversationFiles.map((file) => ({
          file,
          id: `conversation-${file.id}`,
          kind: 'conversation' as const,
        })),
        ...chatContextSelections.map((context) => ({
          context,
          id: `context-${context.id}`,
          kind: 'context' as const,
        })),
        ...pendingFiles.map((file) => ({
          file,
          id: `pending-${file.id}`,
          kind: 'pending' as const,
        })),
      ],
      [chatContextSelections, conversationFiles, pendingFiles],
    );

    const handleCardPress = useCallback(
      (fileId: string) => {
        const now = Date.now();
        const last = lastTapRef.current[fileId] ?? 0;
        if (now - last < DOUBLE_TAP_DELAY) {
          removeFile(fileId);
          lastTapRef.current[fileId] = 0;
        } else {
          lastTapRef.current[fileId] = now;
        }
      },
      [removeFile],
    );

    const handleContextPress = useCallback(
      (context: ChatContextSelection) => {
        navigateToNotebook(
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              documentId: context.docId,
            },
            conversationOrigin,
          ),
        );
      },
      [conversationOrigin, route.name, route.params],
    );

    const handleContextLongPress = useCallback(
      (contextId: string) => {
        if (sessionId) {
          removeSessionChatContextSelection(sessionId, contextId);
          return;
        }

        removeChatContextSelection(contextId);
      },
      [removeChatContextSelection, removeSessionChatContextSelection, sessionId],
    );

    const handleConversationFilePress = useCallback(
      (file: ConversationFileItem) => {
        navigateToResources(
          appendCurrentPortalStackWithOrigin(
            route.name,
            route.params,
            {
              openItem: {
                fileType: file.fileType,
                id: file.id,
                name: file.name,
                sourceType: 'file' as const,
              },
            },
            conversationOrigin,
          ),
        );
      },
      [conversationOrigin, route.name, route.params],
    );

    const handleConversationFileLongPress = useCallback(
      (fileId: string) => {
        if (!onRemoveConversationFile) return;
        void onRemoveConversationFile(fileId);
      },
      [onRemoveConversationFile],
    );

    const renderPreviewItem = useCallback(
      ({ item }: { item: PreviewItem }) => {
        if (item.kind === 'conversation') {
          const { file } = item;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              className="mr-2 flex-row items-center rounded-xl border border-foreground/10 bg-foreground/5 px-3"
              style={{ height: CARD_SIZE, width: CONTEXT_CARD_WIDTH }}
              onLongPress={() => handleConversationFileLongPress(file.id)}
              onPress={() => handleConversationFilePress(file)}
            >
              <View
                className="mr-2 h-7 w-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <FileTypeIcon color={colors.primary} fileType={file.fileType} size={16} />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-semibold" style={{ color: colors.secondaryText }}>
                  {t.fileConversationFile}
                </Text>
                <Text className="text-[12px] font-medium text-foreground" numberOfLines={1}>
                  {file.name}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }

        if (item.kind === 'context') {
          const { context } = item;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              className="mr-2 flex-row items-center rounded-xl border border-foreground/10 bg-foreground/5 px-3"
              style={{ height: CARD_SIZE, width: CONTEXT_CARD_WIDTH }}
              onLongPress={() => handleContextLongPress(context.id)}
              onPress={() => handleContextPress(context)}
            >
              <View
                className="mr-2 h-7 w-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <LibraryBig
                  color={colors.primary}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-semibold" style={{ color: colors.secondaryText }}>
                  {t.fileChatContext}
                </Text>
                <Text className="text-[12px] font-medium text-foreground" numberOfLines={1}>
                  {context.title || context.preview || context.docId}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }

        const { file } = item;
        const isImage = file.type.startsWith('image/');
        const cardBorderClass =
          file.status === 'error'
            ? 'border border-red-300'
            : file.status === 'done'
              ? 'border border-emerald-300'
              : 'border border-foreground/10';

        return (
          <TouchableOpacity
            activeOpacity={0.9}
            className={`mr-2 rounded-lg overflow-hidden bg-foreground/5 ${cardBorderClass}`}
            style={{ height: CARD_SIZE, width: CARD_SIZE }}
            onPress={() => handleCardPress(file.id)}
          >
            {isImage ? (
              <Image
                cachePolicy="memory-disk"
                className="w-full h-full"
                contentFit="cover"
                source={{ uri: file.uri }}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <FileTypeIcon color={colors.iconMuted} fileType={file.type} size={ICON_SIZE} />
              </View>
            )}

            {file.status === 'uploading' && (
              <View className="absolute inset-0 bg-black/40 items-center justify-center">
                <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                <Text className="text-[8px] text-white/90 font-medium mt-0.5">
                  {file.progress > 0 ? `${Math.round(file.progress)}%` : t.fileUploading}
                </Text>
              </View>
            )}
            {file.status === 'error' && (
              <TouchableOpacity
                activeOpacity={0.8}
                className="absolute inset-0 bg-red-500/45 items-center justify-center px-1"
                onPress={() => void uploadFile(file.id, { sessionId })}
              >
                <Text className="text-white text-[9px] font-semibold">{t.retry}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      },
      [
        colors.fillTertiary,
        colors.iconMuted,
        colors.iconOnPrimary,
        colors.primary,
        colors.secondaryText,
        handleCardPress,
        handleContextLongPress,
        handleContextPress,
        handleConversationFileLongPress,
        handleConversationFilePress,
        sessionId,
        t.fileChatContext,
        t.fileConversationFile,
        t.fileUploading,
        t.retry,
        uploadFile,
      ],
    );

    if (previewItems.length === 0) {
      return null;
    }

    return (
      <FlatList
        horizontal
        className="py-1"
        contentContainerStyle={{ paddingHorizontal: 2 }}
        data={previewItems}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={renderPreviewItem}
        showsHorizontalScrollIndicator={false}
      />
    );
  },
);

FilePreview.displayName = 'FilePreview';

export default FilePreview;
