import type { FileText, FolderOpen } from 'lucide-react-native';
import {
  ArrowLeft,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Grid3X3,
  House,
  List,
  Settings2,
  Users,
  X,
} from 'lucide-react-native';
import React from 'react';
import type {
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import type { FolderCrumb } from '../../lib/api';
import type { MobileGovernanceFilterState } from '../../lib/fileGovernance';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import { FilterChip, SegmentedControl } from './ChoiceControls';
import { SearchField } from './SearchField';

interface GovernanceToken {
  key: keyof MobileGovernanceFilterState;
  label: string;
  tone: 'accent' | 'neutral' | 'success';
}

interface GovernanceQuickFilter {
  key: 'assetReviewStatus' | 'assetUsagePolicy';
  label: string;
  value: 'approved' | 'draft' | 'internal' | 'public' | 'restricted';
}

interface ResourceTabItem {
  key: 'all' | 'documents' | 'images' | 'others';
  label: string;
}

interface ResourceContentHeaderChromeMessages {
  resourceCollapseAll: string;
  resourceExpandAll: string;
  resourceGovernanceAdvanced: string;
  resourceGovernanceClear: string;
  resourceGovernanceFilters: string;
  resourceGovernanceQuickHint: string;
  resourceSharedKindSourceSet: string;
  resourceViewModeToggle: string;
  search: string;
  workspaceManageSourceSet: string;
}

interface ResourceContentHeaderChromeProps {
  activeGovernanceFilterCount: number;
  breadcrumbLabelMaxWidth: number;
  category: 'all' | 'documents' | 'images' | 'others';
  chromeContainerStyle?: StyleProp<ViewStyle>;
  currentFolderId: string | null;
  currentSourceRootLabel: string;
  currentSourceSetName: string;
  currentSpaceKind?: 'personal' | 'team';
  currentSpaceMemoryShortcutLabel: string;
  currentSpaceName: string;
  currentTreePathLabel: string;
  filterTabs: ResourceTabItem[];
  folderBreadcrumb: FolderCrumb[];
  governanceActiveTokens: GovernanceToken[];
  governanceCapabilityHint?: string;
  governanceEnabled: boolean;
  governanceFilters: MobileGovernanceFilterState;
  governanceQuickFilters: readonly GovernanceQuickFilter[];
  governanceWorkbenchSummary: string;
  isSourceSetScope: boolean;
  messages: ResourceContentHeaderChromeMessages;
  onBackToRoot: () => void;
  onClearGovernanceFilters: () => void;
  onClearSearch: () => void;
  onCollapseAllTree: () => void;
  onExpandAllTree: () => void;
  onOpenCurrentSpaceMemory: () => void;
  onOpenGovernanceSheet: () => void;
  onOpenScopeLauncher: () => void;
  onOpenSourceSetManagement: () => void;
  onPressBreadcrumb: (item: FolderCrumb, index: number) => void;
  onRemoveGovernanceFilter: (key: keyof MobileGovernanceFilterState) => void;
  onSearchSubmit: () => void;
  onSelectCategory: (key: 'all' | 'documents' | 'images' | 'others') => void;
  onSetScopeMode: (value: 'files' | 'tree') => void;
  onSetSearchText: (value: string) => void;
  onToggleQuickGovernanceFilter: (
    key: 'assetReviewStatus' | 'assetUsagePolicy',
    value: 'approved' | 'draft' | 'internal' | 'public' | 'restricted',
  ) => void;
  onToggleViewMode: () => void;
  scopeMode: 'files' | 'tree';
  searchInputRef: React.RefObject<TextInput | null>;
  searchText: string;
  searchVisible: boolean;
  showContextCard: boolean;
  showCurrentSpaceMemoryShortcut: boolean;
  sourceSetId: string | null;
  sourceSetModeItems: Array<{
    icon: typeof FolderOpen | typeof FileText;
    label: string;
    value: 'files' | 'tree';
  }>;
  treeMode: boolean;
  viewMode: 'grid' | 'list';
}

export default function ResourceContentHeaderChrome({
  activeGovernanceFilterCount,
  breadcrumbLabelMaxWidth,
  category,
  chromeContainerStyle,
  currentFolderId,
  currentSourceRootLabel,
  currentSourceSetName,
  currentSpaceKind,
  currentSpaceMemoryShortcutLabel,
  currentSpaceName,
  currentTreePathLabel,
  filterTabs,
  folderBreadcrumb,
  governanceActiveTokens,
  governanceCapabilityHint,
  governanceEnabled,
  governanceFilters,
  governanceQuickFilters,
  governanceWorkbenchSummary,
  isSourceSetScope,
  messages,
  scopeMode,
  searchInputRef,
  searchText,
  searchVisible,
  showContextCard,
  showCurrentSpaceMemoryShortcut,
  sourceSetId,
  sourceSetModeItems,
  treeMode,
  viewMode,
  onBackToRoot,
  onClearGovernanceFilters,
  onClearSearch,
  onCollapseAllTree,
  onExpandAllTree,
  onOpenCurrentSpaceMemory,
  onOpenGovernanceSheet,
  onOpenScopeLauncher,
  onOpenSourceSetManagement,
  onPressBreadcrumb,
  onRemoveGovernanceFilter,
  onSearchSubmit,
  onSelectCategory,
  onSetScopeMode,
  onSetSearchText,
  onToggleQuickGovernanceFilter,
  onToggleViewMode,
}: ResourceContentHeaderChromeProps) {
  const colors = useThemeColors();

  return (
    <>
      {showContextCard ? (
        <View style={chromeContainerStyle}>
          <View
            className="mb-2 rounded-3xl border px-4 py-4"
            style={{
              backgroundColor: colors.fillQuaternary,
              borderColor: colors.borderSubtle,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.72}
              className="flex-row items-center"
              onPress={onOpenScopeLauncher}
            >
              <View
                className="items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: colors.primarySubtle,
                  height: 44,
                  width: 44,
                }}
              >
                {currentSpaceKind === 'personal' ? (
                  <House color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                ) : (
                  <Users color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                )}
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text
                  className="text-[11px] font-semibold uppercase tracking-[1px]"
                  numberOfLines={1}
                  style={{ color: colors.secondaryText }}
                >
                  {currentSpaceName}
                </Text>
                <Text className="mt-1 text-[16px] font-semibold text-foreground" numberOfLines={1}>
                  {currentSourceSetName}
                </Text>
                {sourceSetId && currentFolderId ? (
                  <Text
                    className="mt-1 text-[12px]"
                    numberOfLines={1}
                    style={{ color: colors.secondaryText }}
                  >
                    {currentTreePathLabel}
                  </Text>
                ) : null}
              </View>
              <ChevronDown color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>

            {sourceSetId ? (
              <View className="mt-3">
                <SegmentedControl
                  items={sourceSetModeItems}
                  value={scopeMode}
                  onChange={onSetScopeMode}
                />
              </View>
            ) : null}

            <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 8 }}>
              {sourceSetId ? (
                <TouchableOpacity
                  activeOpacity={0.72}
                  className="rounded-full px-3 py-2"
                  style={{ backgroundColor: colors.fillTertiary }}
                  onPress={onOpenSourceSetManagement}
                >
                  <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                    {messages.workspaceManageSourceSet}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {showCurrentSpaceMemoryShortcut ? (
                <TouchableOpacity
                  activeOpacity={0.78}
                  className="flex-row items-center rounded-full px-3 py-2"
                  style={{ backgroundColor: colors.primarySubtle }}
                  onPress={onOpenCurrentSpaceMemory}
                >
                  <BrainCircuit
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text
                    className="mx-2 text-[12px] font-semibold"
                    style={{ color: colors.primary }}
                  >
                    {currentSpaceMemoryShortcutLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {treeMode ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-3 py-2"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={onExpandAllTree}
                  >
                    <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                      {messages.resourceExpandAll}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-3 py-2"
                    style={{ backgroundColor: colors.fillTertiary }}
                    onPress={onCollapseAllTree}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: colors.secondaryText }}
                    >
                      {messages.resourceCollapseAll}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {folderBreadcrumb.length > 0 && !treeMode ? (
        <View style={chromeContainerStyle}>
          <ScrollView
            horizontal
            className="mb-2"
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            showsHorizontalScrollIndicator={false}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{ backgroundColor: colors.fillTertiary }}
              onPress={onBackToRoot}
            >
              <ArrowLeft color={colors.primary} size={14} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-1 text-[12px] font-medium" style={{ color: colors.primary }}>
                {currentSourceRootLabel}
              </Text>
            </TouchableOpacity>
            {folderBreadcrumb.map((crumb, index) => (
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center rounded-full px-3 py-1.5"
                key={crumb.id}
                style={{
                  backgroundColor:
                    index === folderBreadcrumb.length - 1 ? colors.primary : colors.fillTertiary,
                }}
                onPress={() => onPressBreadcrumb(crumb, index)}
              >
                <Text
                  className="text-[12px] font-medium"
                  numberOfLines={1}
                  style={{
                    color:
                      index === folderBreadcrumb.length - 1 ? colors.iconOnPrimary : colors.muted,
                    maxWidth: breadcrumbLabelMaxWidth,
                  }}
                >
                  {crumb.name}
                </Text>
                {index < folderBreadcrumb.length - 1 ? (
                  <ChevronRight
                    color={colors.muted}
                    size={14}
                    strokeWidth={tokens.icon.strokeWidth}
                    style={{ marginLeft: 4 }}
                  />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {searchVisible ? (
        <View style={chromeContainerStyle}>
          <SearchField
            accessibilityLabel={messages.search}
            containerClassName="mb-2"
            placeholder={messages.search}
            ref={searchInputRef}
            returnKeyType="search"
            size="compact"
            value={searchText}
            rightElement={
              <TouchableOpacity
                hitSlop={8}
                onPress={() => {
                  if (searchText.length > 0) {
                    onSetSearchText('');
                    return;
                  }

                  onClearSearch();
                }}
              >
                <X
                  color={colors.muted}
                  size={tokens.icon.size.sm}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
            }
            onChangeText={onSetSearchText}
            onSubmitEditing={onSearchSubmit}
          />
        </View>
      ) : null}

      <View style={chromeContainerStyle}>
        <View className="mb-2 flex-row items-center" style={{ gap: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingRight: 12,
            }}
          >
            {!isSourceSetScope
              ? filterTabs.map((tab) => (
                  <FilterChip
                    active={category === tab.key}
                    key={tab.key}
                    label={tab.label}
                    onPress={() => onSelectCategory(tab.key)}
                  />
                ))
              : null}
          </ScrollView>
          {!treeMode && scopeMode === 'files' ? (
            <TouchableOpacity
              accessibilityLabel={messages.resourceViewModeToggle}
              activeOpacity={0.72}
              className="h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: colors.fillTertiary,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
              }}
              onPress={onToggleViewMode}
            >
              {viewMode === 'list' ? (
                <Grid3X3 color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <List color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
        {governanceEnabled ? (
          <View
            className="mt-3 rounded-3xl border px-4 py-4"
            style={{
              backgroundColor: colors.fillQuaternary,
              borderColor: colors.borderSubtle,
            }}
          >
            <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
              <View className="min-w-0 flex-1 flex-row items-start">
                <View
                  className="mt-0.5 h-10 w-10 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor:
                      activeGovernanceFilterCount > 0 ? colors.primaryMuted : colors.fillTertiary,
                  }}
                >
                  <Settings2
                    color={activeGovernanceFilterCount > 0 ? colors.primary : colors.muted}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <View className="ml-3 min-w-0 flex-1">
                  <Text
                    className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                    style={{ color: colors.secondaryText }}
                  >
                    {messages.resourceGovernanceFilters}
                  </Text>
                  <Text
                    className="mt-1 text-[14px] font-semibold"
                    numberOfLines={2}
                    style={{ color: colors.foreground }}
                  >
                    {activeGovernanceFilterCount > 0
                      ? governanceWorkbenchSummary
                      : messages.resourceGovernanceQuickHint}
                  </Text>
                  {activeGovernanceFilterCount === 0 && governanceCapabilityHint ? (
                    <Text
                      className="mt-1 text-[12px] leading-5"
                      style={{ color: colors.secondaryText }}
                    >
                      {governanceCapabilityHint}
                    </Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.72}
                className="rounded-full px-3 py-2"
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={onOpenGovernanceSheet}
              >
                <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                  {messages.resourceGovernanceAdvanced}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              className="mt-3"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingRight: 12,
              }}
            >
              {governanceQuickFilters.map((option) => (
                <FilterChip
                  active={governanceFilters[option.key] === option.value}
                  key={`${option.key}:${option.value}`}
                  label={option.label}
                  onPress={() => onToggleQuickGovernanceFilter(option.key, option.value)}
                />
              ))}
            </ScrollView>

            {governanceActiveTokens.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
                {governanceActiveTokens.map((token) => (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className="flex-row items-center rounded-full pl-3 pr-2 py-2"
                    key={token.key}
                    style={{
                      backgroundColor:
                        token.tone === 'success'
                          ? colors.successMuted
                          : token.tone === 'accent'
                            ? colors.primaryMuted
                            : colors.fillTertiary,
                    }}
                    onPress={() => onRemoveGovernanceFilter(token.key)}
                  >
                    <Text
                      className="mr-1.5 text-[12px] font-semibold"
                      style={{
                        color:
                          token.tone === 'success'
                            ? colors.success
                            : token.tone === 'accent'
                              ? colors.primary
                              : colors.foreground,
                      }}
                    >
                      {token.label}
                    </Text>
                    <X
                      size={12}
                      strokeWidth={2.2}
                      color={
                        token.tone === 'success'
                          ? colors.success
                          : token.tone === 'accent'
                            ? colors.primary
                            : colors.secondaryText
                      }
                    />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  activeOpacity={0.72}
                  className="rounded-full px-3 py-2"
                  style={{ backgroundColor: colors.fillTertiary }}
                  onPress={onClearGovernanceFilters}
                >
                  <Text
                    className="text-[12px] font-semibold"
                    style={{ color: colors.secondaryText }}
                  >
                    {messages.resourceGovernanceClear}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}
