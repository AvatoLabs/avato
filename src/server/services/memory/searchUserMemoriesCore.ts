import {
  DEFAULT_USER_MEMORY_EMBEDDING_DIMENSIONS,
  DEFAULT_USER_MEMORY_EMBEDDING_MODEL_ITEM,
  MEMORY_SEARCH_TOP_K_LIMITS,
} from '@lobechat/const';
import { type LobeChatDatabase } from '@lobechat/database';
import type { SearchMemoryResult, searchMemorySchema } from '@lobechat/types';
import type { z } from 'zod';

import type { UserMemoryModel } from '@/database/models/userMemory';
import { getServerDefaultFilesConfig } from '@/server/globalConfig';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

export const EMPTY_SEARCH_RESULT: SearchMemoryResult = {
  activities: [],
  contexts: [],
  experiences: [],
  preferences: [],
};

export type MemorySearchContext = {
  memoryEffort: MemoryEffort;
  memoryModel: UserMemoryModel;
  serverDB: LobeChatDatabase;
  userId: string;
};

type LayeredSearchResult = Awaited<ReturnType<UserMemoryModel['searchWithEmbedding']>>;

export type MemoryEffort = 'high' | 'low' | 'medium';

export const normalizeMemoryEffort = (value: unknown): MemoryEffort => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
};

const mapMemorySearchResult = (layeredResults: LayeredSearchResult): SearchMemoryResult => {
  return {
    activities: layeredResults.activities.map((activity) => ({
      accessedAt: activity.accessedAt,
      associatedLocations: activity.associatedLocations,
      associatedObjects: activity.associatedObjects,
      associatedSubjects: activity.associatedSubjects,
      capturedAt: activity.capturedAt,
      createdAt: activity.createdAt,
      endsAt: activity.endsAt,
      feedback: activity.feedback,
      id: activity.id,
      metadata: activity.metadata,
      narrative: activity.narrative,
      notes: activity.notes,
      startsAt: activity.startsAt,
      status: activity.status,
      tags: activity.tags,
      timezone: activity.timezone,
      type: activity.type,
      updatedAt: activity.updatedAt,
      userMemoryId: activity.userMemoryId,
    })),
    contexts: layeredResults.contexts.map((context) => ({
      accessedAt: context.accessedAt,
      associatedObjects: context.associatedObjects,
      associatedSubjects: context.associatedSubjects,
      createdAt: context.createdAt,
      currentStatus: context.currentStatus,
      description: context.description,
      id: context.id,
      metadata: context.metadata,
      scoreImpact: context.scoreImpact,
      scoreUrgency: context.scoreUrgency,
      tags: context.tags,
      title: context.title,
      type: context.type,
      updatedAt: context.updatedAt,
      userMemoryIds: Array.isArray(context.userMemoryIds)
        ? (context.userMemoryIds as string[])
        : null,
    })),
    experiences: layeredResults.experiences.map((experience) => ({
      accessedAt: experience.accessedAt,
      action: experience.action,
      createdAt: experience.createdAt,
      id: experience.id,
      keyLearning: experience.keyLearning,
      metadata: experience.metadata,
      possibleOutcome: experience.possibleOutcome,
      reasoning: experience.reasoning,
      scoreConfidence: experience.scoreConfidence,
      situation: experience.situation,
      tags: experience.tags,
      type: experience.type,
      updatedAt: experience.updatedAt,
      userMemoryId: experience.userMemoryId,
    })),
    preferences: layeredResults.preferences.map((preference) => ({
      accessedAt: preference.accessedAt,
      conclusionDirectives: preference.conclusionDirectives,
      createdAt: preference.createdAt,
      id: preference.id,
      metadata: preference.metadata,
      scorePriority: preference.scorePriority,
      suggestions: preference.suggestions,
      tags: preference.tags,
      type: preference.type,
      updatedAt: preference.updatedAt,
      userMemoryId: preference.userMemoryId,
    })),
  } satisfies SearchMemoryResult;
};

const applySearchLimitsByEffort = (
  effort: MemoryEffort,
  requested: { activities: number; contexts: number; experiences: number; preferences: number },
) => {
  const limit = MEMORY_SEARCH_TOP_K_LIMITS[effort];

  return {
    activities: Math.min(requested.activities, limit.activities),
    contexts: Math.min(requested.contexts, limit.contexts),
    experiences: Math.min(requested.experiences, limit.experiences),
    preferences: Math.min(requested.preferences, limit.preferences),
  };
};

export const searchUserMemories = async (
  ctx: MemorySearchContext,
  input: z.infer<typeof searchMemorySchema>,
): Promise<SearchMemoryResult> => {
  const { provider, model: embeddingModel } =
    getServerDefaultFilesConfig().embeddingModel || DEFAULT_USER_MEMORY_EMBEDDING_MODEL_ITEM;
  const modelRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider);

  const queryEmbeddings = await modelRuntime.embeddings({
    dimensions: DEFAULT_USER_MEMORY_EMBEDDING_DIMENSIONS,
    input: input.query,
    model: embeddingModel,
  });

  const effectiveEffort = normalizeMemoryEffort(input.effort ?? ctx.memoryEffort);
  const effortDefaults = MEMORY_SEARCH_TOP_K_LIMITS[effectiveEffort];

  const requestedLimits = {
    activities: input.topK?.activities ?? effortDefaults.activities,
    contexts: input.topK?.contexts ?? effortDefaults.contexts,
    experiences: input.topK?.experiences ?? effortDefaults.experiences,
    preferences: input.topK?.preferences ?? effortDefaults.preferences,
  };

  const effortConstrainedLimits = applySearchLimitsByEffort(effectiveEffort, requestedLimits);

  const layeredResults = await ctx.memoryModel.searchWithEmbedding({
    embedding: queryEmbeddings?.[0],
    limits: effortConstrainedLimits,
  });

  return mapMemorySearchResult(layeredResults);
};
