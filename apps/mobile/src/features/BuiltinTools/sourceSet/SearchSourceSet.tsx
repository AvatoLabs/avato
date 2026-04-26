/**
 * Source-set search render for React Native.
 * Displays file search results from pluginState or content.
 */
import { useRoute } from '@react-navigation/native';
import { FileText } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { haptics } from '../../../lib/haptics';
import { useI18n } from '../../../lib/i18n';
import { navigateToContent } from '../../../lib/navigation';
import {
  appendCurrentPortalStackWithOrigin,
  createConversationOrigin,
} from '../../../lib/portalNavigation';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface FileSearchResult {
  fileId?: string;
  fileName?: string;
  relevanceScore?: number;
  topChunks?: Array<{
    id?: string;
    similarity?: number;
    text?: string;
  }>;
}

function parseFileResults(
  content?: string,
  pluginState?: Record<string, unknown>,
): FileSearchResult[] {
  const fileResults = pluginState?.fileResults as FileSearchResult[] | undefined;
  if (Array.isArray(fileResults) && fileResults.length > 0) return fileResults;
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: { fileResults?: FileSearchResult[] } };
      const r = parsed.state?.fileResults;
      return Array.isArray(r) ? r : [];
    } catch {
      return [];
    }
  }
  return [];
}

const SearchSourceSetRender = memo<MobileBuiltinRenderProps>(
  ({ content, pluginState, sessionId, threadId, topicId }) => {
    const { t } = useI18n();
    const colors = useThemeColors();
    const route = useRoute();
    const fileResults = useMemo(
      () => parseFileResults(content, pluginState),
      [content, pluginState],
    );
    const conversationOrigin = createConversationOrigin({ sessionId, threadId, topicId });

    if (fileResults.length === 0) return null;

    return (
      <View className="gap-2">
        {fileResults.map((file, index) => {
          const name = file.fileName || file.fileId || `File ${index + 1}`;
          const score = file.relevanceScore;
          const excerpt = file.topChunks?.find((chunk) => chunk.text?.trim())?.text?.trim();
          return (
            <TouchableOpacity
              activeOpacity={file.fileId ? 0.75 : 1}
              disabled={!file.fileId}
              key={file.fileId || index}
              style={{
                backgroundColor: colors.overlay,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                padding: 12,
              }}
              onPress={() => {
                if (!file.fileId) return;

                haptics.light();
                navigateToContent(
                  appendCurrentPortalStackWithOrigin(
                    route.name,
                    route.params,
                    {
                      openItem: {
                        ...(excerpt ? { content: excerpt } : {}),
                        ...(excerpt ? { fileType: 'text/plain' } : {}),
                        id: file.fileId,
                        name,
                        sourceType: 'file' as const,
                      },
                    },
                    conversationOrigin,
                  ),
                );
              }}
            >
              <View className="flex-row items-center gap-2">
                <FileText color={colors.primary} size={16} strokeWidth={2} />
                <Text
                  className="flex-1 text-[13px]"
                  numberOfLines={1}
                  style={{ color: colors.foreground }}
                >
                  {name}
                </Text>
                {file.fileId ? (
                  <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                    {t.fileOpen}
                  </Text>
                ) : null}
                {score !== undefined ? (
                  <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                    {(score * 100).toFixed(0)}%
                  </Text>
                ) : null}
              </View>
              {excerpt ? (
                <Text
                  className="px-3 pb-3 text-[12px] leading-5"
                  numberOfLines={3}
                  style={{ color: colors.secondaryText }}
                >
                  {excerpt}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  },
);

SearchSourceSetRender.displayName = 'SourceSetSearchRender';

export default SearchSourceSetRender;
