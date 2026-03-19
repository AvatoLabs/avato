import { Check, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { getProviderIconUrl } from '../../constants/cdn';
import { useI18n } from '../../lib/i18n';
import { useModelStore } from '../../store/model';
import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';
import { tokens } from '../../theme/tokens';
import type { RuntimeEnabledModel } from '../../types';

function ProviderLogo({
  providerId,
  logo,
  size = 22,
}: {
  logo?: string;
  providerId: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colors = useThemeColors();
  const url = logo || getProviderIconUrl(providerId, effectiveTheme);

  if (err) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text className="text-[9px] font-semibold" style={{ color: colors.secondaryText }}>
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <RNImage
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setErr(true)}
    />
  );
}

function getAbilityTags(m: RuntimeEnabledModel): string[] {
  const tags: string[] = [];
  if (m.abilities?.vision) tags.push('Vision');
  if (m.abilities?.functionCall) tags.push('Tools');
  if (m.abilities?.reasoning) tags.push('Reasoning');
  if (m.abilities?.search) tags.push('Search');
  if (m.contextWindowTokens) {
    const k = Math.round(m.contextWindowTokens / 1000);
    tags.push(k >= 1000 ? `${Math.round(k / 1000)}M` : `${k}K`);
  }
  return tags;
}

interface ModelDrawerProps {
  initialModel?: string;
  initialProvider?: string;
  onClose: () => void;
  onSelect?: (modelId: string, providerId: string) => void;
  /** When true, only call onSelect without persisting to session/agent (for one-off selection) */
  persistSelection?: boolean;
  sessionId?: string;
  visible: boolean;
}

export function ModelDrawer({
  visible,
  onClose,
  sessionId,
  onSelect,
  persistSelection = true,
  initialModel,
  initialProvider,
}: ModelDrawerProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const providers = useModelStore((s) => s.providers);
  const loading = useModelStore((s) => s.loading);
  const isLoaded = useModelStore((s) => s.isLoaded);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const storeSelectedModel = useModelStore((s) => s.selectedModel);
  const storeSelectedProvider = useModelStore((s) => s.selectedProvider);
  const selectModel = useModelStore((s) => s.selectModel);
  const loadSelection = useModelStore((s) => s.loadSelection);

  const selectedModel = initialModel ?? storeSelectedModel;
  const _selectedProvider = initialProvider ?? storeSelectedProvider;

  useEffect(() => {
    if (visible) {
      if (!isLoaded) fetchModels();
      if (persistSelection) {
        loadSelection(sessionId);
      }
    }
  }, [visible, isLoaded, fetchModels, loadSelection, sessionId, persistSelection]);

  const handleSelect = useCallback(
    async (modelId: string, providerId: string) => {
      if (persistSelection) {
        await selectModel(modelId, providerId, sessionId);
      }
      onSelect?.(modelId, providerId);
      onClose();
    },
    [selectModel, sessionId, onSelect, onClose, persistSelection],
  );

  const filtered = useMemo(() => providers.filter((p) => p.children.length > 0), [providers]);

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Animated.View entering={enteringModalContent()} style={{ maxHeight: '75%' }}>
          <Pressable className="bg-card rounded-t-2xl" onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>

            {/* Header */}
            <View className="px-5 pb-1 pt-0 flex-row items-center justify-between">
              <Text className="text-foreground text-[18px] font-bold tracking-tight">
                {t.modelPickerTitle}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={loading}
                onPress={() => fetchModels(true)}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <RefreshCw
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Model list */}
            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {!isLoaded && loading ? (
                <View className="items-center py-16">
                  <ActivityIndicator color={colors.primary} size="large" />
                </View>
              ) : filtered.length === 0 ? (
                <View className="items-center py-16">
                  <Text className="text-[14px]" style={{ color: colors.secondaryText }}>
                    {providers.length === 0 ? t.modelPickerOffline : t.discoverNoResults}
                  </Text>
                </View>
              ) : (
                filtered.map((provider) => (
                  <View className="mb-3" key={provider.id}>
                    <View className="flex-row items-center mb-1.5 mt-1">
                      <ProviderLogo logo={provider.logo} providerId={provider.id} size={16} />
                      <Text
                        className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: colors.secondaryText }}
                      >
                        {provider.name}
                      </Text>
                    </View>
                    <View className="bg-foreground/5 rounded-2xl overflow-hidden">
                      {provider.children.map((model) => {
                        const isSelected = selectedModel === model.id;
                        const tags = getAbilityTags(model);
                        return (
                          <TouchableOpacity
                            activeOpacity={0.6}
                            className="flex-row items-center px-3.5 py-3"
                            key={model.id}
                            onPress={() => handleSelect(model.id, provider.id)}
                          >
                            <ProviderLogo logo={provider.logo} providerId={provider.id} size={24} />
                            <View className="flex-1 ml-2.5">
                              <Text
                                className="text-[14px] font-medium tracking-tight"
                                numberOfLines={1}
                                style={{ color: isSelected ? colors.primary : colors.foreground }}
                              >
                                {model.displayName || model.id}
                              </Text>
                              {tags.length > 0 && (
                                <View className="flex-row flex-wrap gap-1 mt-0.5">
                                  {tags.map((tag) => (
                                    <View
                                      className="bg-foreground/5 px-1.5 py-px rounded-full"
                                      key={tag}
                                    >
                                      <Text
                                        className="text-[9px] font-medium"
                                        style={{ color: colors.secondaryText }}
                                      >
                                        {tag}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                            {isSelected && (
                              <Check
                                color={colors.primary}
                                size={18}
                                strokeWidth={tokens.icon.strokeWidth}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
