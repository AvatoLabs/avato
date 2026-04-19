import { ChevronRight } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { agentApi, type AgentQueryItem } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useModelStore } from '../../store/model';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import { BottomSheetScaffold } from './BottomSheetScaffold';
import { ModelDrawer } from './ModelDrawer';
import { SearchField } from './SearchField';
import { SelectionListItem } from './SelectionList';

const EMPTY_AGENT_IDS: string[] = [];

export interface AgentSelectionSheetSubmitPayload {
  agentIds: string[];
  supervisorConfig?: { model?: string; provider?: string };
  title: string;
}

export interface AgentSelectionSheetProps {
  allowEmptySelection?: boolean;
  confirmLabel: string;
  excludedAgentIds?: string[];
  initialSelectedAgentIds?: string[];
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (payload: AgentSelectionSheetSubmitPayload) => Promise<void>;
  showSupervisorModelPicker?: boolean;
  showTitleInput?: boolean;
  title: string;
  titleInputLabel?: string;
  titleInputPlaceholder?: string;
  visible: boolean;
}

function AgentAvatar({ agent }: { agent: AgentQueryItem }) {
  const colors = useThemeColors();
  const avatar = agent.avatar?.trim();

  if (avatar && avatar.length <= 4 && !avatar.startsWith('http')) {
    return (
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: colors.primarySubtle }}
      >
        <Text className="text-[18px]" style={{ color: colors.foreground }}>
          {avatar}
        </Text>
      </View>
    );
  }

  const fallback = agent.title?.trim()?.slice(0, 1)?.toUpperCase() || '#';

  return (
    <View
      className="h-11 w-11 items-center justify-center rounded-2xl"
      style={{ backgroundColor: colors.primarySubtle }}
    >
      <Text className="text-[16px] font-semibold" style={{ color: colors.primary }}>
        {fallback}
      </Text>
    </View>
  );
}

export default function AgentSelectionSheet({
  allowEmptySelection = false,
  confirmLabel,
  excludedAgentIds = EMPTY_AGENT_IDS,
  initialSelectedAgentIds = EMPTY_AGENT_IDS,
  initialTitle = '',
  onClose,
  onSubmit,
  showSupervisorModelPicker = false,
  showTitleInput = false,
  title,
  titleInputLabel,
  titleInputPlaceholder,
  visible,
}: AgentSelectionSheetProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [agents, setAgents] = useState<AgentQueryItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedAgentIds),
  );
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [supervisorModel, setSupervisorModel] = useState<string>('');
  const [supervisorProvider, setSupervisorProvider] = useState<string>('');
  const [supervisorModelDrawerVisible, setSupervisorModelDrawerVisible] = useState(false);

  const providers = useModelStore((s) => s.providers);
  const supervisorModelLabel = useMemo(() => {
    if (!supervisorModel || !supervisorProvider) return t.modelPickerTitle;
    const provider = providers.find((p) => p.id === supervisorProvider);
    const model = provider?.children.find((m) => m.id === supervisorModel);
    return model?.displayName || supervisorModel;
  }, [providers, supervisorModel, supervisorProvider, t.modelPickerTitle]);

  useEffect(() => {
    if (!visible) return;

    setKeyword('');
    setSelectedIds(new Set(initialSelectedAgentIds));
    setDraftTitle(initialTitle);
  }, [initialSelectedAgentIds, initialTitle, visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const result = await agentApi.queryAgents({
          keyword: keyword.trim() || undefined,
        });

        if (!cancelled) {
          setAgents(result ?? []);
        }
      } catch {
        if (!cancelled) {
          setAgents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword, visible]);

  const filteredAgents = useMemo(() => {
    const excluded = new Set(excludedAgentIds);
    return agents.filter((agent) => !excluded.has(agent.id));
  }, [agents, excludedAgentIds]);

  const renderListHeader = useMemo(
    () => (
      <>
        {showTitleInput ? (
          <View className="mb-4">
            <Text
              className="mb-1.5 px-1 text-[12px] font-medium"
              style={{ color: colors.secondaryText }}
            >
              {titleInputLabel || t.agentConfigName}
            </Text>
            <TextInput
              className="rounded-2xl px-4 py-3 text-[15px]"
              placeholder={titleInputPlaceholder}
              placeholderTextColor={colors.secondaryText}
              style={{ backgroundColor: colors.fillTertiary, color: colors.foreground }}
              value={draftTitle}
              onChangeText={setDraftTitle}
            />
          </View>
        ) : null}

        {showSupervisorModelPicker ? (
          <SelectionListItem
            className="mb-4"
            subtitle={supervisorModelLabel}
            title={t.groupCreateSupervisorModel}
            rightAccessory={
              <ChevronRight
                color={colors.secondaryText}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            }
            onPress={() => {
              haptics.light();
              setSupervisorModelDrawerVisible(true);
            }}
          />
        ) : null}

        <View className="mb-4">
          <Text
            className="mb-1.5 px-1 text-[12px] font-medium"
            style={{ color: colors.secondaryText }}
          >
            {t.search}
          </Text>
          <SearchField
            placeholder={t.search}
            size="compact"
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </>
    ),
    [
      colors.fillTertiary,
      colors.foreground,
      colors.secondaryText,
      draftTitle,
      keyword,
      showSupervisorModelPicker,
      showTitleInput,
      supervisorModelLabel,
      t.agentConfigName,
      t.groupCreateSupervisorModel,
      t.search,
      titleInputLabel,
      titleInputPlaceholder,
    ],
  );

  const renderListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View className="items-center justify-center py-8">
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    return (
      <View className="rounded-2xl px-4 py-5" style={{ backgroundColor: colors.fillQuaternary }}>
        <Text className="text-[14px] font-semibold" style={{ color: colors.foreground }}>
          {t.agentsEmpty}
        </Text>
        <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.secondaryText }}>
          {t.agentsEmptyDesc}
        </Text>
      </View>
    );
  }, [
    colors.fillQuaternary,
    colors.foreground,
    colors.primary,
    colors.secondaryText,
    loading,
    t.agentsEmpty,
    t.agentsEmptyDesc,
  ]);

  const renderAgentItem = useMemo(
    () =>
      ({ item, index }: { item: AgentQueryItem; index: number }) => {
        const selected = selectedIds.has(item.id);

        return (
          <SelectionListItem
            className={index === filteredAgents.length - 1 ? '' : 'mb-2'}
            leading={<AgentAvatar agent={item} />}
            selected={selected}
            subtitle={item.description || t.agentNoDescription}
            subtitleNumberOfLines={3}
            title={item.title || t.settingsDefaultAgent}
            onPress={() => {
              haptics.selection();
              setSelectedIds((current) => {
                const next = new Set(current);

                if (next.has(item.id)) {
                  next.delete(item.id);
                } else {
                  next.add(item.id);
                }

                return next;
              });
            }}
          />
        );
      },
    [filteredAgents.length, selectedIds, t.agentNoDescription, t.settingsDefaultAgent],
  );

  const submitDisabled = submitting || (!allowEmptySelection && selectedIds.size === 0);
  const submitAction = (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={submitDisabled}
      onPress={async () => {
        if (submitDisabled) return;

        try {
          setSubmitting(true);
          await onSubmit({
            agentIds: [...selectedIds],
            supervisorConfig:
              showSupervisorModelPicker && supervisorModel && supervisorProvider
                ? { model: supervisorModel, provider: supervisorProvider }
                : undefined,
            title: draftTitle.trim(),
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {submitting ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text
          className="text-[15px] font-semibold"
          style={{ color: submitDisabled ? colors.secondaryText : colors.primary }}
        >
          {confirmLabel}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <BottomSheetScaffold
        keyboardAvoiding
        headerRight={submitAction}
        maxHeight="80%"
        preferredWidth={680}
        title={title}
        visible={visible}
        onClose={onClose}
      >
        <FlatList
          ListEmptyComponent={renderListEmpty}
          ListHeaderComponent={renderListHeader}
          className="px-5"
          contentContainerStyle={{ paddingBottom: 24 }}
          data={filteredAgents}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderAgentItem}
        />
      </BottomSheetScaffold>
      {showSupervisorModelPicker ? (
        <ModelDrawer
          initialModel={supervisorModel || undefined}
          initialProvider={supervisorProvider || undefined}
          persistSelection={false}
          visible={supervisorModelDrawerVisible}
          onClose={() => setSupervisorModelDrawerVisible(false)}
          onSelect={(modelId, providerId) => {
            setSupervisorModel(modelId);
            setSupervisorProvider(providerId);
          }}
        />
      ) : null}
    </>
  );
}
