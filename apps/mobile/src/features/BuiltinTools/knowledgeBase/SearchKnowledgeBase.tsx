/**
 * Knowledge Base SearchKnowledgeBase Render — RN version.
 * Displays file search results (fileName, relevanceScore) from pluginState or content.
 */
import { FileText } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface FileSearchResult {
  fileId?: string;
  fileName?: string;
  relevanceScore?: number;
}

function parseFileResults(content?: string, pluginState?: Record<string, unknown>): FileSearchResult[] {
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

const SearchKnowledgeBaseRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const colors = useThemeColors();
  const fileResults = useMemo(
    () => parseFileResults(content, pluginState),
    [content, pluginState],
  );

  if (fileResults.length === 0) return null;

  return (
    <View className="gap-2">
      {fileResults.map((file, index) => {
        const name = file.fileName || file.fileId || `File ${index + 1}`;
        const score = file.relevanceScore;
        return (
          <View
            key={file.fileId || index}
            style={{
              backgroundColor: colors.overlay,
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
            }}
          >
            <FileText color={colors.primary} size={16} strokeWidth={2} />
            <Text
              className="flex-1 text-[13px]"
              numberOfLines={1}
              style={{ color: colors.foreground }}
            >
              {name}
            </Text>
            {score !== undefined ? (
              <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                {(score * 100).toFixed(0)}%
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

SearchKnowledgeBaseRender.displayName = 'KnowledgeBaseSearchKnowledgeBaseRender';

export default SearchKnowledgeBaseRender;
