/**
 * Source-set read-file render for React Native.
 * Displays retrieved source files with quick-open actions into Resources.
 */
import { useRoute } from '@react-navigation/native';
import { AlertTriangle, FileText } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { haptics } from '../../../lib/haptics';
import { useI18n } from '../../../lib/i18n';
import { navigateToResources } from '../../../lib/navigation';
import {
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
} from '../../../lib/portalNavigation';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface FileContentDetail {
  error?: string;
  fileId: string;
  filename: string;
  preview?: string;
  totalCharCount?: number;
  totalLineCount?: number;
}

function parseFiles(content?: string, pluginState?: Record<string, unknown>): FileContentDetail[] {
  const files = pluginState?.files as FileContentDetail[] | undefined;
  if (Array.isArray(files) && files.length > 0) return files;

  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: { files?: FileContentDetail[] } };
      const result = parsed.state?.files;
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  return [];
}

const ReadSourceFilesRender = memo<MobileBuiltinRenderProps>(
  ({ content, pluginState, sessionId, threadId, topicId }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const route = useRoute();
    const files = useMemo(() => parseFiles(content, pluginState), [content, pluginState]);
    const conversationOrigin = createConversationOrigin({ sessionId, threadId, topicId });

    if (files.length === 0) return null;

    return (
      <View className="gap-2">
        {files.map((file) => {
          const handleOpen = () => {
            haptics.light();
            navigateToResources(
              appendCurrentPortalStackWithOrigin(
                route.name,
                route.params,
                {
                  openItem: {
                    ...(file.preview ? { content: file.preview } : {}),
                    ...(file.preview ? { fileType: 'text/plain' } : {}),
                    id: file.fileId,
                    name: file.filename,
                    sourceType: 'file' as const,
                  },
                },
                conversationOrigin,
              ),
            );
          };

          return (
            <View
              className="rounded-xl border"
              key={file.fileId}
              style={{
                backgroundColor: colors.overlay,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-2 px-3 py-3">
                {file.error ? (
                  <AlertTriangle color={colors.danger} size={16} strokeWidth={2} />
                ) : (
                  <FileText color={colors.primary} size={16} strokeWidth={2} />
                )}
                <Text
                  className="flex-1 text-[13px] font-medium"
                  numberOfLines={1}
                  style={{ color: colors.foreground }}
                >
                  {file.filename}
                </Text>
                {!file.error ? (
                  <TouchableOpacity activeOpacity={0.7} onPress={handleOpen}>
                    <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                      {t.fileOpen}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {file.error ? (
                <Text className="px-3 pb-3 text-[12px]" style={{ color: colors.danger }}>
                  {file.error}
                </Text>
              ) : null}

              {file.preview ? (
                <Text
                  className="px-3 pb-3 text-[12px] leading-5"
                  numberOfLines={4}
                  style={{ color: colors.secondaryText }}
                >
                  {file.preview}
                </Text>
              ) : null}

              {!file.error &&
              (file.totalCharCount !== undefined || file.totalLineCount !== undefined) ? (
                <View
                  className="flex-row items-center justify-between px-3 py-2"
                  style={{ backgroundColor: colors.fillTertiary }}
                >
                  <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                    {`Chars ${file.totalCharCount?.toLocaleString() ?? '-'}`}
                  </Text>
                  <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                    {`Lines ${file.totalLineCount?.toLocaleString() ?? '-'}`}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  },
);

ReadSourceFilesRender.displayName = 'ReadSourceFilesRender';

export default ReadSourceFilesRender;
