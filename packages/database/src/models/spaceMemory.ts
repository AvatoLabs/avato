import { and, count, desc, eq } from 'drizzle-orm';

import { spaceMemoryEntries, users } from '../schemas';
import type { LobeChatDatabase } from '../type';

type SpaceMemorySection = 'inbox' | 'playbooks' | 'policies' | 'published';
type SpaceMemoryCategory = 'general' | 'playbook' | 'policy';
type SpaceMemorySourceKind = 'document' | 'file' | 'message' | 'source_set' | 'topic';

interface SpaceMemorySummary {
  canCreate: boolean;
  canPublish: boolean;
  canReview: boolean;
  id: string;
  kind?: 'personal' | 'team' | string | null;
  membershipRole?: string | null;
  name?: string | null;
  sections: Record<SpaceMemorySection, { count: number }>;
}

interface SpaceMemorySectionResult {
  items: {
    category: SpaceMemoryCategory;
    actor?: {
      id?: string | null;
      name?: string | null;
      username?: string | null;
    };
    id: string;
    kind: 'candidate' | 'memory';
    publishedAt?: string | null;
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

export class SpaceMemoryModel {
  private readonly db: LobeChatDatabase;
  private readonly userId?: string;

  constructor(db: LobeChatDatabase, userId?: string) {
    this.db = db;
    this.userId = userId;
  }

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

  getSummary = async (params: {
    canCreate: boolean;
    canPublish: boolean;
    canReview: boolean;
    id: string;
    kind?: SpaceMemorySummary['kind'];
    membershipRole?: SpaceMemorySummary['membershipRole'];
    name?: SpaceMemorySummary['name'];
  }): Promise<SpaceMemorySummary> => {
    const [inbox, published, playbooks, policies] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(spaceMemoryEntries)
        .where(this.buildSectionWhere(params.id, 'inbox')),
      this.db
        .select({ count: count() })
        .from(spaceMemoryEntries)
        .where(this.buildSectionWhere(params.id, 'published')),
      this.db
        .select({ count: count() })
        .from(spaceMemoryEntries)
        .where(this.buildSectionWhere(params.id, 'playbooks')),
      this.db
        .select({ count: count() })
        .from(spaceMemoryEntries)
        .where(this.buildSectionWhere(params.id, 'policies')),
    ]);

    return {
      canCreate: params.canCreate,
      canPublish: params.canPublish,
      canReview: params.canReview,
      id: params.id,
      kind: params.kind,
      membershipRole: params.membershipRole,
      name: params.name,
      sections: {
        inbox: { count: inbox[0]?.count ?? 0 },
        playbooks: { count: playbooks[0]?.count ?? 0 },
        policies: { count: policies[0]?.count ?? 0 },
        published: { count: published[0]?.count ?? 0 },
      },
    };
  };

  listEntries = async (params: {
    section: SpaceMemorySection;
    spaceId: string;
  }): Promise<SpaceMemorySectionResult> => {
    const rows =
      params.section === 'inbox'
        ? await this.db
            .select({
              actorId: spaceMemoryEntries.createdBy,
              actorName: users.fullName,
              actorUsername: users.username,
              category: spaceMemoryEntries.category,
              id: spaceMemoryEntries.id,
              publishedAt: spaceMemoryEntries.publishedAt,
              sourceRefs: spaceMemoryEntries.sourceRefs,
              summary: spaceMemoryEntries.summary,
              title: spaceMemoryEntries.title,
              updatedAt: spaceMemoryEntries.updatedAt,
            })
            .from(spaceMemoryEntries)
            .leftJoin(users, eq(spaceMemoryEntries.createdBy, users.id))
            .where(this.buildSectionWhere(params.spaceId, params.section))
            .orderBy(desc(spaceMemoryEntries.updatedAt))
            .limit(50)
        : await this.db
            .select({
              actorId: spaceMemoryEntries.reviewedBy,
              actorName: users.fullName,
              actorUsername: users.username,
              category: spaceMemoryEntries.category,
              id: spaceMemoryEntries.id,
              publishedAt: spaceMemoryEntries.publishedAt,
              sourceRefs: spaceMemoryEntries.sourceRefs,
              summary: spaceMemoryEntries.summary,
              title: spaceMemoryEntries.title,
              updatedAt: spaceMemoryEntries.updatedAt,
            })
            .from(spaceMemoryEntries)
            .leftJoin(users, eq(spaceMemoryEntries.reviewedBy, users.id))
            .where(this.buildSectionWhere(params.spaceId, params.section))
            .orderBy(desc(spaceMemoryEntries.publishedAt))
            .limit(50);

    return {
      items: rows.map((row) => ({
        actor:
          row.actorId || row.actorName || row.actorUsername
            ? {
                id: row.actorId,
                name: row.actorName,
                username: row.actorUsername,
              }
            : undefined,
        category: row.category,
        id: row.id,
        kind: params.section === 'inbox' ? 'candidate' : 'memory',
        publishedAt:
          row.publishedAt instanceof Date
            ? row.publishedAt.toISOString()
            : (row.publishedAt ?? null),
        sourceCount: row.sourceRefs?.length ?? 0,
        sourceRefs: row.sourceRefs ?? [],
        summary: row.summary,
        title: row.title || row.content || '',
        updatedAt:
          row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString(),
      })),
      section: params.section,
    };
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
    const [created] = await this.db
      .insert(spaceMemoryEntries)
      .values({
        category: params.category ?? 'general',
        content: params.content,
        createdBy: params.createdBy,
        metadata: params.metadata,
        sourceRefs: params.sourceRefs,
        spaceId: params.spaceId,
        status: 'candidate',
        summary: params.summary,
        title: params.title,
        updatedBy: this.userId ?? params.createdBy,
      })
      .returning();

    return created;
  };

  publishEntry = async (params: { id: string; reviewedBy: string; spaceId: string }) => {
    const [updated] = await this.db
      .update(spaceMemoryEntries)
      .set({
        publishedAt: new Date(),
        reviewedBy: params.reviewedBy,
        status: 'published',
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
}
