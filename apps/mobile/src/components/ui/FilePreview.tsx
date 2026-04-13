/**
 * FilePreview — Horizontal strip showing pending file attachments and document contexts.
 * Non-image files and document contexts use icon cards.
 * Existing resources open on tap and remove on long press.
 */
import { useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { FileImage, LibraryBig } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';

import { getApiUrl } from '../../lib/api';
import { getAuthHeaders } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { navigateToContent, navigateToNotebook } from '../../lib/navigation';
import {
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
} from '../../lib/portalNavigation';
import { buildRemoteSource, resolveRemoteFileUrl } from '../../lib/resourcePreviewUrl';
import { useFileStore } from '../../store/file';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { ChatContextSelection, ConversationFileItem, FileAttachment } from '../../types';
import ResourceFileTypeIcon from './ResourceFileTypeIcon';

const CARD_SIZE = 40;
const CONTEXT_CARD_WIDTH = 148;
const ICON_SIZE = 20;
const DOUBLE_TAP_DELAY = 300;
const EMPTY_HEADERS: Record<string, string> = {};

const isLocalPreviewUri = (uri?: string) =>
  !!uri &&
  (uri.startsWith('content://') ||
    uri.startsWith('data:') ||
    uri.startsWith('file://') ||
    uri.startsWith('ph://'));

const resolveRemotePreviewUrl = (baseUrl: string, id: string, uri?: string) => {
  if (!uri) return baseUrl ? `${baseUrl}/f/${id}` : '';

  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('file://')) {
    return uri;
  }

  if (uri.startsWith('/')) {
    return `${baseUrl}${uri}`;
  }

  return baseUrl ? `${baseUrl}/f/${id}` : uri;
};

const buildRemotePreviewCandidates = (baseUrl: string, file: FileAttachment) => {
  const remoteId = file.fileId || file.id;
  const candidates = [
    file.url ? resolveRemotePreviewUrl(baseUrl, remoteId, file.url) : '',
    !isLocalPreviewUri(file.uri) ? resolveRemotePreviewUrl(baseUrl, remoteId, file.uri) : '',
    baseUrl && file.fileId ? `${baseUrl.replace(/\/+$/, '')}/f/${file.fileId}` : '',
  ];

  return [...new Set(candidates.filter(Boolean))];
};

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

const PendingImageThumbnail = memo(
  ({
    apiBaseUrl,
    file,
    headers,
  }: {
    apiBaseUrl: string;
    file: FileAttachment;
    headers: Record<string, string>;
  }) => {
    const [candidateIndex, setCandidateIndex] = useState(0);
    const remoteCandidates = useMemo(
      () => (isLocalPreviewUri(file.uri) ? [] : buildRemotePreviewCandidates(apiBaseUrl, file)),
      [apiBaseUrl, file],
    );

    useEffect(() => {
      setCandidateIndex(0);
    }, [remoteCandidates, file.id, file.uri, file.url]);

    const localUri = isLocalPreviewUri(file.uri) ? file.uri : null;
    const remoteCandidate = remoteCandidates[candidateIndex] || null;
    const source = localUri
      ? { uri: localUri }
      : remoteCandidate
        ? {
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
            uri: remoteCandidate,
          }
        : null;

    if (!source) {
      return (
        <View className="flex-1 items-center justify-center">
          <FileImage
            color="rgba(255,255,255,0.7)"
            size={ICON_SIZE}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </View>
      );
    }

    return (
      <Image
        cachePolicy="memory-disk"
        className="h-full w-full"
        contentFit="cover"
        source={source}
        onError={() => {
          if (localUri) return;
          if (candidateIndex < remoteCandidates.length - 1) {
            setCandidateIndex((current) => current + 1);
          }
        }}
      />
    );
  },
);

PendingImageThumbnail.displayName = 'PendingImageThumbnail';

const ConversationImageThumbnail = memo(
  ({
    apiBaseUrl,
    file,
    headers,
  }: {
    apiBaseUrl: string;
    file: ConversationFileItem;
    headers: Record<string, string>;
  }) => {
    const remoteUrl = useMemo(
      () => resolveRemoteFileUrl(apiBaseUrl, { id: file.id, url: '' }),
      [apiBaseUrl, file.id],
    );
    const source = useMemo(
      () => buildRemoteSource(apiBaseUrl, remoteUrl, headers),
      [apiBaseUrl, headers, remoteUrl],
    );

    if (!source) {
      return (
        <View className="flex-1 items-center justify-center">
          <FileImage
            color="rgba(255,255,255,0.7)"
            size={ICON_SIZE}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </View>
      );
    }

    return (
      <Image
        cachePolicy="memory-disk"
        className="h-full w-full"
        contentFit="cover"
        source={source}
      />
    );
  },
);

ConversationImageThumbnail.displayName = 'ConversationImageThumbnail';

type PreviewItem = ConversationPreviewItem | ContextPreviewItem | PendingPreviewItem;
const EMPTY_CHAT_CONTEXT_SELECTIONS: ChatContextSelection[] = [];
const EMPTY_PENDING_FILES: FileAttachment[] = [];

const FilePreview = memo<FilePreviewProps>(
  ({ conversationFiles = [], onRemoveConversationFile, sessionId, threadId, topicId }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const route = useRoute();
    const [apiBaseUrl, setApiBaseUrl] = useState('');
    const [remoteHeaders, setRemoteHeaders] = useState<Record<string, string>>(EMPTY_HEADERS);
    const chatContextSelections = useFileStore((s) =>
      sessionId
        ? (s.sessionChatContextSelections[sessionId] ?? EMPTY_CHAT_CONTEXT_SELECTIONS)
        : s.chatContextSelections,
    );
    const pendingFiles = useFileStore((s) =>
      sessionId ? (s.sessionPendingFiles[sessionId] ?? EMPTY_PENDING_FILES) : s.pendingFiles,
    );
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

    useEffect(() => {
      let cancelled = false;

      const loadRemotePreviewConfig = async () => {
        const base = (await getApiUrl())?.replace(/\/$/, '') ?? '';
        const headers = base ? await getAuthHeaders(base) : EMPTY_HEADERS;

        if (cancelled) return;

        setApiBaseUrl(base);
        setRemoteHeaders(headers);
      };

      void loadRemotePreviewConfig();

      return () => {
        cancelled = true;
      };
    }, []);

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
          removeFile(fileId, { sessionId });
          lastTapRef.current[fileId] = 0;
        } else {
          lastTapRef.current[fileId] = now;
        }
      },
      [removeFile, sessionId],
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
        navigateToContent(
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
          const isImage = file.fileType.startsWith('image/') || file.type?.startsWith('image/');

          if (isImage) {
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                className="mr-2 overflow-hidden rounded-lg border border-foreground/10 bg-foreground/5"
                style={{ height: CARD_SIZE, width: CARD_SIZE }}
                onLongPress={() => handleConversationFileLongPress(file.id)}
                onPress={() => handleConversationFilePress(file)}
              >
                <ConversationImageThumbnail
                  apiBaseUrl={apiBaseUrl}
                  file={file}
                  headers={remoteHeaders}
                />
              </TouchableOpacity>
            );
          }

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
                <ResourceFileTypeIcon color={colors.primary} fileType={file.fileType} size={16} />
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
              <PendingImageThumbnail apiBaseUrl={apiBaseUrl} file={file} headers={remoteHeaders} />
            ) : (
              <View className="flex-1 items-center justify-center">
                <ResourceFileTypeIcon
                  color={colors.iconMuted}
                  fileType={file.type}
                  size={ICON_SIZE}
                />
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
        apiBaseUrl,
        handleCardPress,
        handleContextLongPress,
        handleContextPress,
        handleConversationFileLongPress,
        handleConversationFilePress,
        remoteHeaders,
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
