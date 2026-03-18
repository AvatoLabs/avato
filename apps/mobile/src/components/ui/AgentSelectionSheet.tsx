import { Check, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { agentApi, type AgentQueryItem } from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { useModelStore } from '../../store/model';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';
import { tokens } from '../../theme/tokens';
import { ModelDrawer } from './ModelDrawer';

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
  const avatar = agent.avatar?.trim();

  if (avatar && avatar.length <= 4 && !avatar.startsWith('http')) {
    return (
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
        <Text className="text-[18px]">{avatar}</Text>
      </View>
    );
  }

  const fallback = agent.title?.trim()?.slice(0, 1)?.toUpperCase() || '#';

  return (
    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
      <Text className="text-[16px] font-semibold text-primary">{fallback}</Text>
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

  const submitDisabled = submitting || (!allowEmptySelection && selectedIds.size === 0);

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ maxHeight: '80%' }}
        >
          <Animated.View entering={enteringModalContent()} style={{ maxHeight: '80%' }}>
            <Pressable
            className="rounded-t-2xl bg-card"
            onPress={(event) => event.stopPropagation()}
          >
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-9 rounded-full bg-foreground/10" />
          </View>

          <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
            <Text className="text-[18px] font-bold tracking-tight text-foreground">{title}</Text>
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
                  style={{
                    color: submitDisabled ? colors.secondaryText : colors.primary,
                  }}
                >
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
            {showTitleInput ? (
              <View className="mb-4">
                <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
                  {titleInputLabel || t.agentConfigName}
                </Text>
                <TextInput
                  className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
                  placeholder={titleInputPlaceholder}
                  placeholderTextColor={colors.secondaryText}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                />
              </View>
            ) : null}

            {showSupervisorModelPicker ? (
              <TouchableOpacity
                activeOpacity={0.75}
                className="mb-4 flex-row items-center justify-between rounded-2xl bg-foreground/[0.04] px-4 py-3"
                onPress={() => {
                  haptics.light();
                  setSupervisorModelDrawerVisible(true);
                }}
              >
                <Text className="text-[14px] font-medium text-foreground">
                  {t.groupCreateSupervisorModel}
                </Text>
                <View className="flex-row items-center">
                  <Text
                    className="mr-1.5 text-[13px] text-secondary/60"
                    numberOfLines={1}
                    style={{ maxWidth: 140 }}
                  >
                    {supervisorModelLabel}
                  </Text>
                  <ChevronRight
                    color={colors.secondaryText}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
              </TouchableOpacity>
            ) : null}

            <View className="mb-4">
              <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
                {t.search}
              </Text>
              <TextInput
                className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
                placeholder={t.search}
                placeholderTextColor={colors.secondaryText}
                value={keyword}
                onChangeText={setKeyword}
              />
            </View>

            {loading ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : filteredAgents.length === 0 ? (
              <View className="rounded-2xl bg-foreground/[0.03] px-4 py-5">
                <Text className="text-[14px] font-semibold text-foreground">{t.agentsEmpty}</Text>
                <Text className="mt-1 text-[12px] leading-5 text-secondary/60">
                  {t.agentsEmptyDesc}
                </Text>
              </View>
            ) : (
              filteredAgents.map((agent, index) => {
                const selected = selectedIds.has(agent.id);
                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    key={agent.id}
                    className={`flex-row items-center rounded-2xl px-4 py-3 ${
                      index === filteredAgents.length - 1 ? '' : 'mb-3'
                    }`}
                    style={{
                      backgroundColor: selected
                        ? `${colors.primary}12`
                        : 'rgba(15,23,42,0.03)',
                      borderColor: selected ? `${colors.primary}36` : 'transparent',
                      borderWidth: 1,
                    }}
                    onPress={() => {
                      haptics.selection();
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (next.has(agent.id)) {
                          next.delete(agent.id);
                        } else {
                          next.add(agent.id);
                        }
                        return next;
                      });
                    }}
                  >
                    <AgentAvatar agent={agent} />
                    <View className="flex-1">
                      <Text className="text-[14px] font-semibold text-foreground">
                        {agent.title || t.settingsDefaultAgent}
                      </Text>
                      <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                        {agent.description || t.agentNoDescription}
                      </Text>
                    </View>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 22,
                        height: 22,
                        backgroundColor: selected
                          ? colors.primary
                          : colors.switchTrackOffAlt,
                      }}
                    >
                      {selected ? (
                        <Check color={colors.iconOnPrimary} size={13} strokeWidth={tokens.icon.strokeWidth + 0.3} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>

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
    </Modal>
  );
}
