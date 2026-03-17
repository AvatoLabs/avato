/**
 * FilePreview — Horizontal strip showing pending file attachments.
 */
import { X } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useFileStore } from '../../store/file';
import { tokens } from '../../theme/tokens';

interface FilePreviewProps {
  sessionId?: string;
}

const FilePreview = memo<FilePreviewProps>(({ sessionId }) => {
  const { t } = useI18n();
  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const removeFile = useFileStore((s) => s.removeFile);
  const uploadFile = useFileStore((s) => s.uploadFile);

  if (pendingFiles.length === 0) return null;

  return (
    <ScrollView horizontal className="py-1" showsHorizontalScrollIndicator={false}>
      {pendingFiles.map((file) => {
        const isImage = file.type.startsWith('image/');
        const cardBorderClass =
          file.status === 'error'
            ? 'border border-red-300'
            : file.status === 'done'
              ? 'border border-emerald-300'
              : 'border border-black/10';

        return (
          <View
            className={`w-16 h-16 mr-2 rounded-xl overflow-hidden bg-foreground/5 ${cardBorderClass}`}
            key={file.id}
          >
            {isImage ? (
              <Image className="w-full h-full" resizeMode="cover" source={{ uri: file.uri }} />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text
                  className="text-[10px] text-secondary/60 font-medium text-center px-1"
                  numberOfLines={2}
                >
                  {file.name}
                </Text>
              </View>
            )}

            {/* Status overlay */}
            {file.status === 'uploading' && (
              <View className="absolute inset-0 bg-black/40 items-center justify-center">
                <ActivityIndicator color="#fff" size="small" />
                <Text className="text-[9px] text-white/90 font-medium mt-1">
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
                <Text className="text-white text-[10px] font-semibold">{t.retry}</Text>
              </TouchableOpacity>
            )}

            {/* Remove button */}
            <TouchableOpacity
              className="absolute top-0 right-0 w-5 h-5 bg-black/60 rounded-full items-center justify-center"
              onPress={() => removeFile(file.id)}
            >
              <X color="#fff" size={10} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
});

FilePreview.displayName = 'FilePreview';

export default FilePreview;
