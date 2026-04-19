import { X } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { MobileGovernanceFilterState } from '../../lib/fileGovernance';
import { useThemeColors } from '../../theme/colors';
import { BottomSheetScaffold } from './BottomSheetScaffold';
import { FilterChip } from './ChoiceControls';

interface GovernanceToken {
  key: keyof MobileGovernanceFilterState;
  label: string;
  tone: 'accent' | 'neutral' | 'success';
}

interface GovernanceSection {
  key: 'assetReviewStatus' | 'assetUsagePolicy' | 'assetClassification';
  label: string;
  options: ReadonlyArray<{ label: string; value: string | undefined }>;
}

interface ResourceGovernanceSheetMessages {
  resourceGovernanceApply: string;
  resourceGovernanceClear: string;
  resourceGovernanceFilters: string;
  resourceGovernanceFiltersSubtitle: string;
  resourceGovernanceNoFilters: string;
  resourceGovernanceRightsOwnerPlaceholder: string;
  resourceGovernanceSectionRightsOwner: string;
  resourceGovernanceSelectedFilters: string;
}

interface ResourceGovernanceSheetProps {
  capabilityHint?: string;
  draftFilterCount: number;
  draftFilters: MobileGovernanceFilterState;
  draftTokens: GovernanceToken[];
  hasDraftChanges: boolean;
  messages: ResourceGovernanceSheetMessages;
  onApply: () => void;
  onClearDraft: () => void;
  onClose: () => void;
  onRemoveDraftFilter: (key: keyof MobileGovernanceFilterState) => void;
  onSetDraftFilters: React.Dispatch<React.SetStateAction<MobileGovernanceFilterState>>;
  sections: readonly GovernanceSection[];
  visible: boolean;
}

export default function ResourceGovernanceSheet({
  capabilityHint,
  draftFilterCount,
  draftFilters,
  draftTokens,
  hasDraftChanges,
  messages,
  sections,
  visible,
  onApply,
  onClearDraft,
  onClose,
  onRemoveDraftFilter,
  onSetDraftFilters,
}: ResourceGovernanceSheetProps) {
  const colors = useThemeColors();

  return (
    <BottomSheetScaffold
      description={messages.resourceGovernanceFiltersSubtitle}
      title={messages.resourceGovernanceFilters}
      visible={visible}
      onClose={onClose}
    >
      <View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-5">
            {capabilityHint ? (
              <View
                className="mb-4 rounded-3xl border px-4 py-3.5"
                style={{
                  backgroundColor: colors.fillQuaternary,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Text className="text-[12px] leading-5" style={{ color: colors.secondaryText }}>
                  {capabilityHint}
                </Text>
              </View>
            ) : null}

            <View
              className="mb-4 rounded-3xl border px-4 py-4"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderColor: colors.borderSubtle,
              }}
            >
              <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                    style={{ color: colors.secondaryText }}
                  >
                    {messages.resourceGovernanceSelectedFilters}
                  </Text>
                  <Text
                    className="mt-1 text-[14px] font-semibold"
                    style={{ color: colors.foreground }}
                  >
                    {draftFilterCount > 0
                      ? draftTokens.map((token) => token.label).join(' · ')
                      : messages.resourceGovernanceNoFilters}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor:
                      draftFilterCount > 0 ? colors.primaryMuted : colors.fillTertiary,
                  }}
                >
                  <Text
                    className="text-[11px] font-semibold"
                    style={{
                      color: draftFilterCount > 0 ? colors.primary : colors.secondaryText,
                    }}
                  >
                    {String(draftFilterCount)}
                  </Text>
                </View>
              </View>
              {draftTokens.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
                  {draftTokens.map((token) => (
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
                      onPress={() => onRemoveDraftFilter(token.key)}
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
                </View>
              ) : null}
            </View>

            {sections.map((section) => (
              <View
                className="mb-4 rounded-3xl border px-4 py-4"
                key={section.key}
                style={{
                  backgroundColor: colors.fillQuaternary,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Text className="text-[13px] font-semibold" style={{ color: colors.secondaryText }}>
                  {section.label}
                </Text>
                <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
                  {section.options.map((option) => {
                    const selected = draftFilters[section.key] === option.value;

                    return (
                      <FilterChip
                        active={selected}
                        key={`${section.key}:${option.value ?? 'all'}`}
                        label={option.label}
                        onPress={() =>
                          onSetDraftFilters((prev) => ({
                            ...prev,
                            [section.key]: option.value,
                          }))
                        }
                      />
                    );
                  })}
                </View>
              </View>
            ))}

            <View
              className="mb-4 rounded-3xl border px-4 py-4"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderColor: colors.borderSubtle,
              }}
            >
              <Text className="text-[13px] font-semibold" style={{ color: colors.secondaryText }}>
                {messages.resourceGovernanceSectionRightsOwner}
              </Text>
              <View
                className="mt-3 rounded-2xl border px-3.5 py-2.5"
                style={{ backgroundColor: colors.background, borderColor: colors.borderSubtle }}
              >
                <TextInput
                  autoCapitalize="words"
                  className="text-[15px] text-foreground"
                  placeholder={messages.resourceGovernanceRightsOwnerPlaceholder}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  value={draftFilters.assetRightsOwner ?? ''}
                  onChangeText={(text) =>
                    onSetDraftFilters((prev) => ({
                      ...prev,
                      assetRightsOwner: text,
                    }))
                  }
                />
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          className="flex-row px-5 pb-2 pt-3"
          style={{ borderColor: colors.borderSubtle, borderTopWidth: 1, gap: 12 }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.72}
            className="flex-1 items-center rounded-2xl px-5 py-3.5"
            disabled={draftFilterCount === 0}
            style={{
              backgroundColor: draftFilterCount > 0 ? colors.fillTertiary : colors.fillQuaternary,
            }}
            onPress={onClearDraft}
          >
            <Text
              className="text-[15px] font-semibold"
              style={{
                color: draftFilterCount > 0 ? colors.foreground : colors.secondaryText,
              }}
            >
              {messages.resourceGovernanceClear}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            className="flex-1 items-center rounded-2xl px-5 py-3.5"
            disabled={!hasDraftChanges}
            style={{
              backgroundColor: hasDraftChanges ? colors.primary : colors.fillQuaternary,
            }}
            onPress={onApply}
          >
            <Text
              className="text-[15px] font-semibold"
              style={{
                color: hasDraftChanges ? colors.iconOnPrimary : colors.secondaryText,
              }}
            >
              {messages.resourceGovernanceApply}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetScaffold>
  );
}
