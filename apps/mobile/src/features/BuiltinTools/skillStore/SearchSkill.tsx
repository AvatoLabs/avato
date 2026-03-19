/**
 * Skill Store / Skills SearchSkill Render — RN version.
 * Displays skill search results (name, identifier, description, installCount) from pluginState or content.
 * Shared by lobe-skill-store and lobe-skills (both use searchSkill).
 */
import { Package } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

interface MarketSkillItem {
  category?: string;
  description?: string;
  identifier: string;
  installCount?: number;
  name: string;
  repository?: string;
  summary?: string;
  version?: string;
}

interface SearchSkillState {
  items?: MarketSkillItem[];
  page?: number;
  pageSize?: number;
  total?: number;
}

function parseSearchResults(
  content?: string,
  pluginState?: Record<string, unknown>,
): MarketSkillItem[] {
  const items = pluginState?.items as MarketSkillItem[] | undefined;
  if (Array.isArray(items) && items.length > 0) return items;
  if (content) {
    try {
      const parsed = JSON.parse(content) as { state?: SearchSkillState };
      const r = parsed.state?.items;
      return Array.isArray(r) ? r : [];
    } catch {
      return [];
    }
  }
  return [];
}

const SearchSkillRender = memo<MobileBuiltinRenderProps>(({ content, pluginState }) => {
  const colors = useThemeColors();
  const items = useMemo(
    () => parseSearchResults(content, pluginState),
    [content, pluginState],
  );

  if (items.length === 0) return null;

  return (
    <View className="gap-2">
      {items.slice(0, 8).map((skill) => (
        <View
          key={skill.identifier}
          style={{
            backgroundColor: colors.overlay,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 12,
          }}
        >
          <View className="mb-2 flex-row items-center gap-2">
            <Package color={colors.primary} size={16} strokeWidth={2} />
            <Text
              className="flex-1 text-[14px] font-medium"
              numberOfLines={1}
              style={{ color: colors.foreground }}
            >
              {skill.name}
            </Text>
          </View>
          <Text
            className="mb-1 text-[12px]"
            numberOfLines={1}
            style={{ color: colors.tertiaryText }}
          >
            {skill.identifier}
          </Text>
          {(skill.summary || skill.description) && (
            <Text
              className="text-[11px]"
              numberOfLines={2}
              style={{ color: colors.secondaryText }}
            >
              {skill.summary || skill.description}
            </Text>
          )}
          <View className="mt-2 flex-row flex-wrap gap-2">
            {skill.installCount !== undefined && (
              <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                {skill.installCount} installs
              </Text>
            )}
            {skill.version && (
              <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                v{skill.version}
              </Text>
            )}
            {skill.category && (
              <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                {skill.category}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
});

SearchSkillRender.displayName = 'SkillStoreSearchSkillRender';

export default SearchSkillRender;
