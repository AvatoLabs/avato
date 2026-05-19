import { ArrowLeft, GitBranch, MessageCircle } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import EmptyState from '../components/ui/EmptyState';
import PortalScaffold from '../components/ui/PortalScaffold';
import { HeaderIconButton } from '../components/ui/ScreenHeader';
import { getMobileBuiltinDisplayName, getMobileBuiltinRender } from '../features/BuiltinTools';
import { useI18n } from '../lib/i18n';
import { codeInlineRules } from '../lib/markdownRules';
import { getThemedMarkdownStyles } from '../lib/markdownStyles';
import { navigateBackFromPortal, navigateToConversationOrigin } from '../lib/navigation';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

const formatArguments = (argumentsString?: string) => {
  if (!argumentsString) return '';

  try {
    return JSON.stringify(JSON.parse(argumentsString), null, 2);
  } catch {
    return argumentsString;
  }
};

export default function ToolDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'ToolDetail'>) {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const {
    apiName,
    arguments: argsStr,
    content,
    error,
    identifier,
    pluginState,
    sessionId,
    threadId,
    title,
    topicId,
    toolCallId,
  } = route.params;

  const BuiltinRender = getMobileBuiltinRender(identifier, apiName);
  const displayTitle =
    title?.trim() ||
    getMobileBuiltinDisplayName(identifier, apiName, { locale, t: (key) => t[key] }) ||
    apiName ||
    identifier ||
    t.toolDetailTitle;
  const formattedArguments = useMemo(() => formatArguments(argsStr), [argsStr]);
  const markdownStyles = useMemo(() => getThemedMarkdownStyles(colors), [colors]);
  const hasRenderableContent =
    !!BuiltinRender ||
    !!formattedArguments ||
    !!content?.trim() ||
    !!error ||
    !!Object.keys(pluginState ?? {}).length;
  const originActionLabel = threadId ? t.threadOpen : t.chatOpenConversation;
  const canOpenOrigin = !!sessionId;
  const handleOpenOrigin = useCallback(() => {
    navigateToConversationOrigin({ sessionId, threadId, topicId });
  }, [sessionId, threadId, topicId]);
  const handleBack = useCallback(() => {
    navigateBackFromPortal({
      conversationOrigin: sessionId
        ? { sessionId, ...(threadId ? { threadId } : {}), ...(topicId ? { topicId } : {}) }
        : undefined,
      fallbackToMainTabs: true,
      navigation,
      portalStack: route.params.portalStack,
    });
  }, [navigation, route.params.portalStack, sessionId, threadId, topicId]);

  return (
    <PortalScaffold
      portalCurrentLabel={displayTitle}
      portalRouteName={route.name}
      portalRouteParams={route.params}
      subtitle={toolCallId}
      title={displayTitle}
      leftElement={
        <ArrowLeft color={colors.foreground} size={20} strokeWidth={tokens.icon.strokeWidth} />
      }
      rightActions={
        canOpenOrigin ? (
          <HeaderIconButton
            accessibilityHint={originActionLabel}
            accessibilityLabel={originActionLabel}
            onPress={handleOpenOrigin}
          >
            {threadId ? (
              <GitBranch color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
            ) : (
              <MessageCircle
                color={colors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            )}
          </HeaderIconButton>
        ) : null
      }
      onDismiss={handleBack}
      onPressLeft={handleBack}
    >
      {hasRenderableContent ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: 12,
            paddingBottom: 24,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          {BuiltinRender ? (
            <BuiltinRender
              apiName={apiName || ''}
              arguments={argsStr}
              content={content}
              error={error}
              identifier={identifier || ''}
              pluginState={pluginState}
              sessionId={sessionId}
              threadId={threadId}
              toolCallId={toolCallId}
              topicId={topicId}
            />
          ) : null}

          {formattedArguments ? (
            <View
              className="rounded-2xl px-4 py-4"
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
            >
              <Text
                className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: colors.secondaryText }}
              >
                {t.chatToolArguments}
              </Text>
              <ScrollView horizontal className="mt-3" showsHorizontalScrollIndicator={false}>
                <Text
                  selectable
                  className="rounded-xl px-3 py-2 text-[11px] leading-4"
                  style={{
                    backgroundColor: colors.fillTertiary,
                    color: colors.foreground,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  }}
                >
                  {formattedArguments}
                </Text>
              </ScrollView>
            </View>
          ) : null}

          {!BuiltinRender && content?.trim() ? (
            <View
              className="rounded-2xl px-4 py-4"
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
            >
              <Text
                className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: colors.secondaryText }}
              >
                {t.chatToolResponse}
              </Text>
              <Markdown rules={codeInlineRules as any} style={markdownStyles}>
                {content}
              </Markdown>
            </View>
          ) : null}

          {error ? (
            <View
              className="rounded-2xl px-4 py-4"
              style={{
                backgroundColor: colors.dangerMuted,
                borderColor: colors.dangerSubtle,
                borderWidth: 1,
              }}
            >
              <Text className="text-[13px] font-medium" style={{ color: colors.danger }}>
                {typeof error === 'object' && error !== null && 'message' in error
                  ? String((error as { message?: unknown }).message ?? '')
                  : String(error)}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-5">
          <EmptyState
            compact
            description={t.toolDetailEmptyDesc}
            iconVariant="chat"
            title={t.toolDetailEmpty}
          />
        </View>
      )}
    </PortalScaffold>
  );
}
