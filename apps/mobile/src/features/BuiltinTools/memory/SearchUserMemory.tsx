/**
 * Memory SearchUserMemory Render — RN version.
 * Displays search results (contexts, experiences, preferences) from pluginState.
 */
import { Search } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../../lib/i18n';
import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface MemoryItem {
  id?: string;
  title?: string;
  content?: string;
  description?: string;
  situation?: string;
  action?: string;
  keyLearning?: string;
  conclusionDirectives?: string;
  suggestions?: string;
  currentStatus?: string;
  tags?: string[];
}

function parseSearchResult(content?: string, pluginState?: Record<string, unknown>) {
  const contexts = (pluginState?.contexts || []) as MemoryItem[];
  const experiences = (pluginState?.experiences || []) as MemoryItem[];
  const preferences = (pluginState?.preferences || []) as MemoryItem[];
  if (contexts.length || experiences.length || preferences.length) {
    return { contexts, experiences, preferences };
  }
  if (content) {
    try {
      const parsed = JSON.parse(content) as {
        state?: { contexts?: MemoryItem[]; experiences?: MemoryItem[]; preferences?: MemoryItem[] };
      };
      const s = parsed.state;
      return {
        contexts: s?.contexts ?? [],
        experiences: s?.experiences ?? [],
        preferences: s?.preferences ?? [],
      };
    } catch {
      return { contexts: [], experiences: [], preferences: [] };
    }
  }
  return { contexts: [], experiences: [], preferences: [] };
}

function MemoryItemRow({
  title,
  content,
  subContent,
  colors,
}: {
  title?: string;
  content?: string;
  subContent?: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  if (!title && !content && !subContent) return null;
  return (
    <View
      className="py-2.5 px-3"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' }}
    >
      {title ? (
        <Text className="text-[13px] font-medium mb-0.5" style={{ color: colors.foreground }}>
          {title}
        </Text>
      ) : null}
      {content ? (
        <Text className="text-[12px]" numberOfLines={2} style={{ color: colors.secondaryText }}>
          {content}
        </Text>
      ) : null}
      {subContent ? (
        <Text className="text-[11px] mt-0.5 italic" numberOfLines={1} style={{ color: colors.tertiaryText }}>
          {subContent}
        </Text>
      ) : null}
    </View>
  );
}

const SearchUserMemoryRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { contexts, experiences, preferences } = useMemo(
    () => parseSearchResult(content, pluginState),
    [content, pluginState],
  );

  const total = contexts.length + experiences.length + preferences.length;
  if (total === 0) {
    return (
      <View
        className="rounded-xl border p-4"
        style={{ backgroundColor: colors.background, borderColor: colors.border }}
      >
        <Text className="text-center text-[12px]" style={{ color: colors.tertiaryText }}>
          {t.chatToolResponse || 'No results'}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: colors.background, borderColor: colors.border }}
    >
      <View className="flex-row items-center gap-2 px-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Search color={colors.primary} size={14} strokeWidth={2} />
        <Text className="text-[12px] font-medium" style={{ color: colors.secondaryText }}>
          {total} {t.chatToolResponse || 'results'}
        </Text>
      </View>
      {contexts.length > 0 ? (
        <View className="py-1">
          <Text className="px-3 py-1 text-[11px] font-medium uppercase" style={{ color: colors.tertiaryText }}>
            Contexts ({contexts.length})
          </Text>
          {contexts.map((item, i) => (
            <MemoryItemRow
              key={item.id || i}
              colors={colors}
              content={item.description}
              subContent={item.currentStatus}
              title={item.title}
            />
          ))}
        </View>
      ) : null}
      {experiences.length > 0 ? (
        <View className="py-1">
          <Text className="px-3 py-1 text-[11px] font-medium uppercase" style={{ color: colors.tertiaryText }}>
            Experiences ({experiences.length})
          </Text>
          {experiences.map((item, i) => (
            <MemoryItemRow
              key={item.id || i}
              colors={colors}
              content={item.situation}
              subContent={item.keyLearning}
              title={item.action}
            />
          ))}
        </View>
      ) : null}
      {preferences.length > 0 ? (
        <View className="py-1">
          <Text className="px-3 py-1 text-[11px] font-medium uppercase" style={{ color: colors.tertiaryText }}>
            Preferences ({preferences.length})
          </Text>
          {preferences.map((item, i) => (
            <MemoryItemRow
              key={item.id || i}
              colors={colors}
              content={item.conclusionDirectives}
              subContent={item.suggestions}
              title={item.title}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

SearchUserMemoryRender.displayName = 'MemorySearchUserMemoryRender';

export default SearchUserMemoryRender;
