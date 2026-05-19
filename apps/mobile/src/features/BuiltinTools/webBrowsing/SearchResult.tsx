/**
 * Web Browsing Search Render — RN version.
 * Displays search results (title, url) from pluginState or content.
 */
import { Globe } from 'lucide-react-native';
import React, { memo, useCallback, useMemo } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import { useToast } from '../../../components/ui/Toast';
import { useI18n } from '../../../lib/i18n';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface SearchResultItem {
  content?: string;
  title?: string;
  url?: string;
}

function parseSearchResults(
  content?: string,
  pluginState?: Record<string, unknown>,
): SearchResultItem[] {
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
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const results = useMemo(() => parseSearchResults(content, pluginState), [content, pluginState]);
  const handleOpenUrl = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch {
        toast.show('error', t.errorNetwork);
      }
    },
    [t.errorNetwork, toast],
  );

  if (results.length === 0) return null;

  return (
    <View className="gap-2">
      {results.slice(0, 8).map((item, index) => {
        const url = item.url || '';
        const title = item.title || url || `Result ${index + 1}`;
        if (!url) return null;
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            key={`${url}-${index}`}
            style={{
              backgroundColor: colors.overlay,
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              padding: 12,
            }}
            onPress={() => void handleOpenUrl(url)}
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
            <Text className="text-[11px]" numberOfLines={1} style={{ color: colors.tertiaryText }}>
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
