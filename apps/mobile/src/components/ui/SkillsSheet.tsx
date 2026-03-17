/**
 * SkillsSheet — Shared skill/plugin picker with proper scroll support.
 *
 * Fixes:
 * - Scroll: Use FlatList instead of ScrollView inside Pressable; avoid touch conflicts
 * - Data: Renders builtins + agent skills + installed plugins from API
 */
import { FlashList } from '@shopify/flash-list';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { semanticColors } from '../../constants/colors';
import type { MobileRecommendedBuiltinIcon } from '../../constants/recommendedBuiltins';
import { themeColors } from '../../theme/colors';
import type { AgentSkillItem, InstalledPlugin } from '../../types';
import { BuiltinSkillIcon } from './BuiltinSkillIcon';

export type SkillSheetItem =
  | {
      type: 'builtin';
      description: string;
      icon: MobileRecommendedBuiltinIcon;
      identifier: string;
      title: string;
    }
  | { type: 'skill'; skill: AgentSkillItem }
  | { type: 'plugin'; plugin: InstalledPlugin };

export interface SkillsSheetProps {
  agentConfigOpenStore?: string;
  agentSkillItems: AgentSkillItem[];
  builtinItems: {
    description: string;
    icon: MobileRecommendedBuiltinIcon;
    identifier: string;
    title: string;
  }[];
  enabledIdentifiers: Set<string>;
  installedPlugins: InstalledPlugin[];
  loading: boolean;
  onClose: () => void;
  onOpenStore?: () => void;
  onToggle: (identifier: string) => void;
  skillsEmpty: string;
  skillsEmptyDesc: string;
  skillsTitle: string;
  visible: boolean;
}

function buildItems(
  builtinItems: SkillsSheetProps['builtinItems'],
  agentSkillItems: AgentSkillItem[],
  installedPlugins: InstalledPlugin[],
): SkillSheetItem[] {
  const items: SkillSheetItem[] = [];
  for (const b of builtinItems) {
    items.push({ type: 'builtin', ...b });
  }
  for (const s of agentSkillItems) {
    items.push({ type: 'skill', skill: s });
  }
  for (const p of installedPlugins) {
    items.push({ type: 'plugin', plugin: p });
  }
  return items;
}

export default function SkillsSheet({
  visible,
  onClose,
  loading,
  builtinItems,
  agentSkillItems,
  installedPlugins,
  enabledIdentifiers,
  onToggle,
  onOpenStore,
  skillsTitle,
  skillsEmpty,
  skillsEmptyDesc,
  agentConfigOpenStore,
}: SkillsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const items = buildItems(builtinItems, agentSkillItems, installedPlugins);
  const showStoreHint =
    agentSkillItems.length === 0 && installedPlugins.length === 0 && builtinItems.length > 0;

  const renderItem = ({ item }: { item: SkillSheetItem }) => {
    if (item.type === 'builtin') {
      return (
        <View className="flex-row items-center py-3.5" key={`builtin-${item.identifier}`}>
          <BuiltinSkillIcon icon={item.icon} size={36} />
          <View className="ml-3 mr-3 flex-1">
            <Text
              className="text-foreground text-[15px] font-medium tracking-tight"
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.description ? (
              <Text className="text-secondary/50 mt-0.5 text-[12px]" numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <Switch
            value={enabledIdentifiers.has(item.identifier)}
            trackColor={{
              false: themeColors.switchTrackOff,
              true: themeColors.switchTrackOn,
            }}
            onValueChange={() => onToggle(item.identifier)}
          />
        </View>
      );
    }
    if (item.type === 'skill') {
      const id = item.skill.identifier ?? item.skill.id;
      return (
        <View className="flex-row items-center py-3.5" key={`skill-${item.skill.id}`}>
          <View className="mr-3 flex-1">
            <Text
              className="text-foreground text-[15px] font-medium tracking-tight"
              numberOfLines={1}
            >
              {item.skill.name || item.skill.identifier || item.skill.id}
            </Text>
            {item.skill.description ? (
              <Text className="text-secondary/50 mt-0.5 text-[12px]" numberOfLines={1}>
                {item.skill.description}
              </Text>
            ) : null}
          </View>
          <Switch
            value={enabledIdentifiers.has(id)}
            trackColor={{
              false: themeColors.switchTrackOff,
              true: themeColors.switchTrackOn,
            }}
            onValueChange={() => onToggle(id)}
          />
        </View>
      );
    }
    const plugin = item.plugin;
    return (
      <View className="flex-row items-center py-3.5" key={plugin.identifier}>
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-foreground/5">
          <Text className="text-[18px]">{plugin.manifest?.meta?.avatar ?? '🔌'}</Text>
        </View>
        <View className="mr-3 flex-1">
          <Text
            className="text-foreground text-[15px] font-medium tracking-tight"
            numberOfLines={1}
          >
            {plugin.manifest?.meta?.title || plugin.identifier}
          </Text>
          {plugin.manifest?.meta?.description ? (
            <Text className="text-secondary/50 mt-0.5 text-[12px]" numberOfLines={1}>
              {plugin.manifest.meta.description}
            </Text>
          ) : null}
        </View>
        <Switch
          value={enabledIdentifiers.has(plugin.identifier)}
          trackColor={{
            false: themeColors.switchTrackOff,
            true: themeColors.switchTrackOn,
          }}
          onValueChange={() => onToggle(plugin.identifier)}
        />
      </View>
    );
  };

  const listContent = () => {
    if (loading) {
      return (
        <View className="items-center py-10">
          <ActivityIndicator color={semanticColors.primary} size="small" />
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View className="items-center py-10">
          <Text className="text-secondary/50 px-4 text-center text-[14px]">{skillsEmpty}</Text>
          <Text className="text-secondary/40 mt-1 text-center text-[12px]">{skillsEmptyDesc}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        {/* Content card: View (not Pressable) so scroll gestures work inside */}
        <View className="rounded-t-2xl bg-card" style={{ maxHeight: windowHeight * 0.75 }}>
          <View className="items-center pt-3 pb-1">
            <View className="h-1 w-9 rounded-full bg-foreground/10" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
            <Text className="text-foreground text-[18px] font-bold tracking-tight">
              {skillsTitle}
            </Text>
          </View>
          {/* Fixed-height scroll area: FlatList for reliable scroll */}
          <View style={{ height: Math.min(windowHeight * 0.55, 400) }}>
            {loading || items.length === 0 ? (
              listContent()
            ) : (
              <FlashList
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                data={items}
                estimatedItemSize={64}
                renderItem={renderItem}
                keyExtractor={(item) =>
                  item.type === 'builtin'
                    ? `builtin-${item.identifier}`
                    : item.type === 'skill'
                      ? `skill-${item.skill.id}`
                      : `plugin-${item.plugin.identifier}`
                }
              />
            )}
          </View>
          {showStoreHint && agentConfigOpenStore && onOpenStore ? (
            <TouchableOpacity
              className="mx-5 mb-4 mt-2 items-center rounded-xl bg-foreground/5 py-3"
              onPress={() => {
                onClose();
                onOpenStore();
              }}
            >
              <Text className="text-[14px] font-medium" style={{ color: semanticColors.primary }}>
                {agentConfigOpenStore}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
