import { and, count, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { spaceMemoryEntries, users } from '../schemas';
import type { LobeChatDatabase } from '../type';

type SpaceMemorySection = 'inbox' | 'playbooks' | 'policies' | 'published';
type SpaceMemoryCategory = 'general' | 'playbook' | 'policy';
type SpaceMemorySourceKind = 'document' | 'file' | 'message' | 'source_set' | 'topic';
type SpaceMemoryRecallBlockedReason = 'disabled' | 'expired' | 'stale';
type SpaceMemoryRecallFilter = 'active' | 'all' | 'disabled' | 'expired' | 'stale';
type SpaceMemorySurface = 'personal' | 'reviewer' | 'viewer';
const DEFAULT_RECALL_LIMITS: Record<SpaceMemoryCategory, number> = {
  general: 4,
  playbook: 4,
  policy: 4,
};
const INTENT_AWARE_RECALL_LIMITS: Record<
  SpaceMemoryCategory,
  Record<SpaceMemoryCategory, number>
> = {
  general: {
    general: 6,
    playbook: 3,
    policy: 3,
  },
  playbook: {
    general: 3,
    playbook: 6,
    policy: 3,
  },
  policy: {
    general: 3,
    playbook: 3,
    policy: 6,
  },
};
const RECALL_INTENT_KEYWORDS: Record<SpaceMemoryCategory, string[]> = {
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

const wordSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : undefined;
const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'do',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
]);

const normalizeRecallText = (value?: string | null) => value?.toLowerCase().trim() || '';

const isMeaningfulRecallTerm = (term: string) => {
  if (!term) return false;
  if (/[a-z0-9]/i.test(term)) {
    if (ENGLISH_STOPWORDS.has(term)) return false;

    return term.length >= 3;
  }

  return term.length >= 2;
};

const tokenizeRecallQuery = (query?: string | null) => {
  const normalized = normalizeRecallText(query);
  if (!normalized) return [];

  const segmented = wordSegmenter
    ? Array.from(wordSegmenter.segment(normalized))
        .filter((item) => item.isWordLike)
        .map((item) => item.segment)
    : normalized.split(/[^\p{L}\p{N}]+/u);

  return [...new Set(segmented.map((item) => item.trim()).filter(isMeaningfulRecallTerm))];
};

const buildRecallPhrases = (queryTerms: string[]) => {
  const phrases: string[] = [];

  for (let start = 0; start < queryTerms.length; start += 1) {
    for (let size = 2; size <= 3; size += 1) {
      const phraseTerms = queryTerms.slice(start, start + size);
      if (phraseTerms.length !== size) continue;
      phrases.push(phraseTerms.join(' '));
    }
  }

  return [...new Set(phrases)];
};

const detectRecallIntentCategory = (
  query?: string | null,
  queryTerms: string[] = tokenizeRecallQuery(query),
): SpaceMemoryCategory | null => {
  const normalizedQuery = normalizeRecallText(query);
  if (!normalizedQuery) return null;

  const scores: Record<SpaceMemoryCategory, number> = {
    general: 0,
    playbook: 0,
    policy: 0,
  };

  for (const [category, keywords] of Object.entries(RECALL_INTENT_KEYWORDS) as Array<
    [SpaceMemoryCategory, string[]]
  >) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) scores[category] += 2;
    }
  }

  for (const term of queryTerms) {
    for (const [category, keywords] of Object.entries(RECALL_INTENT_KEYWORDS) as Array<
      [SpaceMemoryCategory, string[]]
    >) {
      if (keywords.some((keyword) => keyword.trim() === term)) scores[category] += 1;
    }
  }

  const ranked = (Object.entries(scores) as Array<[SpaceMemoryCategory, number]>).sort(
    (left, right) => right[1] - left[1],
  );

  if ((ranked[0]?.[1] ?? 0) <= 0) return null;
  if ((ranked[0]?.[1] ?? 0) === (ranked[1]?.[1] ?? 0)) return null;

  return ranked[0]![0];
};

const resolveRecallLimits = (
  limitByCategory: Partial<Record<SpaceMemoryCategory, number>> | undefined,
  query?: string | null,
): Record<SpaceMemoryCategory, number> => {
  if (limitByCategory && Object.keys(limitByCategory).length > 0) {
    return {
      ...DEFAULT_RECALL_LIMITS,
      ...limitByCategory,
    };
  }

  const dominantCategory = detectRecallIntentCategory(query);

  return dominantCategory ? { ...INTENT_AWARE_RECALL_LIMITS[dominantCategory] } : DEFAULT_RECALL_LIMITS;
};

const scoreRecallEntry = (
  row: {
    content?: string | null;
    summary?: string | null;
    title?: string | null;
  },
  queryTerms: string[],
) => {
  if (queryTerms.length === 0) return 0;

  const title = normalizeRecallText(row.title);
  const summary = normalizeRecallText(row.summary);
  const content = normalizeRecallText(row.content);
  const recallPhrases = buildRecallPhrases(queryTerms);
  const matchedTerms = new Set<string>();

  const lexicalScore = queryTerms.reduce((score, term) => {
    let next = score;

    if (title.includes(term)) {
      next += 6;
      matchedTerms.add(term);
    }
    if (summary.includes(term)) {
      next += 4;
      matchedTerms.add(term);
    }
    if (content.includes(term)) {
      next += 2;
      matchedTerms.add(term);
    }

    return next;
  }, 0);

  const phraseScore = recallPhrases.reduce((score, phrase) => {
    let next = score;

    if (title.includes(phrase)) next += 14;
    if (summary.includes(phrase)) next += 10;
    if (content.includes(phrase)) next += 6;

    return next;
  }, 0);

  const coverageRatio = matchedTerms.size / queryTerms.length;
  const coverageScore = matchedTerms.size * 3;
  const coverageBonus = coverageRatio >= 0.8 ? 8 : coverageRatio >= 0.5 ? 4 : 0;

  return lexicalScore + phraseScore + coverageScore + coverageBonus;
};

const toISOStringOrNull = (value?: Date | string | null) => {
  if (value instanceof Date) return value.toISOString();

  return value ?? null;
};

const isSameTimestamp = (left?: Date | string | null, right?: Date | string | null) => {
  if (!left && !right) return true;
  if (!left || !right) return false;

  return new Date(left).getTime() === new Date(right).getTime();
};

export interface PublishedSpaceMemoryRecallEntry {
  category: SpaceMemoryCategory;
  content?: string | null;
  id: string;
  publishedAt?: string | null;
  summary?: string | null;
  title: string;
  updatedAt: string;
}

type SpaceMemoryGovernanceHistoryItem = {
  action: 'merged' | 'policy_updated' | 'published';
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  };
  at: string;
  changes?: {
    content?: { after?: string | null; before?: string | null };
    expiresAt?: { after?: string | null; before?: string | null };
    lastVerifiedAt?: { after?: string | null; before?: string | null };
    recallEnabled?: { after?: boolean | null; before?: boolean | null };
    staleAt?: { after?: string | null; before?: string | null };
    summary?: { after?: string | null; before?: string | null };
    title?: { after?: string | null; before?: string | null };
  };
  resolution?: {
    appendSources?: boolean;
    applyContent?: boolean;
    applySummary?: boolean;
    applyTitle?: boolean;
  };
  sourceTitle?: string | null;
};

interface SpaceMemorySummary {
  canCreate: boolean;
  canPublish: boolean;
  canReview: boolean;
  contract?: {
    canAccessAudit: boolean;
    canCreate: boolean;
    canManageRecall: boolean;
    canViewInbox: boolean;
    detailViews: ('audit' | 'overview')[];
    recallFilters: ('active' | 'all' | 'disabled' | 'expired' | 'stale')[];
    sections: SpaceMemorySection[];
  };
  id: string;
  kind?: 'personal' | 'team' | string | null;
  membershipRole?: string | null;
  name?: string | null;
  surface: SpaceMemorySurface;
  sections: Record<
    SpaceMemorySection,
    {
      count: number;
      recall: {
        active: number;
        disabled: number;
        expired: number;
        stale: number;
      };
    }
  >;
}

interface SpaceMemorySectionResult {
  items: {
    category: SpaceMemoryCategory;
    actor?: {
      id?: string | null;
      name?: string | null;
      username?: string | null;
    };
    content?: string | null;
    history?: SpaceMemoryGovernanceHistoryItem[];
    id: string;
    intake?: {
      origin?: 'automation' | 'harness' | 'manual';
      producer?: string | null;
      traceId?: string | null;
    };
    kind: 'candidate' | 'memory';
    publishedAt?: string | null;
    recall?: {
      expiresAt?: string | null;
      lastVerifiedAt?: string | null;
      recallBlockedReason?: SpaceMemoryRecallBlockedReason;
      recallEnabled: boolean;
      staleAt?: string | null;
    };
    reviewHint?: {
      kind: 'duplicate_published';
      mergePreview: {
        addedSourceCount: number;
        updatesContent: boolean;
        updatesSummary: boolean;
        updatesTitle: boolean;
      };
      match: {
        content?: string | null;
        id: string;
        publishedAt?: string | null;
        summary?: string | null;
        title: string;
      };
    };
    sourceCount: number;
    sourceRefs: {
      id: string;
      kind: SpaceMemorySourceKind;
      title?: string;
    }[];
    summary?: string | null;
    title: string;
    updatedAt: string;
  }[];
  section: SpaceMemorySection;
}

type SpaceMemoryEntryPreviewItem = SpaceMemorySectionResult['items'][number];

type SpaceMemoryBatchSkipReason =
  | 'already_stale'
  | 'already_reviewed'
  | 'not_found'
  | 'not_published'
  | 'outside_space';

interface SpaceMemoryBatchActionResult {
  id: string;
  reason?: SpaceMemoryBatchSkipReason;
  reviewedBy?: string;
  status: 'archived' | 'published' | 'revalidated' | 'skipped' | 'stale';
}

interface SpaceMemoryEntryDetailRow {
  category: SpaceMemoryCategory;
  content?: string | null;
  createdBy?: string | null;
  expiresAt?: Date | string | null;
  id: string;
  lastVerifiedAt?: Date | string | null;
  metadata?: Record<string, unknown> | null;
  publishedAt?: Date | string | null;
  recallEnabled?: boolean | null;
  reviewedBy?: string | null;
  sourceRefs?:
    | {
        id: string;
        kind: SpaceMemorySourceKind;
        title?: string;
      }[]
    | null;
  staleAt?: Date | string | null;
  status: 'candidate' | 'published';
  summary?: string | null;
  title?: string | null;
  updatedAt?: Date | string | null;
}

interface DuplicatePublishedMatch {
  content?: string | null;
  id: string;
  publishedAt?: string | null;
  sourceRefs?: {
    id: string;
    kind: SpaceMemorySourceKind;
    title?: string;
  }[];
  summary?: string | null;
  title: string;
}

export class SpaceMemoryModel {
  private readonly db: LobeChatDatabase;
  private readonly userId?: string;

  constructor(db: LobeChatDatabase, userId?: string) {
    this.db = db;
    this.userId = userId;
  }

  private mergeSourceRefs = (
    sourceRefs: {
      id: string;
      kind: SpaceMemorySourceKind;
      title?: string;
    }[] = [],
  ) => {
    const deduped = new Map<
      string,
      {
        id: string;
        kind: SpaceMemorySourceKind;
        title?: string;
      }
    >();

    for (const item of sourceRefs) {
      const key = `${item.kind}:${item.id}`;
      const existing = deduped.get(key);

      deduped.set(key, {
        ...existing,
        ...item,
        title: item.title ?? existing?.title,
      });
    }

    return [...deduped.values()];
  };

  private getGovernanceHistory = (metadata?: Record<string, unknown> | null) => {
    const history = (metadata as any)?.governance?.history;
    if (!Array.isArray(history)) return [] as SpaceMemoryGovernanceHistoryItem[];

    return history
      .filter((item): item is SpaceMemoryGovernanceHistoryItem => {
        return Boolean(
          item &&
          typeof item === 'object' &&
          (item as any).action &&
          (item as any).at &&
          typeof (item as any).action === 'string' &&
          typeof (item as any).at === 'string',
        );
      })
      .slice(0, 5);
  };

  private getUserIdentity = async (userId: string) => {
    const [user] = await this.db
      .select({
        fullName: users.fullName,
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return { id: userId };

    return {
      id: user.id,
      name: user.fullName ?? null,
      username: user.username ?? null,
    };
  };

  private getUserIdentities = async (userIds: string[]) => {
    if (userIds.length === 0)
      return new Map<string, Awaited<ReturnType<typeof this.getUserIdentity>>>();

    const rows = await this.db
      .select({
        fullName: users.fullName,
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(inArray(users.id, [...new Set(userIds)]));

    const userMap = new Map<string, Awaited<ReturnType<typeof this.getUserIdentity>>>();

    for (const row of rows) {
      userMap.set(row.id, {
        id: row.id,
        name: row.fullName ?? null,
        username: row.username ?? null,
      });
    }

    for (const userId of userIds) {
      if (!userMap.has(userId)) {
        userMap.set(userId, { id: userId });
      }
    }

    return userMap;
  };

  private appendGovernanceHistory = (
    metadata: Record<string, unknown> | null | undefined,
    historyItem: SpaceMemoryGovernanceHistoryItem,
  ) => {
    const nextHistory = [historyItem, ...this.getGovernanceHistory(metadata)].slice(0, 5);
    const baseMetadata = metadata ?? undefined;
    const governance = (metadata as any)?.governance;

    return {
      ...baseMetadata,
      governance: {
        ...governance,
        history: nextHistory,
      },
    };
  };

  private getRecallPolicy = (params: {
    expiresAt?: Date | string | null;
    lastVerifiedAt?: Date | string | null;
    now?: Date;
    recallEnabled?: boolean | null;
    staleAt?: Date | string | null;
    status: 'archived' | 'candidate' | 'published';
  }) => {
    if (params.status !== 'published') return undefined;

    const recallEnabled = params.recallEnabled !== false;
    const expiresAt = toISOStringOrNull(params.expiresAt);
    const lastVerifiedAt = toISOStringOrNull(params.lastVerifiedAt);
    const staleAt = toISOStringOrNull(params.staleAt);
    const now = params.now ?? new Date();
    const recallBlockedReason: SpaceMemoryRecallBlockedReason | undefined = !recallEnabled
      ? 'disabled'
      : staleAt
        ? 'stale'
        : expiresAt && new Date(expiresAt).getTime() <= now.getTime()
          ? 'expired'
          : undefined;

    return {
      expiresAt,
      lastVerifiedAt,
      recallBlockedReason,
      recallEnabled,
      staleAt,
    };
  };

  private buildSectionWhere = (spaceId: string, section: SpaceMemorySection) => {
    switch (section) {
      case 'inbox': {
        return and(
          eq(spaceMemoryEntries.spaceId, spaceId),
          eq(spaceMemoryEntries.status, 'candidate'),
        );
      }
      case 'published': {
        return and(
          eq(spaceMemoryEntries.spaceId, spaceId),
          eq(spaceMemoryEntries.status, 'published'),
          eq(spaceMemoryEntries.category, 'general'),
        );
      }
      case 'playbooks': {
        return and(
          eq(spaceMemoryEntries.spaceId, spaceId),
          eq(spaceMemoryEntries.status, 'published'),
          eq(spaceMemoryEntries.category, 'playbook'),
        );
      }
      case 'policies': {
        return and(
          eq(spaceMemoryEntries.spaceId, spaceId),
          eq(spaceMemoryEntries.status, 'published'),
          eq(spaceMemoryEntries.category, 'policy'),
        );
      }
    }
  };

  private buildRecallFilterWhere = (recallFilter: SpaceMemoryRecallFilter, now: Date) => {
    if (recallFilter === 'all') return undefined;

    const recallEnabledWhere = or(
      eq(spaceMemoryEntries.recallEnabled, true),
      isNull(spaceMemoryEntries.recallEnabled),
    );

    switch (recallFilter) {
      case 'active': {
        return and(
          recallEnabledWhere,
          isNull(spaceMemoryEntries.staleAt),
          or(isNull(spaceMemoryEntries.expiresAt), gt(spaceMemoryEntries.expiresAt, now)),
        );
      }
      case 'disabled': {
        return eq(spaceMemoryEntries.recallEnabled, false);
      }
      case 'expired': {
        return and(
          recallEnabledWhere,
          isNull(spaceMemoryEntries.staleAt),
          lte(spaceMemoryEntries.expiresAt, now),
        );
      }
      case 'stale': {
        return and(recallEnabledWhere, sql`${spaceMemoryEntries.staleAt} is not null`);
      }
    }
  };

  private buildEntryDetailWhere = (spaceId: string, ids: string[]) =>
    and(
      eq(spaceMemoryEntries.spaceId, spaceId),
      inArray(spaceMemoryEntries.id, ids),
      or(eq(spaceMemoryEntries.status, 'candidate'), eq(spaceMemoryEntries.status, 'published')),
    );

  private fetchEntryDetailRows = async (params: {
    ids: string[];
    spaceId: string;
  }): Promise<SpaceMemoryEntryDetailRow[]> => {
    if (params.ids.length === 0) return [] as SpaceMemoryEntryDetailRow[];

    return this.db
      .select({
        category: spaceMemoryEntries.category,
        content: spaceMemoryEntries.content,
        createdBy: spaceMemoryEntries.createdBy,
        expiresAt: spaceMemoryEntries.expiresAt,
        id: spaceMemoryEntries.id,
        lastVerifiedAt: spaceMemoryEntries.lastVerifiedAt,
        metadata: spaceMemoryEntries.metadata,
        publishedAt: spaceMemoryEntries.publishedAt,
        recallEnabled: spaceMemoryEntries.recallEnabled,
        reviewedBy: spaceMemoryEntries.reviewedBy,
        staleAt: spaceMemoryEntries.staleAt,
        sourceRefs: spaceMemoryEntries.sourceRefs,
        status: spaceMemoryEntries.status,
        summary: spaceMemoryEntries.summary,
        title: spaceMemoryEntries.title,
        updatedAt: spaceMemoryEntries.updatedAt,
      })
      .from(spaceMemoryEntries)
      .where(this.buildEntryDetailWhere(params.spaceId, params.ids)) as Promise<
      SpaceMemoryEntryDetailRow[]
    >;
  };

  private buildDuplicatePublishedMap = async (
    rows: SpaceMemoryEntryDetailRow[],
    spaceId: string,
  ): Promise<Map<string, DuplicatePublishedMatch>> => {
    const candidateSummaries = [
      ...new Set(
        rows.flatMap((row) =>
          row.status === 'candidate' && row.summary?.trim()
            ? [`${row.category}::${row.summary.trim()}`]
            : [],
        ),
      ),
    ];

    if (candidateSummaries.length === 0) {
      return new Map<string, DuplicatePublishedMatch>();
    }

    const summaries = [
      ...new Set(candidateSummaries.map((item) => item.slice(item.indexOf('::') + 2))),
    ];

    const matches = await this.db
      .select({
        category: spaceMemoryEntries.category,
        content: spaceMemoryEntries.content,
        id: spaceMemoryEntries.id,
        publishedAt: spaceMemoryEntries.publishedAt,
        sourceRefs: spaceMemoryEntries.sourceRefs,
        summary: spaceMemoryEntries.summary,
        title: spaceMemoryEntries.title,
      })
      .from(spaceMemoryEntries)
      .where(
        and(
          eq(spaceMemoryEntries.spaceId, spaceId),
          eq(spaceMemoryEntries.status, 'published'),
          inArray(spaceMemoryEntries.summary, summaries),
        ),
      )
      .orderBy(desc(spaceMemoryEntries.publishedAt));

    const duplicateMap = new Map<string, DuplicatePublishedMatch>();

    for (const match of matches) {
      if (!match.summary?.trim()) continue;

      const key = `${match.category}::${match.summary.trim()}`;
      if (duplicateMap.has(key)) continue;

      duplicateMap.set(key, {
        content: match.content,
        id: match.id,
        publishedAt:
          match.publishedAt instanceof Date
            ? match.publishedAt.toISOString()
            : (match.publishedAt ?? null),
        sourceRefs: match.sourceRefs ?? [],
        summary: match.summary,
        title: match.title,
      });
    }

    return duplicateMap;
  };

  private buildEntryPreviewItems = async (
    rows: SpaceMemoryEntryDetailRow[],
    spaceId: string,
  ): Promise<SpaceMemoryEntryPreviewItem[]> => {
    const actorMap = await this.getUserIdentities(
      rows.flatMap((row) => {
        const actorId = row.status === 'candidate' ? row.createdBy : row.reviewedBy;
        return actorId ? [actorId] : [];
      }),
    );
    const duplicatePublishedByKey = await this.buildDuplicatePublishedMap(rows, spaceId);

    return rows.map((row) => {
      const kind = row.status === 'candidate' ? 'candidate' : 'memory';
      const actorId = kind === 'candidate' ? row.createdBy : row.reviewedBy;
      const actor = actorId ? (actorMap.get(actorId) ?? { id: actorId }) : undefined;

      const reviewHint =
        kind === 'candidate' && row.summary?.trim()
          ? (() => {
              const match = duplicatePublishedByKey.get(`${row.category}::${row.summary.trim()}`);

              return match
                ? {
                    kind: 'duplicate_published' as const,
                    match: {
                      content: match.content,
                      id: match.id,
                      publishedAt: match.publishedAt,
                      summary: match.summary,
                      title: match.title,
                    },
                    mergePreview: {
                      addedSourceCount:
                        row.sourceRefs?.filter(
                          (item) =>
                            !match.sourceRefs?.some(
                              (target) => target.kind === item.kind && target.id === item.id,
                            ),
                        ).length ?? 0,
                      updatesContent: Boolean(row.content?.trim()) && row.content !== match.content,
                      updatesSummary:
                        Boolean(row.summary?.trim()) &&
                        row.summary?.trim() !== match.summary?.trim(),
                      updatesTitle: Boolean(row.title?.trim()) && row.title !== match.title,
                    },
                  }
                : undefined;
            })()
          : undefined;

      return {
        actor,
        category: row.category,
        content: row.content,
        history: this.getGovernanceHistory((row.metadata as any) ?? undefined),
        id: row.id,
        intake: ((row.metadata as any)?.intake as any)
          ? {
              origin: (row.metadata as any).intake.origin,
              producer: (row.metadata as any).intake.producer ?? null,
              traceId: (row.metadata as any).intake.traceId ?? null,
            }
          : undefined,
        kind,
        publishedAt: toISOStringOrNull(row.publishedAt),
        recall: this.getRecallPolicy({
          expiresAt: row.expiresAt,
          lastVerifiedAt: row.lastVerifiedAt,
          recallEnabled: row.recallEnabled,
          staleAt: row.staleAt,
          status: row.status,
        }),
        reviewHint,
        sourceCount: row.sourceRefs?.length ?? 0,
        sourceRefs: row.sourceRefs ?? [],
        summary: row.summary,
        title: row.title || row.content || '',
        updatedAt:
          row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString(),
      };
    });
  };

  getSummary = async (params: {
    contract: NonNullable<SpaceMemorySummary['contract']>;
    id: string;
    kind?: SpaceMemorySummary['kind'];
    membershipRole?: SpaceMemorySummary['membershipRole'];
    name?: SpaceMemorySummary['name'];
    surface: SpaceMemorySummary['surface'];
  }): Promise<SpaceMemorySummary> => {
    const now = new Date();
    const emptyRecall = {
      active: 0,
      disabled: 0,
      expired: 0,
      stale: 0,
    };
    const createRecallSummaryQuery = (section: Exclude<SpaceMemorySection, 'inbox'>) =>
      this.db
        .select({
          active: sql<number>`cast(sum(case when ${spaceMemoryEntries.recallEnabled} is not false and ${spaceMemoryEntries.staleAt} is null and (${spaceMemoryEntries.expiresAt} is null or ${spaceMemoryEntries.expiresAt} > ${now}) then 1 else 0 end) as int)`,
          count: count(),
          disabled: sql<number>`cast(sum(case when ${spaceMemoryEntries.recallEnabled} is false then 1 else 0 end) as int)`,
          expired: sql<number>`cast(sum(case when ${spaceMemoryEntries.recallEnabled} is not false and ${spaceMemoryEntries.staleAt} is null and ${spaceMemoryEntries.expiresAt} is not null and ${spaceMemoryEntries.expiresAt} <= ${now} then 1 else 0 end) as int)`,
          stale: sql<number>`cast(sum(case when ${spaceMemoryEntries.recallEnabled} is not false and ${spaceMemoryEntries.staleAt} is not null then 1 else 0 end) as int)`,
        })
        .from(spaceMemoryEntries)
        .where(this.buildSectionWhere(params.id, section));
    const [inbox, published, playbooks, policies] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(spaceMemoryEntries)
        .where(this.buildSectionWhere(params.id, 'inbox')),
      createRecallSummaryQuery('published'),
      createRecallSummaryQuery('playbooks'),
      createRecallSummaryQuery('policies'),
    ]);

    return {
      canCreate: params.contract.canCreate,
      canPublish: params.contract.canManageRecall,
      canReview: params.contract.canManageRecall,
      contract: params.contract,
      id: params.id,
      kind: params.kind,
      membershipRole: params.membershipRole,
      name: params.name,
      surface: params.surface,
      sections: {
        inbox: { count: inbox[0]?.count ?? 0, recall: emptyRecall },
        playbooks: {
          count: playbooks[0]?.count ?? 0,
          recall: {
            active: playbooks[0]?.active ?? 0,
            disabled: playbooks[0]?.disabled ?? 0,
            expired: playbooks[0]?.expired ?? 0,
            stale: playbooks[0]?.stale ?? 0,
          },
        },
        policies: {
          count: policies[0]?.count ?? 0,
          recall: {
            active: policies[0]?.active ?? 0,
            disabled: policies[0]?.disabled ?? 0,
            expired: policies[0]?.expired ?? 0,
            stale: policies[0]?.stale ?? 0,
          },
        },
        published: {
          count: published[0]?.count ?? 0,
          recall: {
            active: published[0]?.active ?? 0,
            disabled: published[0]?.disabled ?? 0,
            expired: published[0]?.expired ?? 0,
            stale: published[0]?.stale ?? 0,
          },
        },
      },
    };
  };

  listEntries = async (params: {
    recallFilter?: SpaceMemoryRecallFilter;
    section: SpaceMemorySection;
    spaceId: string;
  }): Promise<SpaceMemorySectionResult> => {
    const recallFilter = params.section === 'inbox' ? 'all' : (params.recallFilter ?? 'all');
    const now = new Date();
    const sectionWhere = this.buildSectionWhere(params.spaceId, params.section);
    const recallWhere = this.buildRecallFilterWhere(recallFilter, now);
    const listWhere = recallWhere ? and(sectionWhere, recallWhere) : sectionWhere;
    const rows =
      params.section === 'inbox'
        ? await this.db
            .select({
              actorId: spaceMemoryEntries.createdBy,
              actorName: users.fullName,
              actorUsername: users.username,
              category: spaceMemoryEntries.category,
              content: spaceMemoryEntries.content,
              expiresAt: spaceMemoryEntries.expiresAt,
              id: spaceMemoryEntries.id,
              lastVerifiedAt: spaceMemoryEntries.lastVerifiedAt,
              metadata: spaceMemoryEntries.metadata,
              publishedAt: spaceMemoryEntries.publishedAt,
              recallEnabled: spaceMemoryEntries.recallEnabled,
              staleAt: spaceMemoryEntries.staleAt,
              sourceRefs: spaceMemoryEntries.sourceRefs,
              summary: spaceMemoryEntries.summary,
              title: spaceMemoryEntries.title,
              updatedAt: spaceMemoryEntries.updatedAt,
            })
            .from(spaceMemoryEntries)
            .leftJoin(users, eq(spaceMemoryEntries.createdBy, users.id))
            .where(listWhere)
            .orderBy(desc(spaceMemoryEntries.updatedAt))
            .limit(50)
        : await this.db
            .select({
              actorId: spaceMemoryEntries.reviewedBy,
              actorName: users.fullName,
              actorUsername: users.username,
              category: spaceMemoryEntries.category,
              content: spaceMemoryEntries.content,
              expiresAt: spaceMemoryEntries.expiresAt,
              id: spaceMemoryEntries.id,
              lastVerifiedAt: spaceMemoryEntries.lastVerifiedAt,
              metadata: spaceMemoryEntries.metadata,
              publishedAt: spaceMemoryEntries.publishedAt,
              recallEnabled: spaceMemoryEntries.recallEnabled,
              staleAt: spaceMemoryEntries.staleAt,
              sourceRefs: spaceMemoryEntries.sourceRefs,
              summary: spaceMemoryEntries.summary,
              title: spaceMemoryEntries.title,
              updatedAt: spaceMemoryEntries.updatedAt,
            })
            .from(spaceMemoryEntries)
            .leftJoin(users, eq(spaceMemoryEntries.reviewedBy, users.id))
            .where(listWhere)
            .orderBy(
              sql<number>`case when ${spaceMemoryEntries.staleAt} is not null then 0 else 1 end`,
              desc(spaceMemoryEntries.publishedAt),
            )
            .limit(50);

    const duplicatePublishedByKey =
      params.section !== 'inbox'
        ? new Map<string, DuplicatePublishedMatch>()
        : await (async () => {
            const candidateSummaries = [
              ...new Set(
                rows.flatMap((row) =>
                  row.summary?.trim() ? [`${row.category}::${row.summary.trim()}`] : [],
                ),
              ),
            ];

            if (!candidateSummaries.length) {
              return new Map<string, DuplicatePublishedMatch>();
            }

            const summaries = [
              ...new Set(candidateSummaries.map((item) => item.slice(item.indexOf('::') + 2))),
            ];

            const matches = await this.db
              .select({
                category: spaceMemoryEntries.category,
                id: spaceMemoryEntries.id,
                publishedAt: spaceMemoryEntries.publishedAt,
                content: spaceMemoryEntries.content,
                sourceRefs: spaceMemoryEntries.sourceRefs,
                summary: spaceMemoryEntries.summary,
                title: spaceMemoryEntries.title,
              })
              .from(spaceMemoryEntries)
              .where(
                and(
                  eq(spaceMemoryEntries.spaceId, params.spaceId),
                  eq(spaceMemoryEntries.status, 'published'),
                  inArray(spaceMemoryEntries.summary, summaries),
                ),
              )
              .orderBy(desc(spaceMemoryEntries.publishedAt));

            const duplicateMap = new Map<string, DuplicatePublishedMatch>();

            for (const match of matches) {
              if (!match.summary?.trim()) continue;

              const key = `${match.category}::${match.summary.trim()}`;
              if (duplicateMap.has(key)) continue;

              duplicateMap.set(key, {
                id: match.id,
                publishedAt:
                  match.publishedAt instanceof Date
                    ? match.publishedAt.toISOString()
                    : (match.publishedAt ?? null),
                content: match.content,
                sourceRefs: match.sourceRefs ?? [],
                summary: match.summary,
                title: match.title,
              });
            }

            return duplicateMap;
          })();

    return {
      items: rows.map((row) => {
        const kind = params.section === 'inbox' ? 'candidate' : 'memory';

        return {
          actor:
            row.actorId || row.actorName || row.actorUsername
              ? {
                  id: row.actorId,
                  name: row.actorName,
                  username: row.actorUsername,
                }
              : undefined,
          category: row.category,
          content: row.content,
          history: this.getGovernanceHistory((row.metadata as any) ?? undefined),
          id: row.id,
          intake: ((row.metadata as any)?.intake as any)
            ? {
                origin: (row.metadata as any).intake.origin,
                producer: (row.metadata as any).intake.producer ?? null,
                traceId: (row.metadata as any).intake.traceId ?? null,
              }
            : undefined,
          kind,
          publishedAt: toISOStringOrNull(row.publishedAt),
          recall: this.getRecallPolicy({
            expiresAt: row.expiresAt,
            lastVerifiedAt: row.lastVerifiedAt,
            recallEnabled: row.recallEnabled,
            staleAt: row.staleAt,
            status: kind === 'memory' ? 'published' : 'candidate',
          }),
          reviewHint:
            params.section === 'inbox' && row.summary?.trim()
              ? (() => {
                  const match = duplicatePublishedByKey.get(
                    `${row.category}::${row.summary.trim()}`,
                  );

                  return match
                    ? {
                        kind: 'duplicate_published' as const,
                        match: {
                          content: match.content,
                          id: match.id,
                          publishedAt: match.publishedAt,
                          summary: match.summary,
                          title: match.title,
                        },
                        mergePreview: {
                          addedSourceCount:
                            row.sourceRefs?.filter(
                              (item) =>
                                !match.sourceRefs?.some(
                                  (target: { id: string; kind: SpaceMemorySourceKind }) =>
                                    target.kind === item.kind && target.id === item.id,
                                ),
                            ).length ?? 0,
                          updatesContent:
                            Boolean(row.content?.trim()) && row.content !== match.content,
                          updatesSummary:
                            Boolean(row.summary?.trim()) &&
                            row.summary?.trim() !== match.summary?.trim(),
                          updatesTitle: Boolean(row.title?.trim()) && row.title !== match.title,
                        },
                      }
                    : undefined;
                })()
              : undefined,
          sourceCount: row.sourceRefs?.length ?? 0,
          sourceRefs: row.sourceRefs ?? [],
          summary: row.summary,
          title: row.title || row.content || '',
          updatedAt:
            row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString(),
        };
      }),
      section: params.section,
    };
  };

  getEntry = async (params: {
    id: string;
    spaceId: string;
  }): Promise<SpaceMemoryEntryPreviewItem | null> => {
    const [entry] = await this.getEntriesByIds({
      ids: [params.id],
      spaceId: params.spaceId,
    });

    return entry ?? null;
  };

  getEntriesByIds = async (params: {
    ids: string[];
    spaceId: string;
  }): Promise<SpaceMemoryEntryPreviewItem[]> => {
    const rows = await this.fetchEntryDetailRows(params);
    const items = await this.buildEntryPreviewItems(rows, params.spaceId);
    const itemMap = new Map(items.map((item) => [item.id, item]));

    return params.ids
      .map((id) => itemMap.get(id))
      .filter((item): item is SpaceMemoryEntryPreviewItem => Boolean(item));
  };

  listPublishedRecallEntries = async (params: {
    limitByCategory?: Partial<Record<SpaceMemoryCategory, number>>;
    query?: string;
    spaceId: string;
  }): Promise<PublishedSpaceMemoryRecallEntry[]> => {
    const now = new Date();
    const limits = resolveRecallLimits(params.limitByCategory, params.query);
    const queryTerms = tokenizeRecallQuery(params.query);

    const categories = (['general', 'playbook', 'policy'] as const).filter(
      (category) => (limits[category] ?? 0) > 0,
    );

    const rowsByCategory = await Promise.all(
      categories.map(async (category) => {
        const categoryLimit = limits[category] ?? DEFAULT_RECALL_LIMITS[category];
        const recallPoolSize =
          queryTerms.length > 0 ? Math.max(categoryLimit * 5, 10) : categoryLimit;
        const rows = await this.db
          .select({
            category: spaceMemoryEntries.category,
            content: spaceMemoryEntries.content,
            id: spaceMemoryEntries.id,
            publishedAt: spaceMemoryEntries.publishedAt,
            summary: spaceMemoryEntries.summary,
            title: spaceMemoryEntries.title,
            updatedAt: spaceMemoryEntries.updatedAt,
          })
          .from(spaceMemoryEntries)
          .where(
            and(
              eq(spaceMemoryEntries.spaceId, params.spaceId),
              eq(spaceMemoryEntries.status, 'published'),
              eq(spaceMemoryEntries.category, category),
              eq(spaceMemoryEntries.recallEnabled, true),
              isNull(spaceMemoryEntries.staleAt),
              or(isNull(spaceMemoryEntries.expiresAt), gt(spaceMemoryEntries.expiresAt, now)),
            ),
          )
          .orderBy(desc(spaceMemoryEntries.publishedAt), desc(spaceMemoryEntries.updatedAt))
          .limit(recallPoolSize);

        return rows
          .map((row) => ({
            recallScore: scoreRecallEntry(row, queryTerms),
            row,
          }))
          .sort((a, b) => {
            if (b.recallScore !== a.recallScore) return b.recallScore - a.recallScore;

            const publishedAtA =
              a.row.publishedAt instanceof Date ? a.row.publishedAt.getTime() : 0;
            const publishedAtB =
              b.row.publishedAt instanceof Date ? b.row.publishedAt.getTime() : 0;

            if (publishedAtB !== publishedAtA) return publishedAtB - publishedAtA;

            const updatedAtA = a.row.updatedAt instanceof Date ? a.row.updatedAt.getTime() : 0;
            const updatedAtB = b.row.updatedAt instanceof Date ? b.row.updatedAt.getTime() : 0;

            return updatedAtB - updatedAtA;
          })
          .slice(0, categoryLimit)
          .map(
            ({ row }): PublishedSpaceMemoryRecallEntry => ({
              category: row.category,
              content: row.content,
              id: row.id,
              publishedAt:
                row.publishedAt instanceof Date
                  ? row.publishedAt.toISOString()
                  : (row.publishedAt ?? null),
              summary: row.summary,
              title: row.title || row.summary || row.content || 'Shared memory',
              updatedAt:
                row.updatedAt instanceof Date
                  ? row.updatedAt.toISOString()
                  : new Date().toISOString(),
            }),
          );
      }),
    );

    return rowsByCategory.flat();
  };

  createCandidate = async (params: {
    category?: 'general' | 'playbook' | 'policy';
    content?: string | null;
    createdBy: string;
    metadata?: Record<string, unknown>;
    sourceRefs?: {
      id: string;
      kind: 'document' | 'file' | 'message' | 'source_set' | 'topic';
      title?: string;
    }[];
    spaceId: string;
    summary?: string | null;
    title: string;
  }) => {
    const [created] = await this.createCandidates([params]);

    return created;
  };

  createCandidates = async (
    params: {
      category?: 'general' | 'playbook' | 'policy';
      content?: string | null;
      createdBy: string;
      metadata?: Record<string, unknown>;
      sourceRefs?: {
        id: string;
        kind: 'document' | 'file' | 'message' | 'source_set' | 'topic';
        title?: string;
      }[];
      spaceId: string;
      summary?: string | null;
      title: string;
    }[],
  ) => {
    if (!params.length) return [];

    return this.db
      .insert(spaceMemoryEntries)
      .values(
        params.map((item) => ({
          category: item.category ?? 'general',
          content: item.content,
          createdBy: item.createdBy,
          metadata: item.metadata,
          sourceRefs: item.sourceRefs,
          spaceId: item.spaceId,
          status: 'candidate' as const,
          summary: item.summary,
          title: item.title,
          updatedBy: this.userId ?? item.createdBy,
        })),
      )
      .returning();
  };

  findExistingSourceSummaryEntry = async (params: {
    category?: 'general' | 'playbook' | 'policy';
    sourceRef: {
      id: string;
      kind: 'document' | 'file' | 'message' | 'source_set' | 'topic';
    };
    spaceId: string;
    summary: string;
  }) => {
    const [entry] = await this.db
      .select({
        id: spaceMemoryEntries.id,
        status: spaceMemoryEntries.status,
        summary: spaceMemoryEntries.summary,
      })
      .from(spaceMemoryEntries)
      .where(
        and(
          eq(spaceMemoryEntries.spaceId, params.spaceId),
          eq(spaceMemoryEntries.summary, params.summary),
          ...(params.category ? [eq(spaceMemoryEntries.category, params.category)] : []),
          or(
            eq(spaceMemoryEntries.status, 'candidate'),
            eq(spaceMemoryEntries.status, 'published'),
          ),
          sql`${spaceMemoryEntries.sourceRefs} @> ${JSON.stringify([params.sourceRef])}::jsonb`,
        ),
      )
      .limit(1);

    return entry ?? null;
  };

  findExistingTopicSummaryEntry = async (params: {
    spaceId: string;
    summary: string;
    topicId: string;
  }) =>
    this.findExistingSourceSummaryEntry({
      sourceRef: { id: params.topicId, kind: 'topic' },
      spaceId: params.spaceId,
      summary: params.summary,
    });

  private buildBatchActionResults = async (params: {
    ids: string[];
    insideSpaceSkipReason?: SpaceMemoryBatchSkipReason;
    reviewedBy: string;
    spaceId: string;
    successStatus: 'archived' | 'published' | 'revalidated';
    updatedRows: { id: string }[];
  }): Promise<SpaceMemoryBatchActionResult[]> => {
    if (!params.ids.length) return [];

    const matchedRows = await this.db
      .select({
        id: spaceMemoryEntries.id,
        spaceId: spaceMemoryEntries.spaceId,
        status: spaceMemoryEntries.status,
      })
      .from(spaceMemoryEntries)
      .where(inArray(spaceMemoryEntries.id, params.ids));

    const successIds = new Set(params.updatedRows.map((item) => item.id));
    const matchedById = new Map(matchedRows.map((item) => [item.id, item] as const));

    return params.ids.map((id) => {
      if (successIds.has(id)) {
        return {
          id,
          reviewedBy: params.reviewedBy,
          status: params.successStatus,
        };
      }

      const matched = matchedById.get(id);

      if (!matched) return { id, reason: 'not_found', status: 'skipped' };
      if (matched.spaceId !== params.spaceId) {
        return { id, reason: 'outside_space', status: 'skipped' };
      }

      return { id, reason: params.insideSpaceSkipReason ?? 'already_reviewed', status: 'skipped' };
    });
  };

  publishEntry = async (params: { id: string; reviewedBy: string; spaceId: string }) => {
    const reviewer = await this.getUserIdentity(params.reviewedBy);

    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [candidate] = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            eq(spaceMemoryEntries.id, params.id),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'candidate'),
          ),
        )
        .limit(1);

      if (!candidate) return null;

      const [updated] = await tx
        .update(spaceMemoryEntries)
        .set({
          expiresAt: null,
          lastVerifiedAt: now,
          metadata: this.appendGovernanceHistory(candidate.metadata ?? undefined, {
            action: 'published',
            actor: reviewer,
            at: now.toISOString(),
          }),
          publishedAt: now,
          recallEnabled: true,
          staleAt: null,
          reviewedBy: params.reviewedBy,
          status: 'published',
          updatedAt: now,
          updatedBy: params.reviewedBy,
        })
        .where(eq(spaceMemoryEntries.id, params.id))
        .returning();

      return updated;
    });
  };

  publishEntries = async (params: {
    ids: string[];
    reviewedBy: string;
    spaceId: string;
  }): Promise<SpaceMemoryBatchActionResult[]> => {
    if (!params.ids.length) return [];
    const reviewer = await this.getUserIdentity(params.reviewedBy);

    const updatedRows = await this.db.transaction(async (tx) => {
      const now = new Date();
      const candidates = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            inArray(spaceMemoryEntries.id, params.ids),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'candidate'),
          ),
        );

      const updated = [];

      for (const candidate of candidates) {
        const [row] = await tx
          .update(spaceMemoryEntries)
          .set({
            expiresAt: null,
            lastVerifiedAt: now,
            metadata: this.appendGovernanceHistory(candidate.metadata ?? undefined, {
              action: 'published',
              actor: reviewer,
              at: now.toISOString(),
            }),
            publishedAt: now,
            recallEnabled: true,
            staleAt: null,
            reviewedBy: params.reviewedBy,
            status: 'published',
            updatedAt: now,
            updatedBy: params.reviewedBy,
          })
          .where(eq(spaceMemoryEntries.id, candidate.id))
          .returning();

        if (row) updated.push(row);
      }

      return updated;
    });

    return this.buildBatchActionResults({
      ids: params.ids,
      reviewedBy: params.reviewedBy,
      spaceId: params.spaceId,
      successStatus: 'published',
      updatedRows,
    });
  };

  archiveEntry = async (params: { id: string; reviewedBy: string; spaceId: string }) => {
    const [updated] = await this.db
      .update(spaceMemoryEntries)
      .set({
        reviewedBy: params.reviewedBy,
        status: 'archived',
        updatedAt: new Date(),
        updatedBy: params.reviewedBy,
      })
      .where(
        and(
          eq(spaceMemoryEntries.id, params.id),
          eq(spaceMemoryEntries.spaceId, params.spaceId),
          eq(spaceMemoryEntries.status, 'candidate'),
        ),
      )
      .returning();

    return updated;
  };

  archiveEntries = async (params: {
    ids: string[];
    reviewedBy: string;
    spaceId: string;
  }): Promise<SpaceMemoryBatchActionResult[]> => {
    if (!params.ids.length) return [];

    const updatedRows = await this.db
      .update(spaceMemoryEntries)
      .set({
        reviewedBy: params.reviewedBy,
        status: 'archived',
        updatedAt: new Date(),
        updatedBy: params.reviewedBy,
      })
      .where(
        and(
          inArray(spaceMemoryEntries.id, params.ids),
          eq(spaceMemoryEntries.spaceId, params.spaceId),
          eq(spaceMemoryEntries.status, 'candidate'),
        ),
      )
      .returning();

    return this.buildBatchActionResults({
      ids: params.ids,
      reviewedBy: params.reviewedBy,
      spaceId: params.spaceId,
      successStatus: 'archived',
      updatedRows,
    });
  };

  revalidatePublishedEntries = async (params: {
    ids: string[];
    reviewedBy: string;
    spaceId: string;
  }): Promise<SpaceMemoryBatchActionResult[]> => {
    if (!params.ids.length) return [];
    const reviewer = await this.getUserIdentity(params.reviewedBy);

    const updatedRows = await this.db.transaction(async (tx) => {
      const now = new Date();
      const nowIso = now.toISOString();
      const targets = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            inArray(spaceMemoryEntries.id, params.ids),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'published'),
          ),
        );

      const updated = [];

      for (const target of targets) {
        const changes: SpaceMemoryGovernanceHistoryItem['changes'] = {
          lastVerifiedAt: {
            after: nowIso,
            before: toISOStringOrNull(target.lastVerifiedAt),
          },
          ...(target.staleAt
            ? {
                staleAt: {
                  after: null,
                  before: toISOStringOrNull(target.staleAt),
                },
              }
            : {}),
        };

        const [row] = await tx
          .update(spaceMemoryEntries)
          .set({
            lastVerifiedAt: now,
            metadata: this.appendGovernanceHistory(target.metadata ?? undefined, {
              action: 'policy_updated',
              actor: reviewer,
              at: nowIso,
              changes,
            }),
            reviewedBy: params.reviewedBy,
            staleAt: null,
            updatedAt: now,
            updatedBy: params.reviewedBy,
          })
          .where(eq(spaceMemoryEntries.id, target.id))
          .returning();

        if (row) updated.push(row);
      }

      return updated;
    });

    return this.buildBatchActionResults({
      ids: params.ids,
      insideSpaceSkipReason: 'not_published',
      reviewedBy: params.reviewedBy,
      spaceId: params.spaceId,
      successStatus: 'revalidated',
      updatedRows,
    });
  };

  markPublishedEntriesStale = async (params: {
    ids: string[];
    reviewedBy: string;
    spaceId: string;
  }): Promise<SpaceMemoryBatchActionResult[]> => {
    if (!params.ids.length) return [];
    const reviewer = await this.getUserIdentity(params.reviewedBy);

    const updatedRows = await this.db.transaction(async (tx) => {
      const now = new Date();
      const nowIso = now.toISOString();
      const targets = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            inArray(spaceMemoryEntries.id, params.ids),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'published'),
            isNull(spaceMemoryEntries.staleAt),
          ),
        );

      const updated = [];

      for (const target of targets) {
        const [row] = await tx
          .update(spaceMemoryEntries)
          .set({
            metadata: this.appendGovernanceHistory(target.metadata ?? undefined, {
              action: 'policy_updated',
              actor: reviewer,
              at: nowIso,
              changes: {
                staleAt: {
                  after: nowIso,
                  before: toISOStringOrNull(target.staleAt),
                },
              },
            }),
            reviewedBy: params.reviewedBy,
            staleAt: now,
            updatedAt: now,
            updatedBy: params.reviewedBy,
          })
          .where(eq(spaceMemoryEntries.id, target.id))
          .returning();

        if (row) updated.push(row);
      }

      return updated;
    });

    const matchedRows = await this.db
      .select({
        id: spaceMemoryEntries.id,
        spaceId: spaceMemoryEntries.spaceId,
        staleAt: spaceMemoryEntries.staleAt,
        status: spaceMemoryEntries.status,
      })
      .from(spaceMemoryEntries)
      .where(inArray(spaceMemoryEntries.id, params.ids));

    const successIds = new Set(updatedRows.map((item) => item.id));
    const matchedById = new Map(matchedRows.map((item) => [item.id, item] as const));

    return params.ids.map((id) => {
      if (successIds.has(id)) {
        return {
          id,
          reviewedBy: params.reviewedBy,
          status: 'stale',
        };
      }

      const matched = matchedById.get(id);

      if (!matched) return { id, reason: 'not_found', status: 'skipped' };
      if (matched.spaceId !== params.spaceId) {
        return { id, reason: 'outside_space', status: 'skipped' };
      }
      if (matched.status !== 'published') {
        return { id, reason: 'not_published', status: 'skipped' };
      }
      if (matched.staleAt) {
        return { id, reason: 'already_stale', status: 'skipped' };
      }

      return { id, reason: 'not_published', status: 'skipped' };
    });
  };

  updatePublishedRecallPolicy = async (params: {
    expiresAt: string | null;
    id: string;
    lastVerifiedAt: string | null;
    recallEnabled: boolean;
    staleAt: string | null;
    reviewedBy: string;
    spaceId: string;
  }) => {
    const reviewer = await this.getUserIdentity(params.reviewedBy);

    return this.db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            eq(spaceMemoryEntries.id, params.id),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'published'),
          ),
        )
        .limit(1);

      if (!target) return null;

      const nextExpiresAt = params.expiresAt ? new Date(params.expiresAt) : null;
      const nextLastVerifiedAt = params.lastVerifiedAt ? new Date(params.lastVerifiedAt) : null;
      const nextStaleAt = params.staleAt ? new Date(params.staleAt) : null;
      const now = new Date();
      const nextChanges: SpaceMemoryGovernanceHistoryItem['changes'] = {
        ...((target.recallEnabled ?? true) !== params.recallEnabled
          ? {
              recallEnabled: {
                after: params.recallEnabled,
                before: target.recallEnabled ?? true,
              },
            }
          : {}),
        ...(!isSameTimestamp(target.expiresAt, nextExpiresAt)
          ? {
              expiresAt: {
                after: toISOStringOrNull(nextExpiresAt),
                before: toISOStringOrNull(target.expiresAt),
              },
            }
          : {}),
        ...(!isSameTimestamp(target.lastVerifiedAt, nextLastVerifiedAt)
          ? {
              lastVerifiedAt: {
                after: toISOStringOrNull(nextLastVerifiedAt),
                before: toISOStringOrNull(target.lastVerifiedAt),
              },
            }
          : {}),
        ...(!isSameTimestamp(target.staleAt, nextStaleAt)
          ? {
              staleAt: {
                after: toISOStringOrNull(nextStaleAt),
                before: toISOStringOrNull(target.staleAt),
              },
            }
          : {}),
      };
      const hasPolicyChanges = Object.keys(nextChanges).length > 0;

      const [updated] = await tx
        .update(spaceMemoryEntries)
        .set({
          expiresAt: nextExpiresAt,
          lastVerifiedAt: nextLastVerifiedAt,
          metadata: hasPolicyChanges
            ? this.appendGovernanceHistory(target.metadata ?? undefined, {
                action: 'policy_updated',
                actor: reviewer,
                at: now.toISOString(),
                changes: nextChanges,
              })
            : target.metadata,
          recallEnabled: params.recallEnabled,
          reviewedBy: params.reviewedBy,
          staleAt: nextStaleAt,
          updatedAt: now,
          updatedBy: params.reviewedBy,
        })
        .where(eq(spaceMemoryEntries.id, params.id))
        .returning();

      return updated;
    });
  };

  mergeCandidateIntoPublishedEntry = async (params: {
    candidateId: string;
    merge?: {
      appendSources?: boolean;
      applyContent?: boolean;
      applySummary?: boolean;
      applyTitle?: boolean;
    };
    reviewedBy: string;
    spaceId: string;
    targetEntryId: string;
  }) => {
    const reviewer = await this.getUserIdentity(params.reviewedBy);

    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [candidate] = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            eq(spaceMemoryEntries.id, params.candidateId),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'candidate'),
          ),
        )
        .limit(1);

      const [target] = await tx
        .select()
        .from(spaceMemoryEntries)
        .where(
          and(
            eq(spaceMemoryEntries.id, params.targetEntryId),
            eq(spaceMemoryEntries.spaceId, params.spaceId),
            eq(spaceMemoryEntries.status, 'published'),
          ),
        )
        .limit(1);

      if (!candidate || !target) return null;

      const applyTitle = params.merge?.applyTitle ?? true;
      const applySummary = params.merge?.applySummary ?? true;
      const applyContent = params.merge?.applyContent ?? true;
      const appendSources = params.merge?.appendSources ?? true;
      const changes: SpaceMemoryGovernanceHistoryItem['changes'] = {
        ...(applyTitle && candidate.title !== target.title
          ? {
              title: {
                after: candidate.title || target.title,
                before: target.title,
              },
            }
          : {}),
        ...(applySummary && candidate.summary !== target.summary
          ? {
              summary: {
                after: candidate.summary ?? target.summary,
                before: target.summary,
              },
            }
          : {}),
        ...(applyContent && candidate.content !== target.content
          ? {
              content: {
                after: candidate.content ?? target.content,
                before: target.content,
              },
            }
          : {}),
      };

      const [updatedTarget] = await tx
        .update(spaceMemoryEntries)
        .set({
          content: applyContent ? (candidate.content ?? target.content) : target.content,
          lastVerifiedAt: now,
          metadata: this.appendGovernanceHistory(target.metadata ?? undefined, {
            action: 'merged',
            actor: reviewer,
            at: now.toISOString(),
            changes: Object.keys(changes).length > 0 ? changes : undefined,
            resolution: {
              appendSources,
              applyContent,
              applySummary,
              applyTitle,
            },
            sourceTitle: candidate.title,
          }),
          sourceRefs: appendSources
            ? this.mergeSourceRefs([...(target.sourceRefs ?? []), ...(candidate.sourceRefs ?? [])])
            : (target.sourceRefs ?? []),
          summary: applySummary ? (candidate.summary ?? target.summary) : target.summary,
          staleAt: null,
          title: applyTitle ? candidate.title || target.title : target.title,
          updatedAt: now,
          updatedBy: params.reviewedBy,
        })
        .where(eq(spaceMemoryEntries.id, params.targetEntryId))
        .returning();

      const [archivedCandidate] = await tx
        .update(spaceMemoryEntries)
        .set({
          reviewedBy: params.reviewedBy,
          status: 'archived',
          updatedAt: now,
          updatedBy: params.reviewedBy,
        })
        .where(eq(spaceMemoryEntries.id, params.candidateId))
        .returning();

      if (!updatedTarget || !archivedCandidate) return null;

      return {
        archivedCandidate,
        updatedTarget,
      };
    });
  };
}
