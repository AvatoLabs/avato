import {
  BrainCircuit,
  Check,
  ChevronRight,
  FolderOpen,
  House,
  Link2,
  Trash2,
  Users,
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { MobileSpaceItem, SourceSetItem } from '../../types';
import AdaptiveSheetModal from './AdaptiveSheetModal';
import { FilterChip, SegmentedControl } from './ChoiceControls';

export interface ResourceScopeLauncherGroup {
  items: SourceSetItem[];
  label: string;
  spaceId: string | null;
}

interface ResourceScopeLauncherSheetProps {
  activeSpaceId: string | null;
  currentSpaceName: string;
  groups: ResourceScopeLauncherGroup[];
  isAllFilesScope: boolean;
  isUnassignedScope: boolean;
  onChangeTab: (tab: 'spaces' | 'sources') => void;
  onClose: () => void;
  onCreateSourceSet: () => void;
  onCreateSpace: () => void;
  onOpenSharedWithMe: () => void;
  onOpenSpaceMemory?: () => void;
  onOpenTrash: () => void;
  onSelectAllFiles: () => void;
  onSelectSourceSet: (item: SourceSetItem) => void;
  onSelectSpace: (spaceId: string) => void;
  onSelectUnassigned: () => void;
  pendingSourceSetSelectionId: string | null;
  selectedSourceSetId: string | null;
  selectedTab: 'spaces' | 'sources';
  showSpaceMemoryShortcut: boolean;
  spaces: MobileSpaceItem[];
  visible: boolean;
  workspaceTrashLabel: string;
}

export default function ResourceScopeLauncherSheet({
  activeSpaceId,
  currentSpaceName,
  groups,
  isAllFilesScope,
  isUnassignedScope,
  pendingSourceSetSelectionId,
  selectedSourceSetId,
  selectedTab,
  showSpaceMemoryShortcut,
  spaces,
  visible,
  workspaceTrashLabel,
  onChangeTab,
  onClose,
  onCreateSourceSet,
  onCreateSpace,
  onOpenSharedWithMe,
  onOpenSpaceMemory,
  onOpenTrash,
  onSelectAllFiles,
  onSelectSourceSet,
  onSelectSpace,
  onSelectUnassigned,
}: ResourceScopeLauncherSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { height: screenHeight } = useWindowDimensions();

  const tabItems = useMemo(
    () => [
      { icon: Users, label: t.workspaceSwitchSpaces, value: 'spaces' as const },
      { icon: FolderOpen, label: t.workspaceSwitchSourceSets, value: 'sources' as const },
    ],
    [t.workspaceSwitchSourceSets, t.workspaceSwitchSpaces],
  );

  return (
    <AdaptiveSheetModal maxHeight="78%" preferredWidth={720} visible={visible} onClose={onClose}>
      <View className="items-center pt-3 pb-2">
        <View className="h-1 w-9 rounded-full bg-foreground/10" />
      </View>
      <View className="px-5">
        <Text className="text-[18px] font-bold text-foreground">{t.workspaceTitle}</Text>

        <View className="mt-4">
          <Text
            className="text-[12px] font-semibold uppercase tracking-[1px]"
            style={{ color: colors.tertiaryText }}
          >
            {t.workspaceQuickAccessTitle}
          </Text>
          <View className="mt-2" style={{ gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.72}
              className="flex-row items-center rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.fillTertiary }}
              onPress={onOpenSharedWithMe}
            >
              <Link2 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 flex-1 text-[16px] font-medium text-foreground">
                {t.resourceSharedWithMe}
              </Text>
              <ChevronRight color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
            {showSpaceMemoryShortcut && onOpenSpaceMemory ? (
              <TouchableOpacity
                activeOpacity={0.72}
                className="flex-row items-center rounded-xl px-4 py-3"
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={onOpenSpaceMemory}
              >
                <BrainCircuit
                  color={colors.primary}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-3 flex-1 text-[16px] font-medium text-foreground">
                  {t.memorySpaceBrowse}
                </Text>
                <ChevronRight
                  color={colors.muted}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.72}
              className="flex-row items-center rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.fillTertiary }}
              onPress={onOpenTrash}
            >
              <Trash2 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              <Text
                className="ml-3 flex-1 text-[16px] font-medium text-foreground"
                numberOfLines={1}
              >
                {workspaceTrashLabel}
              </Text>
              <ChevronRight color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-4">
          <SegmentedControl items={tabItems} value={selectedTab} onChange={onChangeTab} />
        </View>
      </View>

      <ScrollView className="mt-3" style={{ maxHeight: Math.max(screenHeight * 0.5, 420) }}>
        {selectedTab === 'spaces' ? (
          <>
            <View className="flex-row items-center justify-between px-5 pb-1">
              <Text
                className="text-[12px] font-semibold uppercase tracking-[1px]"
                style={{ color: colors.tertiaryText }}
              >
                {t.workspaceSwitchSpaces}
              </Text>
              <TouchableOpacity
                activeOpacity={0.78}
                className="rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primarySubtle }}
                onPress={onCreateSpace}
              >
                <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                  {t.workspaceCreateTitle}
                </Text>
              </TouchableOpacity>
            </View>
            {spaces.map((space) => {
              const active = activeSpaceId === space.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                  key={space.id}
                  style={{
                    backgroundColor: active ? colors.primaryMuted : colors.fillTertiary,
                    borderColor: active ? colors.primaryBorder : 'transparent',
                    borderWidth: 1,
                  }}
                  onPress={() => onSelectSpace(space.id)}
                >
                  {space.kind === 'personal' ? (
                    <House
                      color={active ? colors.primary : colors.muted}
                      size={22}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  ) : (
                    <Users
                      color={active ? colors.primary : colors.muted}
                      size={22}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  )}
                  <View className="ml-3 min-w-0 flex-1">
                    <Text
                      className="text-[16px] font-medium"
                      numberOfLines={1}
                      style={{ color: active ? colors.primary : colors.foreground }}
                    >
                      {space.name}
                    </Text>
                    {space.description ? (
                      <Text
                        className="mt-0.5 text-[12px]"
                        numberOfLines={2}
                        style={{ color: colors.secondaryText }}
                      >
                        {space.description}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <>
            <View className="flex-row items-center justify-between px-5 pb-1" style={{ gap: 12 }}>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[12px] font-semibold uppercase tracking-[1px]"
                  style={{ color: colors.tertiaryText }}
                >
                  {t.workspaceSwitchSourceSets}
                </Text>
                <Text
                  className="mt-1 text-[12px]"
                  numberOfLines={1}
                  style={{ color: colors.secondaryText }}
                >
                  {currentSpaceName}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.78}
                className="rounded-full px-3 py-2"
                style={{ backgroundColor: colors.primarySubtle }}
                onPress={onCreateSourceSet}
              >
                <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                  {t.resourceCreateSourceSet}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              className="mt-1"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: 8,
                paddingHorizontal: 20,
                paddingRight: 32,
              }}
            >
              <FilterChip
                active={isAllFilesScope}
                label={t.resourceAllFiles}
                onPress={onSelectAllFiles}
              />
              <FilterChip
                active={isUnassignedScope}
                label={t.resourceSourceSetUnassigned}
                onPress={onSelectUnassigned}
              />
            </ScrollView>

            {groups.map((group) => (
              <View className="pt-3" key={group.spaceId ?? '__no_space__'}>
                <View className="px-5 pb-1">
                  <Text
                    className="text-[12px] font-semibold"
                    numberOfLines={1}
                    style={{ color: colors.secondaryText }}
                  >
                    {group.label}
                  </Text>
                </View>
                {group.items.map((sourceSet) => {
                  const active = selectedSourceSetId === sourceSet.id;
                  const pending = pendingSourceSetSelectionId === sourceSet.id;
                  const hasPendingSwitch = pendingSourceSetSelectionId !== null;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
                      disabled={hasPendingSwitch && !pending}
                      key={sourceSet.id}
                      style={{
                        backgroundColor:
                          pending || active ? colors.primaryMuted : colors.fillTertiary,
                        borderColor: pending || active ? colors.primaryBorder : 'transparent',
                        borderWidth: 1,
                        opacity: hasPendingSwitch && !pending ? 0.5 : 1,
                      }}
                      onPress={() => onSelectSourceSet(sourceSet)}
                    >
                      <FolderOpen
                        color={pending || active ? colors.primary : colors.muted}
                        size={22}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                      <View className="ml-3 min-w-0 flex-1">
                        <Text
                          className="text-[16px] font-medium"
                          numberOfLines={1}
                          style={{ color: pending || active ? colors.primary : colors.foreground }}
                        >
                          {sourceSet.name}
                        </Text>
                        {pending ? (
                          <Text
                            className="mt-0.5 text-[12px]"
                            numberOfLines={1}
                            style={{ color: colors.secondaryText }}
                          >
                            {group.label}
                          </Text>
                        ) : null}
                      </View>
                      {pending ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : active ? (
                        <Check
                          color={colors.primary}
                          size={18}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </AdaptiveSheetModal>
  );
}
