import { RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getProviderIconUrl } from '../../constants/cdn';
import { useI18n } from '../../lib/i18n';
import { useModelStore } from '../../store/model';
import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { RuntimeEnabledModel } from '../../types';
import { BottomSheetScaffold } from './BottomSheetScaffold';
import { MetaTag } from './ChoiceControls';
import { SelectionListItem, SelectionSectionLabel } from './SelectionList';

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
    <BottomSheetScaffold
      maxHeight="75%"
      title={t.modelPickerTitle}
      visible={visible}
      headerRight={
        <TouchableOpacity activeOpacity={0.7} disabled={loading} onPress={() => fetchModels(true)}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <RefreshCw color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
          )}
        </TouchableOpacity>
      }
      onClose={onClose}
    >
      <ScrollView
        className="pb-2"
        contentContainerStyle={{ paddingBottom: 24 }}
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
              <SelectionSectionLabel
                leading={<ProviderLogo logo={provider.logo} providerId={provider.id} size={16} />}
                title={provider.name}
              />
              <View className="px-5">
                {provider.children.map((model, index) => {
                  const isSelected = selectedModel === model.id;
                  const tags = getAbilityTags(model);

                  return (
                    <SelectionListItem
                      className={index === provider.children.length - 1 ? '' : 'mb-2'}
                      key={model.id}
                      selected={isSelected}
                      title={model.displayName || model.id}
                      leading={
                        <ProviderLogo logo={provider.logo} providerId={provider.id} size={24} />
                      }
                      meta={tags.map((tag) => (
                        <MetaTag key={tag} label={tag} />
                      ))}
                      onPress={() => handleSelect(model.id, provider.id)}
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheetScaffold>
  );
}
