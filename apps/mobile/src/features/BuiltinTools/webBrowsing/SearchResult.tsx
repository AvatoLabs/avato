/**
 * Web Browsing Search Render — RN version.
 * Displays search results (title, url) from pluginState or content.
 */
import { Globe } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface SearchResultItem {
  title?: string;
  url?: string;
  content?: string;
}

function parseSearchResults(content?: string, pluginState?: Record<string, unknown>): SearchResultItem[] {
  const results = pluginState?.results as SearchResultItem[] | undefined;
  if (Array.isArray(results) && results.length > 0) return results;
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: { results?: SearchResultItem[] } };
      const r = parsed.state?.results;
      return Array.isArray(r) ? r : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

const SearchResultRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const colors = useThemeColors();
  const results = useMemo(() => parseSearchResults(content, pluginState), [content, pluginState]);

  if (results.length === 0) return null;

  return (
    <View className="gap-2">
      {results.slice(0, 8).map((item, index) => {
        const url = item.url || '';
        const title = item.title || url || `Result ${index + 1}`;
        if (!url) return null;
        return (
          <TouchableOpacity
            key={`${url}-${index}`}
            activeOpacity={0.7}
            onPress={() => Linking.openURL(url)}
            style={{
              backgroundColor: colors.overlay,
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <Globe color={colors.primary} size={14} strokeWidth={2} />
              <Text
                className="flex-1 text-[12px]"
                numberOfLines={2}
                style={{ color: colors.foreground }}
              >
                {title}
              </Text>
            </View>
            <Text
              className="text-[11px]"
              numberOfLines={1}
              style={{ color: colors.tertiaryText }}
            >
              {getHost(url)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

SearchResultRender.displayName = 'WebBrowsingSearchResultRender';

export default SearchResultRender;
