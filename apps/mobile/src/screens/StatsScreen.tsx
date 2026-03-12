/**
 * StatsScreen — Usage statistics aligned with web /settings/stats.
 *
 * Sections:
 *  1. Welcome banner (registration duration)
 *  2. Overview cards (Messages, Assistants, Topics, Words) — from server
 *  3. Activity heatmap (simplified grid for React Native)
 *  4. Rankings: Models / Assistants / Topics top-5
 */
import { ArrowLeft, Flame, MessageSquare, Trophy } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '../components/ui/ScreenHeader';
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
  d.setDate(0); // last day of previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function percentChange(current: number, prev: number): string | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return '+∞';
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// ── Sub-components ───────────────────────────────────────────────────

function StatCard({
  title,
  value,
  prevValue,
  loading,
}: {
  loading: boolean;
  prevValue?: number;
  title: string;
  value: number;
}) {
  const { t } = useI18n();
  const pct = prevValue !== undefined ? percentChange(value, prevValue) : null;
  const isPositive = pct?.startsWith('+');

  return (
    <View className="flex-1 py-4 items-center">
      {loading ? (
        <ActivityIndicator color="#999" size="small" />
      ) : (
        <>
          <Text className="text-foreground text-[22px] font-bold tracking-tight">
            {formatNumber(value)}
          </Text>
          <Text className="text-secondary/50 text-[11px] font-semibold mt-1">{title}</Text>
          {pct && (
            <Text
              className={`text-[10px] font-medium mt-0.5 ${isPositive ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}
            >
              {pct} {t.statsVsPrevMonth}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const HEATMAP_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function MiniHeatmap({ data, loading }: { data: HeatmapDay[]; loading: boolean }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <View className="h-20 items-center justify-center">
        <ActivityIndicator color="#999" size="small" />
      </View>
    );
  }

  // Show last 20 weeks (140 days) to fit mobile width
  const recent = data.slice(-140);
  const activeDays = data.filter((d) => d.level > 0).length;
  const hotDays = data.filter((d) => d.level >= 3).length;

  // Build 7-row grid (Mon-Sun), each column = 1 week
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < recent.length; i += 7) {
    weeks.push(recent.slice(i, i + 7));
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-foreground text-[15px] font-semibold tracking-tight">
          {t.statsActivity}
        </Text>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-[2px]">
          {weeks.map((week, wi) => (
            <View className="gap-[2px]" key={wi}>
              {week.map((day, di) => (
                <View
                  key={`${wi}-${di}`}
                  style={{
                    backgroundColor: HEATMAP_COLORS[day.level] || HEATMAP_COLORS[0],
                    borderRadius: 2,
                    height: 8,
                    width: 8,
                  }}
                />
              ))}
              {/* Pad short weeks */}
              {Array.from({ length: 7 - week.length }).map((_, pi) => (
                <View
                  key={`pad-${wi}-${pi}`}
                  style={{ backgroundColor: '#ebedf0', borderRadius: 2, height: 8, width: 8 }}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RankSection({
  data,
  icon,
  loading,
  title,
}: {
  data: { count: number; name: string }[];
  icon: React.ReactNode;
  loading: boolean;
  title: string;
}) {
  const { t } = useI18n();
  const maxCount = data.length > 0 ? data[0].count : 1;

  return (
    <View className="mb-5">
      <View className="flex-row items-center gap-2 mb-3">
        {icon}
        <Text className="text-foreground text-[15px] font-semibold tracking-tight">{title}</Text>
      </View>
      {loading ? (
        <View className="h-20 items-center justify-center">
          <ActivityIndicator color="#999" size="small" />
        </View>
      ) : data.length === 0 ? (
        <View className="py-6 items-center">
          <Text className="text-secondary/40 text-[13px] font-medium">{t.statsEmpty}</Text>
          <Text className="text-secondary/30 text-[11px] mt-1">{t.statsEmptyDesc}</Text>
        </View>
      ) : (
        data.slice(0, 5).map((item, i) => (
          <View className="flex-row items-center mb-2" key={i}>
            <Text className="text-secondary/50 text-[12px] font-bold w-5 text-center">{i + 1}</Text>
            <View className="flex-1 mx-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-foreground text-[13px] font-medium flex-1" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-secondary/60 text-[12px] font-medium ml-2">{item.count}</Text>
              </View>
              <View className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
                />
              </View>
            </View>
          </View>
        ))
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

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
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
        {data.registration?.duration && (
          <Animated.View entering={FadeInDown.delay(30).duration(300)}>
            <View className="px-5 mb-4">
              <Text className="text-foreground text-[15px] font-medium">
                {t.statsWelcome.replace('{days}', String(data.registration.duration))}
              </Text>
              <View className="flex-row gap-4 mt-1">
                {data.registration.createdAt && (
                  <Text className="text-secondary/50 text-[11px] font-medium">
                    {t.statsCreatedAt}: {data.registration.createdAt.split('T')[0]}
                  </Text>
                )}
                {data.registration.updatedAt && (
                  <Text className="text-secondary/50 text-[11px] font-medium">
                    {t.statsUpdatedAt}: {data.registration.updatedAt.split('T')[0]}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Overview Cards */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <View className="px-5 mb-5">
            <View className="flex-row">
              <StatCard
                loading={loading}
                prevValue={data.prevMessages}
                title={t.statsTotalMessages}
                value={data.messages}
              />
              <StatCard
                loading={loading}
                prevValue={data.prevSessions}
                title={t.statsTotalSessions}
                value={data.sessions}
              />
              <StatCard
                loading={loading}
                prevValue={data.prevTopics}
                title={t.statsTotalTopics}
                value={data.topics}
              />
              <StatCard
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
              loading={loading}
              title={t.statsModelsRank}
              icon={<Trophy color="#f5a623" size={16} strokeWidth={tokens.icon.strokeWidth} />}
            />
            <RankSection
              loading={loading}
              title={t.statsAssistantsRank}
              data={data.sessionRank.map((s) => ({
                count: s.count,
                name: s.title || 'Untitled',
              }))}
              icon={
                <MessageSquare color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
              }
            />
            <RankSection
              loading={loading}
              title={t.statsTopicsRank}
              data={data.topicRank.map((tp) => ({
                count: tp.count,
                name: tp.title || 'Untitled',
              }))}
              icon={
                <MessageSquare color="#34c759" size={16} strokeWidth={tokens.icon.strokeWidth} />
              }
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
