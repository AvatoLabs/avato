/**
 * StatsScreen — Usage statistics aligned with web /settings/stats.
 *
 * Sections:
 *  1. Welcome banner (registration duration)
 *  2. Overview cards (Assistants, Topics, Messages, Words) — from server, same order as web
 *  3. Activity heatmap (simplified grid for React Native)
 *  4. Rankings: Models / Assistants / Topics top-5
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  ClockArrowUp,
  Crown,
  Flame,
  MessageSquare,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { getProviderIconUrl } from '../constants/cdn';
import { INBOX_SESSION_ID } from '../constants/session';
import { statsApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { getResponsiveLayoutMetrics } from '../lib/responsiveLayout';
import type { RootStackParamList } from '../navigation/types';
import { useThemeStore } from '../store/theme';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type {
  HeatmapDay,
  ModelRankItem,
  SessionRankItem,
  TopicRankItem,
  UserRegistrationDuration,
} from '../types';

interface StatsRankRow {
  count: number;
  name: string;
  sessionId?: string;
  topicId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function lastMonthEnd(): string {
  const d = new Date();
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function percentChange(current: number, prev: number, newSincePrevLabel: string): string | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return newSincePrevLabel;
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function formatDate(iso?: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function settledNumber(r: PromiseSettledResult<unknown>, fallback = 0): number {
  if (r.status !== 'fulfilled' || typeof r.value !== 'number') return fallback;
  return r.value;
}

function settledRegistration(r: PromiseSettledResult<unknown>): UserRegistrationDuration | null {
  if (r.status !== 'fulfilled') return null;
  return r.value as UserRegistrationDuration | null;
}

function settledArray<T>(r: PromiseSettledResult<unknown>): T[] {
  if (r.status !== 'fulfilled' || !Array.isArray(r.value)) return [];
  return r.value as T[];
}

// ── Sub-components ───────────────────────────────────────────────────

const STAT_ICONS: Record<string, { icon: any }> = {
  messages: { icon: MessageSquare },
  sessions: { icon: Sparkles },
  topics: { icon: BookOpen },
  words: { icon: Zap },
};

function StatCard({
  title,
  value,
  prevValue,
  loading,
  iconKey,
}: {
  iconKey: string;
  loading: boolean;
  prevValue?: number;
  title: string;
  value: number;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const pct = prevValue !== undefined ? percentChange(value, prevValue, t.statsVsNew) : null;
  const isPositive = Boolean(pct && (pct.startsWith('+') || pct === t.statsVsNew));
  const meta = STAT_ICONS[iconKey] || STAT_ICONS.messages;
  const IconComp = meta.icon;
  const iconColor = colors.primary;
  const iconBg = colors.primarySubtle;

  return (
    <View className="flex-1 items-center rounded-2xl py-3 mx-1" style={{ backgroundColor: iconBg }}>
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <>
          <View
            className="rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: iconBg, width: 32, height: 32 }}
          >
            <IconComp color={iconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
          </View>
          <Text className="text-foreground text-[20px] font-bold tracking-tight">
            {formatNumber(value)}
          </Text>
          <Text className="text-[11px] font-medium mt-0.5" style={{ color: colors.secondaryText }}>
            {title}
          </Text>
          {pct && (
            <Text
              className="text-[10px] font-medium mt-0.5"
              style={{ color: isPositive ? colors.primary : colors.secondaryText }}
            >
              {pct}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function MiniHeatmap({
  data,
  loading,
  availableWidth,
}: {
  availableWidth: number;
  data: HeatmapDay[];
  loading: boolean;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const containerWidth = Math.min(Math.max(availableWidth, 0), 420);
  const heatmapColors = [
    colors.fillTertiary,
    colors.primarySubtle,
    colors.primaryMuted,
    colors.primaryFocused,
    colors.primary,
  ];

  if (loading) {
    return (
      <View className="h-24 items-center justify-center">
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  const NUM_WEEKS = 20;
  const GAP = 2;
  const recent = data.slice(-NUM_WEEKS * 7);
  const activeDays = data.filter((d) => d.level > 0).length;
  const hotDays = data.filter((d) => d.level >= 3).length;

  const cellSize = Math.floor((containerWidth - (NUM_WEEKS - 1) * GAP) / NUM_WEEKS);
  const gridWidth = cellSize * NUM_WEEKS + (NUM_WEEKS - 1) * GAP;

  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < recent.length; i += 7) {
    weeks.push(recent.slice(i, i + 7));
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5">
          <CalendarDays color={colors.primary} size={15} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="text-foreground text-[15px] font-semibold tracking-tight">
            {t.statsActivity}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/5">
            <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
              {t.statsActiveDays.replace('{count}', String(activeDays))}
            </Text>
          </View>
          <View
            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: colors.successSubtle }}
          >
            <Flame color={colors.success} size={11} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="text-[11px] font-medium" style={{ color: colors.success }}>
              {t.statsHotDays.replace('{count}', String(hotDays))}
            </Text>
          </View>
        </View>
      </View>
      <Text className="text-[11px] leading-4 mb-2 px-0.5" style={{ color: colors.tertiaryText }}>
        {t.statsHeatmapHint}
      </Text>
      {/* Center the grid precisely */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: GAP, width: gridWidth }}>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ gap: GAP }}>
              {week.map((day, di) => {
                const cellStyle = {
                  backgroundColor: heatmapColors[day.level] || heatmapColors[0],
                  borderRadius: 3,
                  height: cellSize,
                  width: cellSize,
                };
                return (
                  <Pressable
                    delayLongPress={380}
                    key={`${wi}-${di}`}
                    accessibilityLabel={t.statsHeatmapCellA11y
                      .replace('{date}', day.date)
                      .replace('{level}', String(day.level))}
                    onLongPress={() => {
                      Alert.alert(
                        t.statsHeatmapDayTitle,
                        t.statsHeatmapDayMessage
                          .replace('{date}', formatDate(day.date))
                          .replace('{count}', String(day.count))
                          .replace('{level}', String(day.level)),
                      );
                    }}
                  >
                    <View style={cellStyle} />
                  </Pressable>
                );
              })}
              {Array.from({ length: 7 - week.length }).map((_, pi) => (
                <View
                  key={`pad-${wi}-${pi}`}
                  style={{
                    backgroundColor: colors.fillTertiary,
                    borderRadius: 3,
                    height: cellSize,
                    width: cellSize,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function getProviderFromModelId(modelId: string): string | undefined {
  if (modelId.includes('/')) return modelId.split('/')[0];
  const lower = modelId.toLowerCase();
  if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3')) return 'openai';
  if (lower.startsWith('claude')) return 'anthropic';
  if (lower.startsWith('gemini')) return 'google';
  if (lower.startsWith('deepseek')) return 'deepseek';
  return undefined;
}

function ModelLogo({ providerId }: { providerId: string }) {
  const colors = useThemeColors();
  const [err, setErr] = React.useState(false);
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const url = getProviderIconUrl(providerId, effectiveTheme);
  if (err)
    return (
      <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>
        {providerId.slice(0, 2)}
      </Text>
    );
  return (
    <RNImage
      source={{ uri: url }}
      style={{ width: 20, height: 20, borderRadius: 4 }}
      onError={() => setErr(true)}
    />
  );
}

function RankSection({
  data,
  icon,
  loading,
  onRowPress,
  title,
  modelLogos,
}: {
  data: StatsRankRow[];
  icon: React.ReactNode;
  loading: boolean;
  onRowPress?: (row: StatsRankRow) => void;
  title: string;
  modelLogos?: Array<{ providerId?: string }>;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const maxCount = data.length > 0 ? data[0].count : 1;
  const rankMedals = [colors.primary, colors.primaryFocused, colors.primaryMuted];

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-3">
        {icon}
        <Text className="text-foreground text-[15px] font-semibold tracking-tight">{title}</Text>
      </View>
      {loading ? (
        <View className="h-20 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : data.length === 0 ? (
        <View className="py-8 items-center rounded-2xl bg-foreground/[0.02]">
          <Text className="text-[13px] font-medium" style={{ color: colors.secondaryText }}>
            {t.statsEmpty}
          </Text>
          <Text className="text-[11px] mt-1" style={{ color: colors.tertiaryText }}>
            {t.statsEmptyDesc}
          </Text>
        </View>
      ) : (
        <View className="rounded-2xl overflow-hidden bg-foreground/[0.02] px-3 py-2">
          {data.slice(0, 5).map((item, i) => {
            const providerId = modelLogos?.[i]?.providerId ?? getProviderFromModelId(item.name);
            const rowKey = item.topicId ? `topic-${item.topicId}` : `rank-${i}-${item.name}`;
            const rowBody = (
              <>
                <View
                  className="w-8 h-8 items-center justify-center rounded-full mr-2"
                  style={{ backgroundColor: colors.primarySubtle }}
                >
                  {providerId ? (
                    <ModelLogo providerId={providerId} />
                  ) : i < 3 ? (
                    <Crown color={rankMedals[i]} fill={rankMedals[i]} size={14} />
                  ) : (
                    <Text className="text-[12px] font-bold" style={{ color: colors.secondaryText }}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text
                      className="text-foreground text-[13px] font-medium flex-1"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="text-[12px] font-semibold tabular-nums ml-2"
                      style={{ color: colors.secondaryText }}
                    >
                      {item.count}
                    </Text>
                  </View>
                  <View className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: colors.primary,
                        width: `${Math.max((item.count / maxCount) * 100, 4)}%`,
                      }}
                    />
                  </View>
                </View>
              </>
            );
            return onRowPress ? (
              <TouchableOpacity
                activeOpacity={0.65}
                className="flex-row items-center py-2"
                key={rowKey}
                onPress={() => onRowPress(item)}
              >
                {rowBody}
              </TouchableOpacity>
            ) : (
              <View className="flex-row items-center py-2" key={rowKey}>
                {rowBody}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────────────

interface StatsData {
  heatmap: HeatmapDay[];
  messages: number;
  modelRank: ModelRankItem[];
  prevMessages: number;
  prevSessions: number;
  prevTopics: number;
  prevWords: number;
  registration: UserRegistrationDuration | null;
  sessionRank: SessionRankItem[];
  sessions: number;
  topicRank: TopicRankItem[];
  topics: number;
  words: number;
}

type StatsScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Stats'>;

export default function StatsScreen({ navigation }: { navigation: StatsScreenNavigation }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const contentWidth = Math.min(Math.max(screenWidth - 40, 0), responsiveMetrics.settingsMaxWidth);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StatsData>({
    messages: 0,
    prevMessages: 0,
    sessions: 0,
    prevSessions: 0,
    topics: 0,
    prevTopics: 0,
    words: 0,
    prevWords: 0,
    registration: null,
    heatmap: [],
    modelRank: [],
    sessionRank: [],
    topicRank: [],
  });

  const prevMonthEnd = lastMonthEnd();

  const fetchAll = useCallback(async (): Promise<boolean> => {
    const settled = await Promise.allSettled([
      statsApi.countMessages(),
      statsApi.countMessages({ endDate: prevMonthEnd }),
      statsApi.countSessions(),
      statsApi.countSessions({ endDate: prevMonthEnd }),
      statsApi.countTopics(),
      statsApi.countTopics({ endDate: prevMonthEnd }),
      statsApi.countWords(),
      statsApi.countWords({ endDate: prevMonthEnd }),
      statsApi.getRegistrationDuration(),
      statsApi.getHeatmaps(),
      statsApi.rankModels(),
      statsApi.rankSessions(),
      statsApi.rankTopics(),
    ]);

    if (settled.every((s) => s.status === 'rejected')) {
      return false;
    }

    setData({
      messages: settledNumber(settled[0]),
      prevMessages: settledNumber(settled[1]),
      sessions: settledNumber(settled[2]),
      prevSessions: settledNumber(settled[3]),
      topics: settledNumber(settled[4]),
      prevTopics: settledNumber(settled[5]),
      words: settledNumber(settled[6]),
      prevWords: settledNumber(settled[7]),
      registration: settledRegistration(settled[8]),
      heatmap: settledArray<HeatmapDay>(settled[9]),
      modelRank: settledArray<ModelRankItem>(settled[10]),
      sessionRank: settledArray<SessionRankItem>(settled[11]),
      topicRank: settledArray<TopicRankItem>(settled[12]),
    });
    return true;
  }, [prevMonthEnd]);

  useEffect(() => {
    void (async () => {
      const ok = await fetchAll();
      setLoading(false);
      setLoadError(!ok);
    })();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const ok = await fetchAll();
    setLoadError(!ok);
    setRefreshing(false);
  }, [fetchAll]);

  const handleRetry = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    const ok = await fetchAll();
    setLoading(false);
    setLoadError(!ok);
  }, [fetchAll]);

  const modelRankSectionData = useMemo(
    () => data.modelRank.map((m) => ({ count: m.count, name: m.id })),
    [data.modelRank],
  );
  const modelRankLogos = useMemo(
    () =>
      data.modelRank.map((m) => {
        const pid = getProviderFromModelId(m.id);
        return pid ? { providerId: pid } : {};
      }),
    [data.modelRank],
  );
  const sessionRankSectionData = useMemo(
    () =>
      data.sessionRank.map((s) => ({
        count: s.count,
        name: s.title || t.statsRankUntitled,
      })),
    [data.sessionRank, t.statsRankUntitled],
  );
  const topicRankSectionData = useMemo(
    () =>
      data.topicRank.map((tp) => ({
        count: tp.count,
        name: tp.title || t.statsRankUntitled,
        sessionId: tp.sessionId,
        topicId: tp.id,
      })),
    [data.topicRank, t.statsRankUntitled],
  );

  const handleTopicRankPress = useCallback(
    (row: StatsRankRow) => {
      if (!row.topicId) return;
      navigation.navigate('ChatDetail', {
        sessionId: row.sessionId || INBOX_SESSION_ID,
        topicId: row.topicId,
      });
    },
    [navigation],
  );

  const regDays = data.registration?.duration;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.statsTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
      >
        {loadError && (
          <TouchableOpacity
            activeOpacity={0.85}
            className="mb-3 px-3 py-2.5 rounded-xl flex-row items-center justify-between"
            style={{ backgroundColor: colors.primarySubtle, width: contentWidth }}
            onPress={() => void handleRetry()}
          >
            <Text
              className="text-[13px] font-medium flex-1 pr-2"
              style={{ color: colors.secondaryText }}
            >
              {t.statsLoadFailed}
            </Text>
            <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
              {t.statsRetry}
            </Text>
          </TouchableOpacity>
        )}

        {/* Welcome Banner — show whenever load succeeded (full or partial) */}
        {!loading && !loadError && (
          <Animated.View
            entering={FadeInDown.delay(30).duration(300)}
            style={{ width: contentWidth }}
          >
            <View
              className="mb-5 rounded-2xl p-4"
              style={{ backgroundColor: colors.primarySubtle }}
            >
              <Text className="text-foreground text-[16px] font-semibold leading-6">
                {regDays != null && regDays > 0
                  ? t.statsWelcome.replace('{days}', String(regDays))
                  : t.statsWelcomeFallback}
              </Text>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-2">
                {data.registration?.createdAt ? (
                  <View className="flex-row items-center gap-1">
                    <Clock3 color={colors.muted} size={11} strokeWidth={tokens.icon.strokeWidth} />
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.statsCreatedAt} · {formatDate(data.registration.createdAt)}
                    </Text>
                  </View>
                ) : null}
                {data.registration?.updatedAt ? (
                  <View className="flex-row items-center gap-1">
                    <ClockArrowUp
                      color={colors.muted}
                      size={11}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.secondaryText }}
                    >
                      {t.statsUpdatedAt} · {formatDate(data.registration.updatedAt)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Overview Cards — order matches web: Assistants, Topics, Messages, Words */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(300)}
          style={{ width: contentWidth }}
        >
          <View className="mb-5">
            <View className="flex-row">
              <StatCard
                iconKey="sessions"
                loading={loading}
                prevValue={data.prevSessions}
                title={t.statsTotalSessions}
                value={data.sessions}
              />
              <StatCard
                iconKey="topics"
                loading={loading}
                prevValue={data.prevTopics}
                title={t.statsTotalTopics}
                value={data.topics}
              />
              <StatCard
                iconKey="messages"
                loading={loading}
                prevValue={data.prevMessages}
                title={t.statsTotalMessages}
                value={data.messages}
              />
              <StatCard
                iconKey="words"
                loading={loading}
                prevValue={data.prevWords}
                title={t.statsTotalWords}
                value={data.words}
              />
            </View>
            {!loading && !loadError ? (
              <Text
                className="text-center text-[10px] font-medium mt-1.5"
                style={{ color: colors.tertiaryText }}
              >
                {t.statsVsPrevMonth}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        {/* Activity Heatmap */}
        <Animated.View
          entering={FadeInDown.delay(90).duration(300)}
          style={{ width: contentWidth }}
        >
          <View className="mb-6">
            <MiniHeatmap availableWidth={contentWidth} data={data.heatmap} loading={loading} />
          </View>
        </Animated.View>

        {/* Rankings */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(300)}
          style={{ width: contentWidth }}
        >
          <View>
            <RankSection
              data={modelRankSectionData}
              loading={loading}
              modelLogos={modelRankLogos}
              title={t.statsModelsRank}
              icon={
                <Trophy color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              }
            />
            <RankSection
              data={sessionRankSectionData}
              loading={loading}
              title={t.statsAssistantsRank}
              icon={
                <MessageSquare
                  color={colors.primary}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              }
            />
            <RankSection
              data={topicRankSectionData}
              loading={loading}
              title={t.statsTopicsRank}
              icon={
                <BookOpen color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              }
              onRowPress={handleTopicRankPress}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
