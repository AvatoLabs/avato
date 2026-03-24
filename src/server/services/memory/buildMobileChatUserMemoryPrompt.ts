import { DEFAULT_SEARCH_USER_MEMORY_TOP_K } from '@lobechat/const';
import { promptUserMemory, type UserMemoryData } from '@lobechat/prompts';
import { type SearchMemoryResult } from '@lobechat/types';
import { searchMemorySchema } from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { UserMemoryModel } from '@/database/models/userMemory';
import { UserMemoryIdentityModel } from '@/database/models/userMemory/identity';
import { UserPersonaModel } from '@/database/models/userMemory/persona';
import { UserMemoryTopicRepository } from '@/database/repositories/userMemory';
import { userSettings } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import {
  type MemoryEffort,
  normalizeMemoryEffort,
  searchUserMemories,
} from './searchUserMemoriesCore';

/** Align identity row count with `MobileChatService` legacy injection limits. */
const IDENTITY_LIMIT_BY_EFFORT: Record<MemoryEffort, number> = {
  high: 50,
  low: 12,
  medium: 30,
};

const readUserMemoryEffortFromDb = async (
  serverDB: LobeChatDatabase,
  userId: string,
): Promise<MemoryEffort> => {
  const userSettingsRow = await serverDB.query.userSettings.findFirst({
    columns: { memory: true },
    where: eq(userSettings.id, userId),
  });
  const memoryConfig =
    typeof userSettingsRow?.memory === 'object' && userSettingsRow?.memory !== null
      ? (userSettingsRow.memory as { effort?: unknown })
      : undefined;
  return normalizeMemoryEffort(memoryConfig?.effort);
};

const searchResultToPromptMemories = (result: SearchMemoryResult): Partial<UserMemoryData> => ({
  activities: result.activities.map((activity) => ({
    endsAt: activity.endsAt,
    feedback: activity.feedback,
    id: activity.id,
    narrative: activity.narrative,
    notes: activity.notes,
    startsAt: activity.startsAt,
    status: activity.status,
    timezone: activity.timezone,
    type: activity.type,
  })),
  contexts: result.contexts.map((c) => ({
    description: c.description,
    id: c.id,
    title: c.title,
  })),
  experiences: result.experiences.map((e) => ({
    id: e.id,
    keyLearning: e.keyLearning,
    situation: e.situation,
  })),
  preferences: result.preferences
    .filter((p) => !!p.conclusionDirectives?.trim())
    .map((p) => ({
      conclusionDirectives: p.conclusionDirectives,
      id: p.id,
    })),
});

/**
 * Build the same structured user-memory block as web `UserMemoryInjector` / `promptUserMemory`,
 * using persona + self identities + (optional) topic-conditioned embedding search.
 */
export const buildMobileChatUserMemoryPrompt = async (params: {
  effort: MemoryEffort;
  serverDB: LobeChatDatabase;
  topicId?: string;
  userId: string;
}): Promise<string | undefined> => {
  const { effort, serverDB, topicId, userId } = params;

  const dbEffort = await readUserMemoryEffortFromDb(serverDB, userId);
  const identityModel = new UserMemoryIdentityModel(serverDB, userId);
  const identityRows = await identityModel.queryForInjection(IDENTITY_LIMIT_BY_EFFORT[effort]);

  const identities: UserMemoryData['identities'] = identityRows.map((row) => ({
    capturedAt: row.capturedAt,
    description: row.description,
    id: row.id,
    role: row.role,
    type: row.type,
  }));

  const personaModel = new UserPersonaModel(serverDB, userId);
  const personaDoc = await personaModel.getLatestPersonaDocument();
  const persona: UserMemoryData['persona'] | undefined =
    personaDoc && (personaDoc.persona?.trim() || personaDoc.tagline?.trim())
      ? {
          narrative: personaDoc.persona ?? null,
          tagline: personaDoc.tagline ?? null,
        }
      : undefined;

  let topicMemories: Partial<UserMemoryData> = {};
  if (topicId) {
    const repo = new UserMemoryTopicRepository(serverDB, userId);
    const query = await repo.getUserMessagesQueryForTopic(topicId);
    if (query) {
      const memoryModel = new UserMemoryModel(serverDB, userId);
      const searchInput = searchMemorySchema.parse({
        effort,
        query,
        topK: DEFAULT_SEARCH_USER_MEMORY_TOP_K,
      });
      const searchResult = await searchUserMemories(
        { memoryEffort: dbEffort, memoryModel, serverDB, userId },
        searchInput,
      );
      topicMemories = searchResultToPromptMemories(searchResult);
    }
  }

  const memories: UserMemoryData = {
    activities: topicMemories.activities ?? [],
    contexts: topicMemories.contexts ?? [],
    experiences: topicMemories.experiences ?? [],
    identities: identities.length > 0 ? identities : undefined,
    persona,
    preferences: topicMemories.preferences ?? [],
  };

  const xml = promptUserMemory({ memories });
  return xml.trim().length > 0 ? xml : undefined;
};
