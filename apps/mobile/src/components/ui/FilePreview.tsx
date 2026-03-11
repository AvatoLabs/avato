/**
 * FilePreview — Horizontal strip showing pending file attachments.
 */
import { X } from 'lucide-react-native';
import React, { memo } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useFileStore } from '../../store/file';
import { tokens } from '../../theme/tokens';

const FilePreview = memo(() => {
  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const removeFile = useFileStore((s) => s.removeFile);

  if (pendingFiles.length === 0) return null;

  return (
    <ScrollView horizontal className="px-3 py-2" showsHorizontalScrollIndicator={false}>
      {pendingFiles.map((file) => {
        const isImage = file.type.startsWith('image/');
        return (
          <View
            className="w-16 h-16 mr-2 rounded-xl overflow-hidden bg-foreground/5 dark:bg-white/5"
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
              </View>
            )}
            {file.status === 'error' && (
              <View className="absolute inset-0 bg-red-500/30 items-center justify-center">
                <Text className="text-white text-[10px] font-bold">!</Text>
              </View>
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
