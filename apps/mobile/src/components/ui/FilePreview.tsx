/**
 * FilePreview — Horizontal strip showing pending file attachments.
 * Non-image files show FileIcon (aligned with web), no thumbnail.
 * Double-tap to remove; horizontal scroll when many.
 */
import { Image } from 'expo-image';
import { File, FileAudio, FileImage, FileText, FileVideo } from 'lucide-react-native';
import React, { memo, useCallback, useRef } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useFileStore } from '../../store/file';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

const CARD_SIZE = 40;
const ICON_SIZE = 20;
const DOUBLE_TAP_DELAY = 300;

function FileTypeIcon({
  fileType,
  fileName,
  color,
  size = ICON_SIZE,
}: {
  fileType: string;
  fileName?: string;
  color: string;
  size?: number;
}) {
  if (fileType.startsWith('image/')) return <FileImage color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (fileType.startsWith('audio/')) return <FileAudio color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
  if (fileType.startsWith('video/')) return <FileVideo color={color} size={size} strokeWidth={tokens.icon.strokeWidth} />;
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
  sessionId?: string;
}

const FilePreview = memo<FilePreviewProps>(({ sessionId }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const removeFile = useFileStore((s) => s.removeFile);
  const uploadFile = useFileStore((s) => s.uploadFile);
  const lastTapRef = useRef<Record<string, number>>({});

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

  if (pendingFiles.length === 0) return null;

  return (
    <ScrollView
      horizontal
      className="py-1"
      contentContainerStyle={{ paddingHorizontal: 2 }}
      showsHorizontalScrollIndicator={false}
    >
      {pendingFiles.map((file) => {
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
            key={file.id}
            onPress={() => handleCardPress(file.id)}
            style={{ width: CARD_SIZE, height: CARD_SIZE }}
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
                <FileTypeIcon
                  color={colors.iconMuted}
                  fileName={file.name}
                  fileType={file.type}
                  size={ICON_SIZE}
                />
              </View>
            )}

            {/* Status overlay */}
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
      })}
    </ScrollView>
  );
});

FilePreview.displayName = 'FilePreview';

export default FilePreview;
