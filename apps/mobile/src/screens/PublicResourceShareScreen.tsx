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
  contentShareApi,
  getApiUrl,
  isSharePasswordRequiredError,
  type PublicSharedContentPayload,
} from '../lib/api';
import { formatMobileDateTime } from '../lib/dateTime';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { codeInlineRules } from '../lib/markdownRules';
import { getThemedMarkdownStyles } from '../lib/markdownStyles';
import { getCanonicalSharedResourceKind } from '../lib/resourceShare';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

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
  const [data, setData] = useState<PublicSharedContentPayload | null>(null);
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
      const res = await contentShareApi.getSharedContentByToken({
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
  const canonicalKind = data
    ? getCanonicalSharedResourceKind({ kind: data.kind, localId: data.localId })
    : undefined;

  const description =
    data && 'description' in data
      ? ((data as { description?: string | null }).description ?? null)
      : null;

  const handleDownload = async () => {
    if (!data || canonicalKind !== 'file') return;
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
    canonicalKind === 'file'
      ? t.resourceSharedKindFile
      : canonicalKind === 'source_set'
        ? t.resourceSharedKindSourceSet
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
          <View
            className="rounded-[24px] border px-5 py-5"
            style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
          >
            <Text
              className="text-[11px] font-semibold uppercase tracking-[1.2px]"
              style={{ color: colors.secondaryText }}
            >
              {t.resourcePublicShareTitle}
            </Text>
            <Text className="mt-2 text-[20px] font-bold text-foreground">
              {t.resourcePublicSharePasswordTitle}
            </Text>
            <Text className="text-[14px] mt-2 leading-6" style={{ color: colors.secondaryText }}>
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
          </View>
        </ScrollView>
      ) : notFound || !data ? (
        <View className="flex-1 px-6 justify-center">
          <View
            className="rounded-[24px] border px-5 py-5"
            style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
          >
            <Text
              className="text-[11px] font-semibold uppercase tracking-[1.2px]"
              style={{ color: colors.secondaryText }}
            >
              {t.resourcePublicShareTitle}
            </Text>
            <Text className="mt-2 text-[16px] text-center font-semibold text-foreground">
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
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
          <View
            className="rounded-[24px] border px-5 py-5"
            style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
          >
            <Text
              className="text-[11px] font-semibold uppercase tracking-[1.2px]"
              style={{ color: colors.secondaryText }}
            >
              {t.resourcePublicShareTitle}
            </Text>
            <Text className="mt-2 text-[22px] font-bold text-foreground">{title}</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.primaryMuted }}
              >
                <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                  {kindLabel}
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: colors.fillTertiary }}
              >
                <Text className="text-[12px] font-medium" style={{ color: colors.secondaryText }}>
                  {t.resourcePublicShareExpires}: {formatMobileDateTime(data.expiresAt)}
                </Text>
              </View>
            </View>
            {description ? (
              <Text className="text-[14px] mt-4 leading-6" style={{ color: colors.secondaryText }}>
                {description}
              </Text>
            ) : null}

            {canonicalKind === 'file' ? (
              <View
                className="mt-4 rounded-2xl border px-4 py-3"
                style={{ backgroundColor: colors.card, borderColor: colors.borderSubtle }}
              >
                <Text
                  className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                  style={{ color: colors.secondaryText }}
                >
                  {t.notebookPreview}
                </Text>
                <Text className="mt-1 text-[14px]" style={{ color: colors.secondaryText }}>
                  {kindLabel}
                </Text>
                <TouchableOpacity
                  accessibilityLabel={t.resourcePublicShareDownload}
                  accessibilityRole="button"
                  className="mt-4 flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-3"
                  style={{ backgroundColor: colors.primary }}
                  onPress={() => void handleDownload()}
                >
                  <Download color={colors.iconOnPrimary} size={16} strokeWidth={2.2} />
                  <Text
                    className="text-[14px] font-semibold"
                    style={{ color: colors.iconOnPrimary }}
                  >
                    {t.resourcePublicShareDownload}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View
            className="mt-4 overflow-hidden rounded-[24px] border"
            style={{ backgroundColor: colors.card, borderColor: colors.borderSubtle }}
          >
            <View
              className="border-b px-4 py-3"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.2px]"
                style={{ color: colors.secondaryText }}
              >
                {t.notebookPreview}
              </Text>
              <Text className="mt-1 text-[14px] font-semibold" style={{ color: colors.foreground }}>
                {kindLabel}
              </Text>
            </View>

            {canonicalKind === 'document' && data.content ? (
              <View className="p-4">
                <Markdown rules={codeInlineRules as any} style={markdownStyles}>
                  {data.content}
                </Markdown>
              </View>
            ) : canonicalKind === 'document' ? (
              <Text className="px-4 py-4 text-[14px]" style={{ color: colors.secondaryText }}>
                {t.resourcePublicShareDocEmpty}
              </Text>
            ) : (
              <Text
                className="px-4 py-4 text-[14px] leading-6"
                style={{ color: colors.secondaryText }}
              >
                {canonicalKind === 'source_set'
                  ? t.resourcePublicShareSourceSetHint
                  : t.resourcePreviewUnavailable}
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
