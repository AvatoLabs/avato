/**
 * In-app preview for public topic share links (`/share/t/:shareId`).
 */
import { ArrowLeft, MessageSquare } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/ui/EmptyState';
import MessageBubble from '../components/ui/MessageBubble';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { getApiUrl, topicShareApi } from '../lib/api';
import { joinWebPath } from '../lib/communityLinks';
import { useI18n } from '../lib/i18n';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { ChatMessage, SharedTopicData } from '../types';

const getSharedTopicActor = (data: SharedTopicData | null) => {
  if (!data) return null;

  if (data.groupId) {
    return {
      kind: 'group' as const,
      title: data.groupMeta?.title?.trim() || data.groupId,
    };
  }

  return {
    kind: 'agent' as const,
    title: data.agentMeta?.title?.trim() || data.agentId || 'Avato',
  };
};

export default function PublicTopicShareScreen({
  navigation,
  route,
}: RootStackScreenProps<'PublicTopicShare'>) {
  const { shareId } = route.params;
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedTopicData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [sharedTopic, sharedMessages] = await Promise.all([
        topicShareApi.getSharedTopic(shareId),
        topicShareApi.listMessages(shareId),
      ]);
      setData(sharedTopic);
      setMessages(sharedMessages);
    } catch {
      setData(null);
      setMessages([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actor = getSharedTopicActor(data);
  const conversationSessionId = data?.groupId || data?.agentId || `share:${shareId}`;
  const title = data?.title?.trim() || t.topicPublicShareTitle;
  const actorLabel =
    actor?.kind === 'group' ? t.topicPublicShareFromGroup : t.topicPublicShareFromAgent;
  const messageCountLabel = t.topicPublicShareMessageCount.replace(
    '{count}',
    String(messages.length),
  );
  const agentMarketIdentifier = data?.agentMeta?.marketIdentifier?.trim();
  const showTryItYourself = Boolean(agentMarketIdentifier && !data?.groupId);

  const openWebPath = useCallback(
    async (path: `/${string}`) => {
      try {
        const baseUrl = await getApiUrl();
        await Linking.openURL(joinWebPath(baseUrl, path));
      } catch {
        toast.show('error', t.topicPublicShareOpenFailed);
      }
    },
    [t.topicPublicShareOpenFailed, toast],
  );

  const groupMembersById = useMemo(() => {
    if (!data?.groupMeta?.members?.length) return undefined;

    return Object.fromEntries(
      data.groupMeta.members.map((member) => [
        member.id,
        {
          avatar: member.avatar ?? undefined,
          id: member.id,
          title: member.title ?? undefined,
        },
      ]),
    );
  }, [data?.groupMeta?.members]);

  const headerCard = data ? (
    <View className="px-5 pt-4">
      <View
        className="rounded-[24px] border px-5 py-5"
        style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
      >
        <View className="flex-row items-center gap-2">
          <View
            className="h-9 w-9 items-center justify-center rounded-2xl"
            style={{ backgroundColor: colors.primarySubtle }}
          >
            <MessageSquare color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </View>
          <View className="flex-1">
            <Text
              className="text-[11px] font-semibold uppercase tracking-[1.2px]"
              style={{ color: colors.secondaryText }}
            >
              {t.topicPublicShareSubtitle}
            </Text>
            <Text className="mt-1 text-[20px] font-bold text-foreground">{title}</Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: colors.primaryMuted }}
          >
            <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
              {actorLabel}
              {actor?.title ? ` · ${actor.title}` : ''}
            </Text>
          </View>
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: colors.fillTertiary }}
          >
            <Text className="text-[12px] font-medium" style={{ color: colors.secondaryText }}>
              {messageCountLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  ) : null;

  const footerActionBar = data ? (
    <View className="px-5 pt-5">
      <View
        className="rounded-[24px] border px-4 py-4"
        style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle }}
      >
        <Text className="text-[13px] font-medium" style={{ color: colors.secondaryText }}>
          {t.topicPublicShareDisclaimer}
        </Text>
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.72}
            className="flex-1 items-center rounded-full px-3 py-3"
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={() => void openWebPath('/community/agent')}
          >
            <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
              {t.topicPublicShareFindMore}
            </Text>
          </TouchableOpacity>

          {showTryItYourself ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.72}
              className="flex-1 items-center rounded-full px-3 py-3"
              style={{ backgroundColor: colors.primary }}
              onPress={() =>
                void openWebPath(`/community/agent/${encodeURIComponent(agentMarketIdentifier!)}`)
              }
            >
              <Text className="text-[13px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                {t.topicPublicShareTryItYourself}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <ScreenHeader
        subtitle={shareId}
        title={t.topicPublicShareTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : failed ? (
        <View className="flex-1 justify-center px-5">
          <EmptyState
            compact
            description={t.topicPublicShareNotFoundHint}
            iconVariant="warning"
            title={t.topicPublicShareNotFound}
            action={
              <TouchableOpacity
                accessibilityLabel={t.errorRetry}
                accessibilityRole="button"
                className="items-center rounded-xl px-4 py-3"
                style={{ backgroundColor: colors.primary }}
                onPress={() => void load()}
              >
                <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                  {t.errorRetry}
                </Text>
              </TouchableOpacity>
            }
          />
        </View>
      ) : (
        <FlatList
          ListFooterComponent={footerActionBar}
          ListHeaderComponent={headerCard}
          contentContainerStyle={{ paddingBottom: 32 }}
          data={messages}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="px-5 pt-6">
              <EmptyState
                compact
                description={t.topicPublicShareMessagesEmptyDesc}
                iconVariant="chat"
                title={t.topicPublicShareMessagesEmpty}
              />
            </View>
          }
          renderItem={({ item }) => (
            <View className="px-5 pt-3">
              <MessageBubble
                disableToolActions
                readOnly
                groupMembersById={groupMembersById}
                isGroupSession={!!data?.groupId}
                message={item}
                sessionId={conversationSessionId}
                topicId={data?.topicId ?? null}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}
