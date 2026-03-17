/**
 * StatsScreen — Usage statistics aligned with web /settings/stats.
 *
 * Sections:
 *  1. Welcome banner (registration duration)
 *  2. Overview cards (Messages, Assistants, Topics, Words) — from server
 *  3. Activity heatmap (simplified grid for React Native)
 *  4. Rankings: Models / Assistants / Topics top-5
 */
import {
  ArrowLeft,
  BarChart3,
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
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { getProviderIconUrl } from '../constants/cdn';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { semanticColors } from '../constants/colors';
import { statsApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';
import type {
  HeatmapDay,
  ModelRankItem,
  SessionRankItem,
  TopicRankItem,
  UserRegistrationDuration,
} from '../types';

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

function percentChange(current: number, prev: number): string | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return '+∞';
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function formatDate(iso?: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ── Sub-components ───────────────────────────────────────────────────

const BLUE = '#007aff';
const BLUE_BG = 'rgba(0,122,255,0.08)';
const STAT_ICONS: Record<string, { bg: string; color: string; icon: any }> = {
  messages: { icon: MessageSquare, color: BLUE, bg: BLUE_BG },
  sessions: { icon: Sparkles, color: BLUE, bg: BLUE_BG },
  topics: { icon: BookOpen, color: BLUE, bg: BLUE_BG },
  words: { icon: Zap, color: BLUE, bg: BLUE_BG },
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
  const pct = prevValue !== undefined ? percentChange(value, prevValue) : null;
  const isPositive = pct?.startsWith('+');
  const meta = STAT_ICONS[iconKey] || STAT_ICONS.messages;
  const IconComp = meta.icon;

  return (
    <View
      className="flex-1 items-center rounded-2xl py-3 mx-1"
      style={{ backgroundColor: meta.bg }}
    >
      {loading ? (
        <ActivityIndicator color={BLUE} size="small" />
      ) : (
        <>
          <View
            className="rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: meta.bg, width: 32, height: 32 }}
          >
            <IconComp color={meta.color} size={16} strokeWidth={tokens.icon.strokeWidth} />
          </View>
          <Text className="text-foreground text-[20px] font-bold tracking-tight">
            {formatNumber(value)}
          </Text>
          <Text className="text-secondary/50 text-[11px] font-medium mt-0.5">{title}</Text>
          {pct && (
            <Text
              className={`text-[10px] font-medium mt-0.5 ${isPositive ? 'text-primary' : 'text-secondary/70'}`}
            >
              {pct}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const HEATMAP_COLORS = ['#ebedf0', '#b3d9ff', '#66b3ff', '#3399ff', '#007aff'];

function MiniHeatmap({ data, loading }: { data: HeatmapDay[]; loading: boolean }) {
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const SECTION_PX = 20;
  const containerWidth = screenWidth - SECTION_PX * 2;

  if (loading) {
    return (
      <View className="h-24 items-center justify-center">
        <ActivityIndicator color={BLUE} size="small" />
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
          <CalendarDays color={BLUE} size={15} strokeWidth={tokens.icon.strokeWidth} />
          <Text className="text-foreground text-[15px] font-semibold tracking-tight">
            {t.statsActivity}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/5">
            <Text className="text-secondary/70 text-[11px] font-medium">
              {t.statsActiveDays.replace('{count}', String(activeDays))}
            </Text>
          </View>
          <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-[#34c759]/10">
            <Flame color="#34c759" size={11} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="text-[#34c759] text-[11px] font-medium">
              {t.statsHotDays.replace('{count}', String(hotDays))}
            </Text>
          </View>
        </View>
      </View>
      {/* Center the grid precisely */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: GAP, width: gridWidth }}>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ gap: GAP }}>
              {week.map((day, di) => (
                <View
                  key={`${wi}-${di}`}
                  style={{
                    backgroundColor: HEATMAP_COLORS[day.level] || HEATMAP_COLORS[0],
                    borderRadius: 3,
                    height: cellSize,
                    width: cellSize,
                  }}
                />
              ))}
              {Array.from({ length: 7 - week.length }).map((_, pi) => (
                <View
                  key={`pad-${wi}-${pi}`}
                  style={{
                    backgroundColor: '#ebedf0',
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

const RANK_MEDALS = ['#007aff', '#3399ff', '#66b3ff'];

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
  const [err, setErr] = React.useState(false);
  const url = getProviderIconUrl(providerId);
  if (err) return <Text className="text-primary text-[10px] font-bold">{providerId.slice(0, 2)}</Text>;
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
  title,
  modelLogos,
}: {
  data: { count: number; name: string }[];
  icon: React.ReactNode;
  loading: boolean;
  title: string;
  modelLogos?: Array<{ providerId?: string }>;
}) {
  const { t } = useI18n();
  const maxCount = data.length > 0 ? data[0].count : 1;

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-3">
        {icon}
        <Text className="text-foreground text-[15px] font-semibold tracking-tight">{title}</Text>
      </View>
      {loading ? (
        <View className="h-20 items-center justify-center">
          <ActivityIndicator color={BLUE} size="small" />
        </View>
      ) : data.length === 0 ? (
        <View className="py-8 items-center rounded-2xl bg-foreground/[0.02]">
          <Text className="text-secondary/40 text-[13px] font-medium">{t.statsEmpty}</Text>
          <Text className="text-secondary/25 text-[11px] mt-1">{t.statsEmptyDesc}</Text>
        </View>
      ) : (
        <View className="rounded-2xl overflow-hidden bg-foreground/[0.02] px-3 py-2">
          {data.slice(0, 5).map((item, i) => {
            const providerId = modelLogos?.[i]?.providerId ?? getProviderFromModelId(item.name);
            return (
              <View className="flex-row items-center py-2" key={i}>
                <View className="w-8 h-8 items-center justify-center rounded-full bg-primary/10 mr-2">
                  {providerId ? (
                    <ModelLogo providerId={providerId} />
                  ) : i < 3 ? (
                    <Crown color={RANK_MEDALS[i]} fill={RANK_MEDALS[i]} size={14} />
                  ) : (
                    <Text className="text-secondary/40 text-[12px] font-bold">{i + 1}</Text>
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
                    <Text className="text-secondary/50 text-[12px] font-semibold tabular-nums ml-2">
                      {item.count}
                    </Text>
                  </View>
                  <View className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                    <View
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
                    />
                  </View>
                </View>
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

export default function StatsScreen({ navigation }: any) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
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

  const fetchAll = useCallback(async () => {
    try {
      const [
        messages,
        prevMessages,
        sessions,
        prevSessions,
        topics,
        prevTopics,
        words,
        prevWords,
        registration,
        heatmap,
        modelRank,
        sessionRank,
        topicRank,
      ] = await Promise.all([
        statsApi.countMessages().catch(() => 0),
        statsApi.countMessages({ endDate: prevMonthEnd }).catch(() => 0),
        statsApi.countSessions().catch(() => 0),
        statsApi.countSessions({ endDate: prevMonthEnd }).catch(() => 0),
        statsApi.countTopics().catch(() => 0),
        statsApi.countTopics({ endDate: prevMonthEnd }).catch(() => 0),
        statsApi.countWords().catch(() => 0),
        statsApi.countWords({ endDate: prevMonthEnd }).catch(() => 0),
        statsApi.getRegistrationDuration().catch(() => null),
        statsApi.getHeatmaps().catch(() => []),
        statsApi.rankModels().catch(() => []),
        statsApi.rankSessions().catch(() => []),
        statsApi.rankTopics().catch(() => []),
      ]);
      setData({
        messages: messages as number,
        prevMessages: prevMessages as number,
        sessions: sessions as number,
        prevSessions: prevSessions as number,
        topics: topics as number,
        prevTopics: prevTopics as number,
        words: words as number,
        prevWords: prevWords as number,
        registration: registration as UserRegistrationDuration | null,
        heatmap: (heatmap || []) as HeatmapDay[],
        modelRank: (modelRank || []) as ModelRankItem[],
        sessionRank: (sessionRank || []) as SessionRankItem[],
        topicRank: (topicRank || []) as TopicRankItem[],
      });
    } catch {
      /* ignore */
    }
  }, [prevMonthEnd]);

  useEffect(() => {
    fetchAll().then(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const regDays = data.registration?.duration;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color={semanticColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />}
        title={t.statsTitle}
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={['#007aff']}
            refreshing={refreshing}
            tintColor="#007aff"
            onRefresh={onRefresh}
          />
        }
      >
        {/* Welcome Banner */}
        {regDays && (
          <Animated.View entering={FadeInDown.delay(30).duration(300)}>
            <View className="mx-5 mb-5 p-4 rounded-2xl bg-primary/[0.06]">
              <Text className="text-foreground text-[16px] font-semibold leading-6">
                {t.statsWelcome.replace('{days}', String(regDays))}
              </Text>
              <View className="flex-row gap-4 mt-2">
                {data.registration?.createdAt && (
                  <View className="flex-row items-center gap-1">
                    <Clock3 color={semanticColors.muted} size={11} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="text-secondary/50 text-[11px] font-medium">
                      {formatDate(data.registration.createdAt)}
                    </Text>
                  </View>
                )}
                {data.registration?.updatedAt && (
                  <View className="flex-row items-center gap-1">
                    <ClockArrowUp color={semanticColors.muted} size={11} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="text-secondary/50 text-[11px] font-medium">
                      {formatDate(data.registration.updatedAt)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Overview Cards */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <View className="px-4 mb-5">
            <View className="flex-row">
              <StatCard
                iconKey="messages"
                loading={loading}
                prevValue={data.prevMessages}
                title={t.statsTotalMessages}
                value={data.messages}
              />
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
                iconKey="words"
                loading={loading}
                prevValue={data.prevWords}
                title={t.statsTotalWords}
                value={data.words}
              />
            </View>
          </View>
        </Animated.View>

        {/* Activity Heatmap */}
        <Animated.View entering={FadeInDown.delay(90).duration(300)}>
          <View className="px-5 mb-6">
            <MiniHeatmap data={data.heatmap} loading={loading} />
          </View>
        </Animated.View>

        {/* Rankings */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)}>
          <View className="px-5">
            <RankSection
              data={data.modelRank.map((m) => ({ count: m.count, name: m.id }))}
              icon={<Trophy color={BLUE} size={16} strokeWidth={tokens.icon.strokeWidth} />}
              loading={loading}
              modelLogos={data.modelRank.map((m) => {
                const pid = getProviderFromModelId(m.id);
                return pid ? { providerId: pid } : {};
              })}
              title={t.statsModelsRank}
            />
            <RankSection
              loading={loading}
              title={t.statsAssistantsRank}
              data={data.sessionRank.map((s) => ({
                count: s.count,
                name: s.title || 'Untitled',
              }))}
              icon={<MessageSquare color={BLUE} size={16} strokeWidth={tokens.icon.strokeWidth} />}
            />
            <RankSection
              loading={loading}
              title={t.statsTopicsRank}
              data={data.topicRank.map((tp) => ({
                count: tp.count,
                name: tp.title || 'Untitled',
              }))}
              icon={<BookOpen color={BLUE} size={16} strokeWidth={tokens.icon.strokeWidth} />}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
