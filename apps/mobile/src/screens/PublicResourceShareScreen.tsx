/**
 * In-app preview for public resource share links (`/share/r/:token`), including optional password.
 */
import { ArrowLeft, Download } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import {
  getApiUrl,
  isSharePasswordRequiredError,
  type PublicSharedResourcePayload,
  resourceShareApi,
} from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { codeInlineRules } from '../lib/markdownRules';
import { getThemedMarkdownStyles } from '../lib/markdownStyles';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

function formatExpiresAt(value: string | Date): string {
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

export default function PublicResourceShareScreen({
  navigation,
  route,
}: RootStackScreenProps<'PublicResourceShare'>) {
  const { token, initialPassword } = route.params;
  const colors = useThemeColors();
  const { t } = useI18n();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const markdownStyles = React.useMemo(() => getThemedMarkdownStyles(colors), [colors]);

  const [passwordDraft, setPasswordDraft] = useState(initialPassword ?? '');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(initialPassword);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicSharedResourcePayload | null>(null);
  const [passwordGate, setPasswordGate] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setPasswordDraft(initialPassword ?? '');
    setSubmittedPassword(initialPassword);
    setData(null);
    setPasswordGate(false);
    setNotFound(false);
  }, [initialPassword, token]);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await resourceShareApi.getSharedResourceByToken({
        password: submittedPassword,
        token,
      });
      setData(res);
      setPasswordGate(false);
    } catch (e) {
      setData(null);
      if (isSharePasswordRequiredError(e)) {
        setPasswordGate(true);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [submittedPassword, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = data?.title?.trim() ? data.title : data?.name;

  const description =
    data && 'description' in data
      ? ((data as { description?: string | null }).description ?? null)
      : null;

  const handleDownload = async () => {
    if (!data || data.kind !== 'file') return;
    haptics.selection();
    const base = await getApiUrl();
    const url = `${base}/share/f/${encodeURIComponent(token)}${
      submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : ''
    }`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.show('error', t.resourcePublicShareDownloadFailed);
    }
  };

  const kindLabel =
    data?.kind === 'file'
      ? t.resourceSharedKindFile
      : data?.kind === 'knowledge_base'
        ? t.resourceSharedKindLibrary
        : t.resourceSharedKindDocument;

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <ScreenHeader
        title={t.resourcePublicShareTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : passwordGate ? (
        <ScrollView
          className="flex-1 px-5 pt-6"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-[20px] font-bold text-foreground text-center">
            {t.resourcePublicSharePasswordTitle}
          </Text>
          <Text className="text-[14px] mt-2 text-center" style={{ color: colors.secondaryText }}>
            {t.resourcePublicSharePasswordSubtitle}
          </Text>
          <TextInput
            autoFocus
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-xl px-3 py-2.5 text-[15px] text-foreground mt-5"
            placeholder={t.resourcePublicSharePasswordPlaceholder}
            placeholderTextColor={colors.muted}
            value={passwordDraft}
            style={{
              backgroundColor: colors.fillTertiary,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            onChangeText={setPasswordDraft}
          />
          <TouchableOpacity
            accessibilityLabel={t.resourcePublicShareUnlock}
            accessibilityRole="button"
            className="rounded-xl py-3.5 items-center mt-4"
            style={{ backgroundColor: colors.primary }}
            onPress={() => {
              haptics.selection();
              setSubmittedPassword(passwordDraft || undefined);
            }}
          >
            <Text className="text-[16px] font-semibold" style={{ color: colors.iconOnPrimary }}>
              {t.resourcePublicShareUnlock}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : notFound || !data ? (
        <View className="flex-1 px-6 justify-center">
          <Text className="text-[15px] text-center font-medium text-foreground">
            {t.resourcePublicShareNotFound}
          </Text>
          <Text
            className="text-[13px] mt-3 text-center leading-5"
            style={{ color: colors.secondaryText }}
          >
            {t.resourcePublicShareNotFoundHint}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t.errorRetry}
            accessibilityRole="button"
            activeOpacity={0.85}
            className="mt-6 self-center rounded-xl px-6 py-3"
            style={{ backgroundColor: colors.primary }}
            onPress={() => {
              haptics.light();
              void load();
            }}
          >
            <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
              {t.errorRetry}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
          <Text className="text-[22px] font-bold text-foreground">{title}</Text>
          <Text className="text-[13px] mt-1" style={{ color: colors.secondaryText }}>
            {kindLabel}
          </Text>
          {description ? (
            <Text className="text-[14px] mt-3 leading-5" style={{ color: colors.secondaryText }}>
              {description}
            </Text>
          ) : null}
          {data.kind === 'knowledge_base' ? (
            <Text className="text-[13px] mt-3 leading-5" style={{ color: colors.secondaryText }}>
              {t.resourcePublicShareKbHint}
            </Text>
          ) : null}

          <View className="flex-row flex-wrap gap-2 mt-4">
            <View
              className="rounded-lg px-3 py-2"
              style={{
                backgroundColor: colors.fillTertiary,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                {t.resourcePublicShareExpires}: {formatExpiresAt(data.expiresAt)}
              </Text>
            </View>
            {data.kind === 'file' ? (
              <TouchableOpacity
                accessibilityLabel={t.resourcePublicShareDownload}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
                style={{ backgroundColor: colors.primary }}
                onPress={() => void handleDownload()}
              >
                <Download color={colors.iconOnPrimary} size={16} strokeWidth={2.2} />
                <Text className="text-[13px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                  {t.resourcePublicShareDownload}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {data.kind === 'document' && data.content ? (
            <View
              className="rounded-xl p-4 mt-5"
              style={{
                backgroundColor: colors.fillTertiary,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Markdown rules={codeInlineRules as any} style={markdownStyles}>
                {data.content}
              </Markdown>
            </View>
          ) : data.kind === 'document' ? (
            <Text className="text-[14px] mt-5" style={{ color: colors.secondaryText }}>
              {t.resourcePublicShareDocEmpty}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
