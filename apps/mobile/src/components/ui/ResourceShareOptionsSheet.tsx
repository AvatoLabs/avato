/**
 * Configure resource share link (expiry, optional password) then create + system share sheet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ResourceShareKind } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { shareResourceWithLink } from '../../lib/resourceShareFlow';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';

export interface ResourceShareSheetTarget {
  id: string;
  kind: ResourceShareKind;
  name: string;
}

interface ResourceShareOptionsSheetProps {
  apiBase: string;
  cachedLocalUri?: string | null;
  onClose: () => void;
  onFail: () => void;
  onSuccess: () => void;
  target: ResourceShareSheetTarget | null;
  visible: boolean;
}

export default function ResourceShareOptionsSheet({
  visible,
  target,
  apiBase,
  cachedLocalUri,
  onClose,
  onSuccess,
  onFail,
}: ResourceShareOptionsSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [expiresInDays, setExpiresInDays] = useState<1 | 7 | 30>(7);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setExpiresInDays(7);
      setPassword('');
      setSubmitting(false);
    }
  }, [visible, target?.id]);

  const handleSubmit = useCallback(async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      const result = await shareResourceWithLink({
        apiBase,
        cachedLocalUri,
        expiresInDays,
        id: target.id,
        kind: target.kind,
        name: target.name,
        password: password.trim() || undefined,
      });
      if (result === 'fail') {
        onFail();
      } else {
        onSuccess();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    apiBase,
    cachedLocalUri,
    expiresInDays,
    onClose,
    onFail,
    onSuccess,
    password,
    submitting,
    target,
  ]);

  if (!target) return null;

  const expiryChip = (days: 1 | 7 | 30, label: string) => {
    const active = expiresInDays === days;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className="rounded-xl px-3 py-2.5 border"
        style={{
          backgroundColor: active ? colors.primary : colors.fillTertiary,
          borderColor: active ? colors.primary : colors.border,
        }}
        onPress={() => setExpiresInDays(days)}
      >
        <Text
          className="text-[13px] font-semibold"
          style={{ color: active ? colors.iconOnPrimary : colors.foreground }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/45" onPress={onClose}>
        <Animated.View
          entering={enteringModalContent()}
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable
            className="bg-card rounded-t-2xl px-5 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <Text className="text-foreground text-[17px] font-bold" numberOfLines={2}>
              {t.resourceShareLinkTitle}
            </Text>
            <Text
              className="text-[13px] mt-1 mb-4"
              numberOfLines={2}
              style={{ color: colors.secondaryText }}
            >
              {target.name}
            </Text>

            <Text
              className="text-[12px] font-semibold mb-2"
              style={{ color: colors.secondaryText }}
            >
              {t.resourceShareExpiresLabel}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {expiryChip(1, t.resourceShareExpires1d)}
              {expiryChip(7, t.resourceShareExpires7d)}
              {expiryChip(30, t.resourceShareExpires30d)}
            </View>

            <Text
              className="text-[12px] font-semibold mb-1"
              style={{ color: colors.secondaryText }}
            >
              {t.resourceSharePasswordOptional}
            </Text>
            <TextInput
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-xl px-3 py-3 text-[15px] text-foreground mb-5"
              placeholder={t.resourceSharePasswordPlaceholder}
              placeholderTextColor={colors.muted}
              value={password}
              style={{
                backgroundColor: colors.fillTertiary,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              onChangeText={setPassword}
            />

            <View className="flex-row gap-3 pb-2">
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-1 rounded-xl py-3.5 items-center"
                disabled={submitting}
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={onClose}
              >
                <Text className="text-[15px] font-semibold text-foreground">{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-1 rounded-xl py-3.5 items-center flex-row justify-center gap-2"
                disabled={submitting}
                style={{ backgroundColor: colors.primary }}
                onPress={() => void handleSubmit()}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.iconOnPrimary} />
                ) : (
                  <Text
                    className="text-[15px] font-semibold"
                    style={{ color: colors.iconOnPrimary }}
                  >
                    {t.resourceShareConfirm}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
