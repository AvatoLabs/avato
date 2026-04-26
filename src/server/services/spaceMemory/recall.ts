import type { UserMemoryData } from '@lobechat/context-engine';
import type { SearchMemoryResult } from '@lobechat/types';

import type { PublishedSpaceMemoryRecallEntry } from '@/database/models/spaceMemory';
import type { ServerUserMemoryConfig } from '@/server/modules/Mecha/ContextEngineering/types';
import { calculateWeightedLength, truncateByWeightedLength } from '@/utils/textLength';

type RecallEntryCategory = PublishedSpaceMemoryRecallEntry['category'];
type RecallPackagingOptions = {
  query?: string | null;
};

const RECALL_SEGMENT_SEPARATOR = '\n\n';
const RECALL_TRUNCATION_SUFFIX = '...';
const RECALL_TRUNCATION_SUFFIX_WEIGHT = calculateWeightedLength(RECALL_TRUNCATION_SUFFIX);
const FALLBACK_RECALL_TITLE = 'Shared memory';
const RECALL_INTENT_KEYWORDS: Record<RecallEntryCategory, string[]> = {
  general: [
    'background',
    'cadence',
    'context',
    'history',
    'overview',
    'status',
    'summary',
    'why',
    '背景',
    '上下文',
    '历史',
    '概况',
    '现状',
    '说明',
  ],
  playbook: [
    'checklist',
    'drill',
    'how',
    'playbook',
    'procedure',
    'process',
    'rollback',
    'runbook',
    'sop',
    'steps',
    'workflow',
    '处理',
    '如何',
    '怎么',
    '操作',
    '排查',
    '步骤',
    '流程',
    '演练',
    '预案',
    '回滚',
  ],
  policy: [
    'allowed',
    'approval',
    'approve',
    'can ',
    'compliance',
    'eta',
    'governance',
    'guideline',
    'must',
    'permission',
    'policy',
    'promise',
    'rule',
    'should',
    '审批',
    '批准',
    '合规',
    '政策',
    '规范',
    '规则',
    '要求',
    '必须',
    '应该',
    '能否',
    '可以',
    '允许',
    '禁止',
  ],
};
const RECALL_PACKAGING_MULTIPLIERS = {
  dominant: 1.35,
  nonDominant: 0.85,
  totalDominant: 1.4,
  totalNonDominant: 0.8,
} as const;
const SPACE_MEMORY_RECALL_PACKAGING: Record<
  RecallEntryCategory,
  { action?: number; detail: number; suggestion?: number; title: number }
> = {
  general: {
    detail: 360,
    title: 120,
  },
  playbook: {
    action: 240,
    detail: 280,
    title: 120,
  },
  policy: {
    detail: 320,
    suggestion: 180,
    title: 120,
  },
};
const SPACE_MEMORY_RECALL_TOTAL_BUDGETS: Record<RecallEntryCategory, number> = {
  general: 720,
  playbook: 560,
  policy: 640,
};
const tokenizeRecallQuery = (query?: string | null) =>
  normalizeText(query)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter(Boolean);

const normalizeText = (value?: string | null) =>
  value
    ?.replaceAll('\r\n', '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || '';

const splitRecallUnits = (value?: string | null) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);

  return paragraphs.flatMap((paragraph) => {
    const sentences = paragraph
      .match(/[^。！？!?.]+[。！？!?.]?/g)
      ?.map((item) => item.trim())
      .filter(Boolean);

    return sentences && sentences.length > 0 ? sentences : [paragraph];
  });
};

const compactRecallText = (
  values: Array<string | null | undefined>,
  maxWeightedLength: number,
): string => {
  const deduped: string[] = [];

  for (const value of values) {
    for (const unit of splitRecallUnits(value)) {
      if (!unit || deduped.includes(unit)) continue;
      deduped.push(unit);
    }
  }

  if (deduped.length === 0 || maxWeightedLength <= 0) return '';

  let result = '';

  for (const value of deduped) {
    const separator = result ? RECALL_SEGMENT_SEPARATOR : '';
    const availableWeight =
      maxWeightedLength - calculateWeightedLength(result) - calculateWeightedLength(separator);

    if (availableWeight <= 0) break;

    const nextWeight = calculateWeightedLength(value);

    if (nextWeight <= availableWeight) {
      result += separator + value;
      continue;
    }

    const truncationBudget = availableWeight - RECALL_TRUNCATION_SUFFIX_WEIGHT;
    if (truncationBudget <= 0) break;

    const truncated = truncateByWeightedLength(value, truncationBudget).trimEnd();
    if (!truncated) break;

    result += separator + truncated + RECALL_TRUNCATION_SUFFIX;
    break;
  }

  return result;
};

const detectRecallIntentCategory = (query?: string | null): RecallEntryCategory | null => {
  const normalizedQuery = normalizeText(query).toLowerCase();
  if (!normalizedQuery) return null;

  const queryTerms = tokenizeRecallQuery(query);
  const scores: Record<RecallEntryCategory, number> = {
    general: 0,
    playbook: 0,
    policy: 0,
  };

  for (const [category, keywords] of Object.entries(RECALL_INTENT_KEYWORDS) as Array<
    [RecallEntryCategory, string[]]
  >) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) scores[category] += 2;
    }
  }

  for (const term of queryTerms) {
    for (const [category, keywords] of Object.entries(RECALL_INTENT_KEYWORDS) as Array<
      [RecallEntryCategory, string[]]
    >) {
      if (keywords.some((keyword) => keyword.trim() === term)) scores[category] += 1;
    }
  }

  const ranked = (Object.entries(scores) as Array<[RecallEntryCategory, number]>).sort(
    (left, right) => right[1] - left[1],
  );

  if ((ranked[0]?.[1] ?? 0) <= 0) return null;
  if ((ranked[0]?.[1] ?? 0) === (ranked[1]?.[1] ?? 0)) return null;

  return ranked[0]![0];
};

const resolveRecallPackagingBudget = (params: {
  category: RecallEntryCategory;
  dominantCategory: RecallEntryCategory | null;
  field: keyof (typeof SPACE_MEMORY_RECALL_PACKAGING)[RecallEntryCategory];
}) => {
  const base = SPACE_MEMORY_RECALL_PACKAGING[params.category][params.field];
  if (!base) return 0;
  if (!params.dominantCategory || params.field === 'title') return base;

  const multiplier =
    params.category === params.dominantCategory
      ? RECALL_PACKAGING_MULTIPLIERS.dominant
      : RECALL_PACKAGING_MULTIPLIERS.nonDominant;

  return Math.max(80, Math.round(base * multiplier));
};

const resolveRecallTotalBudgets = (dominantCategory: RecallEntryCategory | null) => {
  if (!dominantCategory) return { ...SPACE_MEMORY_RECALL_TOTAL_BUDGETS };

  return Object.fromEntries(
    (Object.entries(SPACE_MEMORY_RECALL_TOTAL_BUDGETS) as Array<[RecallEntryCategory, number]>).map(
      ([category, budget]) => [
        category,
        Math.max(
          240,
          Math.round(
            budget *
              (category === dominantCategory
                ? RECALL_PACKAGING_MULTIPLIERS.totalDominant
                : RECALL_PACKAGING_MULTIPLIERS.totalNonDominant),
          ),
        ),
      ],
    ),
  ) as Record<RecallEntryCategory, number>;
};

const buildCompactRecallTitle = (
  entry: PublishedSpaceMemoryRecallEntry,
  dominantCategory: RecallEntryCategory | null,
) =>
  compactRecallText(
    [entry.title],
    resolveRecallPackagingBudget({
      category: entry.category,
      dominantCategory,
      field: 'title',
    }),
  ) ||
  FALLBACK_RECALL_TITLE;

const buildCompactRecallDetail = (
  entry: PublishedSpaceMemoryRecallEntry,
  dominantCategory: RecallEntryCategory | null,
) => {
  switch (entry.category) {
    case 'general':
    case 'playbook': {
      return (
        compactRecallText(
          [entry.summary, entry.content],
          resolveRecallPackagingBudget({
            category: entry.category,
            dominantCategory,
            field: 'detail',
          }),
        ) || buildCompactRecallTitle(entry, dominantCategory)
      );
    }
    case 'policy': {
      return (
        compactRecallText(
          [entry.title, entry.summary, entry.content],
          resolveRecallPackagingBudget({
            category: 'policy',
            dominantCategory,
            field: 'detail',
          }),
        ) || buildCompactRecallTitle(entry, dominantCategory)
      );
    }
  }
};

const buildCompactRecallAction = (
  entry: PublishedSpaceMemoryRecallEntry,
  dominantCategory: RecallEntryCategory | null,
) =>
  compactRecallText(
    [entry.content ?? entry.summary],
    resolveRecallPackagingBudget({
      category: 'playbook',
      dominantCategory,
      field: 'action',
    }) || resolveRecallPackagingBudget({
      category: 'playbook',
      dominantCategory,
      field: 'detail',
    }),
  ) || null;

const buildCompactRecallSuggestion = (
  entry: PublishedSpaceMemoryRecallEntry,
  dominantCategory: RecallEntryCategory | null,
) =>
  compactRecallText(
    [entry.summary, entry.title],
    resolveRecallPackagingBudget({
      category: 'policy',
      dominantCategory,
      field: 'suggestion',
    }) || resolveRecallPackagingBudget({
      category: 'policy',
      dominantCategory,
      field: 'title',
    }),
  ) || null;

const getRecallPayloadWeight = (...values: Array<string | null | undefined>) =>
  values.reduce((total, value) => total + calculateWeightedLength(value?.trim() || ''), 0);

export const buildUserMemoryDataFromSpaceMemory = (
  entries: PublishedSpaceMemoryRecallEntry[],
  options?: RecallPackagingOptions,
): Pick<UserMemoryData, 'contexts' | 'experiences' | 'preferences'> => {
  const contexts: NonNullable<UserMemoryData['contexts']> = [];
  const experiences: NonNullable<UserMemoryData['experiences']> = [];
  const preferences: NonNullable<UserMemoryData['preferences']> = [];
  const dominantCategory = detectRecallIntentCategory(options?.query);
  const remainingBudget = resolveRecallTotalBudgets(dominantCategory);

  for (const entry of entries) {
    switch (entry.category) {
      case 'general': {
        const title = buildCompactRecallTitle(entry, dominantCategory);
        const description = buildCompactRecallDetail(entry, dominantCategory);
        const nextWeight = getRecallPayloadWeight(title, description);

        if (contexts.length > 0 && nextWeight > remainingBudget.general) break;

        remainingBudget.general = Math.max(0, remainingBudget.general - nextWeight);
        contexts.push({
          description,
          id: entry.id,
          title,
        });
        break;
      }
      case 'playbook': {
        const situation = buildCompactRecallTitle(entry, dominantCategory);
        const keyLearning = buildCompactRecallDetail(entry, dominantCategory);
        const action = buildCompactRecallAction(entry, dominantCategory);
        const nextWeight = getRecallPayloadWeight(situation, keyLearning, action);

        if (experiences.length > 0 && nextWeight > remainingBudget.playbook) break;

        remainingBudget.playbook = Math.max(0, remainingBudget.playbook - nextWeight);
        experiences.push({
          action,
          id: entry.id,
          keyLearning,
          situation,
        });
        break;
      }
      case 'policy': {
        const conclusionDirectives = buildCompactRecallDetail(entry, dominantCategory);
        const suggestions = buildCompactRecallSuggestion(entry, dominantCategory);
        const nextWeight = getRecallPayloadWeight(conclusionDirectives, suggestions);

        if (preferences.length > 0 && nextWeight > remainingBudget.policy) break;

        remainingBudget.policy = Math.max(0, remainingBudget.policy - nextWeight);
        preferences.push({
          conclusionDirectives,
          id: entry.id,
          suggestions,
        });
        break;
      }
    }
  }

  return {
    contexts,
    experiences,
    preferences,
  };
};

export const hasInjectedSpaceMemory = (
  data: Pick<UserMemoryData, 'contexts' | 'experiences' | 'preferences'>,
) => data.contexts.length > 0 || data.experiences.length > 0 || data.preferences.length > 0;

export const mergeServerUserMemoryConfig = (
  base: ServerUserMemoryConfig | undefined,
  extra: Pick<UserMemoryData, 'contexts' | 'experiences' | 'preferences'>,
): ServerUserMemoryConfig => ({
  fetchedAt: Date.now(),
  memories: {
    contexts: [...(base?.memories?.contexts ?? []), ...extra.contexts],
    experiences: [...(base?.memories?.experiences ?? []), ...extra.experiences],
    ...(base?.memories?.identities ? { identities: base.memories.identities } : {}),
    ...(base?.memories?.persona ? { persona: base.memories.persona } : {}),
    preferences: [...(base?.memories?.preferences ?? []), ...extra.preferences],
  },
});

const parseRecallDate = (value?: string | null) => (value ? new Date(value) : new Date());

const buildSearchMemoryResultFromSpaceMemory = (
  entries: PublishedSpaceMemoryRecallEntry[],
  options?: RecallPackagingOptions,
): SearchMemoryResult => {
  const contexts: SearchMemoryResult['contexts'] = [];
  const experiences: SearchMemoryResult['experiences'] = [];
  const preferences: SearchMemoryResult['preferences'] = [];
  const dominantCategory = detectRecallIntentCategory(options?.query);
  const remainingBudget = resolveRecallTotalBudgets(dominantCategory);

  for (const entry of entries) {
    const timestamp = parseRecallDate(entry.publishedAt ?? entry.updatedAt);

    switch (entry.category) {
      case 'general': {
        const title = buildCompactRecallTitle(entry, dominantCategory);
        const description = buildCompactRecallDetail(entry, dominantCategory);
        const nextWeight = getRecallPayloadWeight(title, description);

        if (contexts.length > 0 && nextWeight > remainingBudget.general) break;

        remainingBudget.general = Math.max(0, remainingBudget.general - nextWeight);
        contexts.push({
          accessedAt: timestamp,
          associatedObjects: null,
          associatedSubjects: null,
          createdAt: timestamp,
          currentStatus: null,
          description,
          id: entry.id,
          metadata: { source: 'space_memory' },
          scoreImpact: null,
          scoreUrgency: null,
          tags: null,
          title,
          type: 'space_memory',
          updatedAt: parseRecallDate(entry.updatedAt),
          userMemoryIds: null,
        });
        break;
      }
      case 'playbook': {
        const situation = buildCompactRecallTitle(entry, dominantCategory);
        const keyLearning = buildCompactRecallDetail(entry, dominantCategory);
        const action = buildCompactRecallAction(entry, dominantCategory);
        const nextWeight = getRecallPayloadWeight(situation, keyLearning, action);

        if (experiences.length > 0 && nextWeight > remainingBudget.playbook) break;

        remainingBudget.playbook = Math.max(0, remainingBudget.playbook - nextWeight);
        experiences.push({
          accessedAt: timestamp,
          action,
          createdAt: timestamp,
          id: entry.id,
          keyLearning,
          metadata: { source: 'space_memory' },
          possibleOutcome: null,
          reasoning: null,
          scoreConfidence: null,
          situation,
          tags: null,
          type: 'space_memory',
          updatedAt: parseRecallDate(entry.updatedAt),
          userMemoryId: null,
        });
        break;
      }
      case 'policy': {
        const conclusionDirectives = buildCompactRecallDetail(entry, dominantCategory);
        const suggestions = buildCompactRecallSuggestion(entry, dominantCategory);
        const nextWeight = getRecallPayloadWeight(conclusionDirectives, suggestions);

        if (preferences.length > 0 && nextWeight > remainingBudget.policy) break;

        remainingBudget.policy = Math.max(0, remainingBudget.policy - nextWeight);
        preferences.push({
          accessedAt: timestamp,
          conclusionDirectives,
          createdAt: timestamp,
          id: entry.id,
          metadata: { source: 'space_memory' },
          scorePriority: null,
          suggestions,
          tags: null,
          type: 'space_memory',
          updatedAt: parseRecallDate(entry.updatedAt),
          userMemoryId: null,
        });
        break;
      }
    }
  }

  return {
    activities: [],
    contexts,
    experiences,
    preferences,
  };
};

const dedupeById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const mergeRetrieveMemoryResultWithSpaceMemory = (
  base: SearchMemoryResult,
  entries: PublishedSpaceMemoryRecallEntry[],
  options?: RecallPackagingOptions,
): SearchMemoryResult => {
  const extra = buildSearchMemoryResultFromSpaceMemory(entries, options);

  return {
    activities: base.activities,
    contexts: dedupeById([...base.contexts, ...extra.contexts]),
    experiences: dedupeById([...base.experiences, ...extra.experiences]),
    preferences: dedupeById([...base.preferences, ...extra.preferences]),
  };
};
