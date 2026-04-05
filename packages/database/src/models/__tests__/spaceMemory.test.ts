// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { spaceMemoryEntries, spaces, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { SpaceMemoryModel } from '../spaceMemory';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'space-memory-model-user-id';
const reviewerId = 'space-memory-model-reviewer-id';
const spaceId = 'spc_space_memory_model';

const spaceMemoryModel = new SpaceMemoryModel(serverDB, userId);

beforeEach(async () => {
  await serverDB.delete(spaceMemoryEntries);
  await serverDB.delete(spaces);
  await serverDB.delete(users);

  await serverDB.insert(users).values([
    { fullName: 'Author User', id: userId, username: 'author-user' },
    { fullName: 'Reviewer User', id: reviewerId, username: 'reviewer-user' },
  ]);
  await serverDB.insert(spaces).values({
    createdBy: userId,
    id: spaceId,
    kind: 'team',
    name: 'Ops Space',
  });
});

afterEach(async () => {
  await serverDB.delete(spaceMemoryEntries);
  await serverDB.delete(spaces);
  await serverDB.delete(users);
});

describe('SpaceMemoryModel', () => {
  describe('listEntries', () => {
    it('adds a duplicate published review hint for matching inbox candidates', async () => {
      await serverDB.insert(spaceMemoryEntries).values([
        {
          category: 'general',
          createdBy: userId,
          sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Release topic' }],
          spaceId,
          status: 'candidate',
          summary: 'Always confirm the rollback owner before deployment.',
          title: 'Rollback owner confirmation',
          updatedBy: userId,
        },
        {
          category: 'general',
          createdBy: userId,
          publishedAt: new Date('2026-04-04T10:00:00.000Z'),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published',
          summary: 'Always confirm the rollback owner before deployment.',
          title: 'Release checklist',
          updatedBy: reviewerId,
        },
        {
          category: 'playbook',
          createdBy: userId,
          publishedAt: new Date('2026-04-04T11:00:00.000Z'),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published',
          summary: 'Always confirm the rollback owner before deployment.',
          title: 'Unrelated playbook',
          updatedBy: reviewerId,
        },
      ]);

      const result = await spaceMemoryModel.listEntries({
        section: 'inbox',
        spaceId,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.reviewHint).toEqual({
        kind: 'duplicate_published',
        mergePreview: {
          addedSourceCount: 1,
          updatesContent: false,
          updatesSummary: false,
          updatesTitle: true,
        },
        match: {
          content: null,
          id: expect.any(String),
          publishedAt: '2026-04-04T10:00:00.000Z',
          summary: 'Always confirm the rollback owner before deployment.',
          title: 'Release checklist',
        },
      });
    });

    it('does not add duplicate hints to published sections', async () => {
      await serverDB.insert(spaceMemoryEntries).values({
        category: 'general',
        createdBy: userId,
        publishedAt: new Date('2026-04-04T10:00:00.000Z'),
        reviewedBy: reviewerId,
        spaceId,
        status: 'published',
        summary: 'This is durable published guidance.',
        title: 'Published guideline',
        updatedBy: reviewerId,
      });

      const result = await spaceMemoryModel.listEntries({
        section: 'published',
        spaceId,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.reviewHint).toBeUndefined();
    });

    it('prioritizes stale published memories in section ordering', async () => {
      const [activeEntry, staleEntry] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T11:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Still current guidance.',
            title: 'Fresh published guidance',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            staleAt: new Date('2026-04-04T12:00:00.000Z'),
            status: 'published',
            summary: 'Needs a reviewer to confirm it again.',
            title: 'Needs revalidation',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.listEntries({
        section: 'published',
        spaceId,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.id)).toEqual([staleEntry!.id, activeEntry!.id]);
      expect(result.items[0]?.recall?.recallBlockedReason).toBe('stale');
      expect(result.items[1]?.recall?.recallBlockedReason).toBeUndefined();
    });
  });

  describe('getSummary', () => {
    it('returns per-section recall breakdown counts for reviewed memories', async () => {
      await serverDB.insert(spaceMemoryEntries).values([
        {
          category: 'general',
          createdBy: userId,
          publishedAt: new Date('2026-04-04T11:00:00.000Z'),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published',
          summary: 'Active guidance.',
          title: 'Active published memory',
          updatedBy: reviewerId,
        },
        {
          category: 'playbook',
          createdBy: userId,
          publishedAt: new Date('2026-04-04T10:00:00.000Z'),
          reviewedBy: reviewerId,
          spaceId,
          staleAt: new Date('2026-04-04T12:00:00.000Z'),
          status: 'published',
          summary: 'Needs revalidation.',
          title: 'Stale playbook',
          updatedBy: reviewerId,
        },
        {
          category: 'policy',
          createdBy: userId,
          publishedAt: new Date('2026-04-04T09:00:00.000Z'),
          recallEnabled: false,
          reviewedBy: reviewerId,
          spaceId,
          status: 'published',
          summary: 'Paused policy.',
          title: 'Disabled policy',
          updatedBy: reviewerId,
        },
        {
          category: 'policy',
          createdBy: userId,
          expiresAt: new Date('2000-01-01T00:00:00.000Z'),
          publishedAt: new Date('2026-04-04T08:00:00.000Z'),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published',
          summary: 'Expired policy.',
          title: 'Expired policy',
          updatedBy: reviewerId,
        },
        {
          category: 'general',
          createdBy: userId,
          sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Fresh note' }],
          spaceId,
          status: 'candidate',
          summary: 'Candidate note',
          title: 'Inbox candidate',
          updatedBy: userId,
        },
      ]);

      const result = await spaceMemoryModel.getSummary({
        canCreate: true,
        canPublish: true,
        canReview: true,
        id: spaceId,
        kind: 'team',
        membershipRole: 'editor',
        name: 'Ops Space',
        surface: 'reviewer',
      });

      expect(result.surface).toBe('reviewer');
      expect(result.sections.inbox).toEqual({
        count: 1,
        recall: { active: 0, disabled: 0, expired: 0, stale: 0 },
      });
      expect(result.sections.published).toEqual({
        count: 1,
        recall: { active: 1, disabled: 0, expired: 0, stale: 0 },
      });
      expect(result.sections.playbooks).toEqual({
        count: 1,
        recall: { active: 0, disabled: 0, expired: 0, stale: 1 },
      });
      expect(result.sections.policies).toEqual({
        count: 2,
        recall: { active: 0, disabled: 1, expired: 1, stale: 0 },
      });
    });
  });

  describe('listPublishedRecallEntries', () => {
    it('returns published memories by category and respects per-category limits', async () => {
      const [generalOlder, generalNewest, playbook, policy] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            content: 'Older general memory',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Older shared context',
            title: 'Old context',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            content: 'Newest general memory',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T11:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Newest shared context',
            title: 'Fresh context',
            updatedBy: reviewerId,
          },
          {
            category: 'playbook',
            content: 'Assign a named rollback owner before rollout.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:30:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Practice rollback ownership.',
            title: 'Rollback drill',
            updatedBy: reviewerId,
          },
          {
            category: 'policy',
            content: 'Do not promise an ETA without incident commander approval.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:45:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Customer ETAs require approval.',
            title: 'Customer comms',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            spaceId,
            status: 'candidate',
            summary: 'Candidate should not appear in recall.',
            title: 'Candidate only',
            updatedBy: userId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        limitByCategory: {
          general: 1,
          playbook: 2,
          policy: 2,
        },
        spaceId,
      });

      expect(result).toEqual([
        expect.objectContaining({
          category: 'general',
          id: generalNewest!.id,
          summary: 'Newest shared context',
          title: 'Fresh context',
        }),
        expect.objectContaining({
          category: 'playbook',
          id: playbook!.id,
          title: 'Rollback drill',
        }),
        expect.objectContaining({
          category: 'policy',
          id: policy!.id,
          title: 'Customer comms',
        }),
      ]);
      expect(result.map((item) => item.id)).not.toContain(generalOlder!.id);
    });

    it('prefers query-relevant published memories over newer unrelated ones', async () => {
      const [relevantGeneral, newerGeneral] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            content: 'Every rollout must name a rollback owner before approval.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Rollback owner is mandatory before deploy.',
            title: 'Rollback owner',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            content: 'Weekly planning happens on Monday morning.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T11:30:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Planning cadence for the team.',
            title: 'Planning rhythm',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        limitByCategory: { general: 1 },
        query: 'Who should be the rollback owner for this deploy?',
        spaceId,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: relevantGeneral!.id,
          title: 'Rollback owner',
        }),
      );
      expect(result[0]?.id).not.toBe(newerGeneral!.id);
    });

    it('prefers phrase matches over newer entries that only match isolated terms', async () => {
      const [phraseMatch, newerLooseMatch] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'policy',
            content:
              'External ETA updates require incident commander approval before they are shared.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Incident commander approval is required for ETA updates.',
            title: 'Incident commander approval',
            updatedBy: reviewerId,
          },
          {
            category: 'policy',
            content: 'Approval is required for customer communications.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T11:30:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'ETA changes need review.',
            title: 'Approval policy',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        limitByCategory: { policy: 1 },
        query: 'Do we need incident commander approval before sharing an ETA update?',
        spaceId,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(phraseMatch!.id);
      expect(result[0]?.id).not.toBe(newerLooseMatch!.id);
    });

    it('prefers higher query coverage over newer entries with partial overlap', async () => {
      const [highCoverage, newerPartial] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'playbook',
            content:
              'Run the rollback checklist before deploy approval and verify the rollback owner.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Rollback checklist before deploy approval.',
            title: 'Rollback checklist',
            updatedBy: reviewerId,
          },
          {
            category: 'playbook',
            content: 'Verify the rollback owner.',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T11:30:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Rollback owner confirmation.',
            title: 'Rollback owner',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        limitByCategory: { playbook: 1 },
        query: 'How do we run the rollback checklist before deploy approval?',
        spaceId,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(highCoverage!.id);
      expect(result[0]?.id).not.toBe(newerPartial!.id);
    });

    it('allocates more recall slots to policy memories for policy-oriented questions', async () => {
      await serverDB.insert(spaceMemoryEntries).values([
        ...Array.from({ length: 5 }, (_, index) => ({
          category: 'policy' as const,
          content: `Policy memory ${index} says ETA promises require approval.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-04T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `Policy summary ${index}`,
          title: `Policy ${index}`,
          updatedBy: reviewerId,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          category: 'playbook' as const,
          content: `Playbook memory ${index} describes rollback drills.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-03T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `Playbook summary ${index}`,
          title: `Playbook ${index}`,
          updatedBy: reviewerId,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          category: 'general' as const,
          content: `General memory ${index} with team background context.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-02T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `General summary ${index}`,
          title: `General ${index}`,
          updatedBy: reviewerId,
        })),
      ]);

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        query: 'Can we promise an ETA without approval?',
        spaceId,
      });

      expect(result.filter((item) => item.category === 'policy')).toHaveLength(5);
      expect(result.filter((item) => item.category === 'playbook')).toHaveLength(3);
      expect(result.filter((item) => item.category === 'general')).toHaveLength(3);
    });

    it('allocates more recall slots to playbooks for procedural questions', async () => {
      await serverDB.insert(spaceMemoryEntries).values([
        ...Array.from({ length: 5 }, (_, index) => ({
          category: 'playbook' as const,
          content: `Playbook memory ${index} describes rollback checklist steps.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-04T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `Playbook summary ${index}`,
          title: `Playbook ${index}`,
          updatedBy: reviewerId,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          category: 'policy' as const,
          content: `Policy memory ${index} describes approval requirements.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-03T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `Policy summary ${index}`,
          title: `Policy ${index}`,
          updatedBy: reviewerId,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          category: 'general' as const,
          content: `General memory ${index} with release context.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-02T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `General summary ${index}`,
          title: `General ${index}`,
          updatedBy: reviewerId,
        })),
      ]);

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        query: 'How do we run the rollback checklist for this deploy?',
        spaceId,
      });

      expect(result.filter((item) => item.category === 'playbook')).toHaveLength(5);
      expect(result.filter((item) => item.category === 'policy')).toHaveLength(3);
      expect(result.filter((item) => item.category === 'general')).toHaveLength(3);
    });

    it('preserves explicit recall limits even when the query implies a dominant category', async () => {
      await serverDB.insert(spaceMemoryEntries).values([
        ...Array.from({ length: 3 }, (_, index) => ({
          category: 'policy' as const,
          content: `Policy memory ${index} says ETA promises require approval.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-04T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `Policy summary ${index}`,
          title: `Policy ${index}`,
          updatedBy: reviewerId,
        })),
        ...Array.from({ length: 3 }, (_, index) => ({
          category: 'playbook' as const,
          content: `Playbook memory ${index} describes rollback drills.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-03T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `Playbook summary ${index}`,
          title: `Playbook ${index}`,
          updatedBy: reviewerId,
        })),
        ...Array.from({ length: 3 }, (_, index) => ({
          category: 'general' as const,
          content: `General memory ${index} with team background context.`,
          createdBy: userId,
          publishedAt: new Date(`2026-04-02T1${index}:00:00.000Z`),
          reviewedBy: reviewerId,
          spaceId,
          status: 'published' as const,
          summary: `General summary ${index}`,
          title: `General ${index}`,
          updatedBy: reviewerId,
        })),
      ]);

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        limitByCategory: {
          general: 1,
          playbook: 1,
          policy: 1,
        },
        query: 'Can we promise an ETA without approval?',
        spaceId,
      });

      expect(result.filter((item) => item.category === 'policy')).toHaveLength(1);
      expect(result.filter((item) => item.category === 'playbook')).toHaveLength(1);
      expect(result.filter((item) => item.category === 'general')).toHaveLength(1);
    });

    it('skips disabled, stale, and expired published memories during recall', async () => {
      const [activeEntry, disabledEntry, staleEntry, expiredEntry] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            content: 'Active recall memory',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            recallEnabled: true,
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Still usable',
            title: 'Active memory',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            content: 'Disabled recall memory',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            recallEnabled: false,
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Should stay out of recall',
            title: 'Disabled memory',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            content: 'Stale recall memory',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:30:00.000Z'),
            recallEnabled: true,
            reviewedBy: reviewerId,
            spaceId,
            staleAt: new Date('2026-04-04T12:00:00.000Z'),
            status: 'published',
            summary: 'Needs revalidation before use again',
            title: 'Stale memory',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            content: 'Expired recall memory',
            createdBy: userId,
            expiresAt: new Date('2026-04-03T10:00:00.000Z'),
            publishedAt: new Date('2026-04-04T11:00:00.000Z'),
            recallEnabled: true,
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Should also stay out of recall',
            title: 'Expired memory',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.listPublishedRecallEntries({
        limitByCategory: { general: 10 },
        spaceId,
      });

      expect(result.map((item) => item.id)).toEqual([activeEntry!.id]);
      expect(result.map((item) => item.id)).not.toContain(disabledEntry!.id);
      expect(result.map((item) => item.id)).not.toContain(staleEntry!.id);
      expect(result.map((item) => item.id)).not.toContain(expiredEntry!.id);
    });
  });

  describe('getEntriesByIds', () => {
    it('returns requested entries in input order with preview metadata', async () => {
      const [candidate, published, duplicatePublished] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            createdBy: userId,
            metadata: {
              intake: {
                origin: 'manual',
                producer: 'reviewer',
                traceId: 'trace-1',
              },
            },
            sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Release topic' }],
            spaceId,
            status: 'candidate',
            summary: 'Always confirm the rollback owner before deployment.',
            title: 'Rollback owner confirmation',
            updatedBy: userId,
          },
          {
            category: 'playbook',
            content: 'Assign the incident commander before external updates.',
            createdBy: userId,
            lastVerifiedAt: new Date('2026-04-04T11:00:00.000Z'),
            metadata: {
              governance: {
                history: [{ action: 'published', at: '2026-04-04T10:00:00.000Z' }],
              },
            },
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Incident commander must be named.',
            title: 'Incident commander',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T09:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Always confirm the rollback owner before deployment.',
            title: 'Rollback checklist',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            reviewedBy: reviewerId,
            spaceId,
            status: 'archived',
            title: 'Archived item',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.getEntriesByIds({
        ids: [published!.id, candidate!.id, 'missing-entry'],
        spaceId,
      });

      expect(result.map((item) => item.id)).toEqual([published!.id, candidate!.id]);
      expect(result[0]).toMatchObject({
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
        category: 'playbook',
        history: [{ action: 'published', at: '2026-04-04T10:00:00.000Z' }],
        id: published!.id,
        kind: 'memory',
        recall: {
          lastVerifiedAt: '2026-04-04T11:00:00.000Z',
          recallEnabled: true,
        },
        title: 'Incident commander',
      });
      expect(result[1]).toMatchObject({
        actor: {
          id: userId,
          name: 'Author User',
          username: 'author-user',
        },
        id: candidate!.id,
        intake: {
          origin: 'manual',
          producer: 'reviewer',
          traceId: 'trace-1',
        },
        kind: 'candidate',
        reviewHint: {
          kind: 'duplicate_published',
          match: {
            id: duplicatePublished!.id,
            title: 'Rollback checklist',
          },
        },
      });
    });
  });

  describe('updatePublishedRecallPolicy', () => {
    it('updates recall policy fields and records governance history', async () => {
      const [published] = await serverDB
        .insert(spaceMemoryEntries)
        .values({
          category: 'general',
          createdBy: userId,
          lastVerifiedAt: new Date('2026-04-03T09:00:00.000Z'),
          publishedAt: new Date('2026-04-04T10:00:00.000Z'),
          recallEnabled: true,
          reviewedBy: reviewerId,
          spaceId,
          status: 'published',
          summary: 'Published summary',
          title: 'Published entry',
          updatedBy: reviewerId,
        })
        .returning();

      const result = await spaceMemoryModel.updatePublishedRecallPolicy({
        expiresAt: '2026-04-10T12:30:00.000Z',
        id: published!.id,
        lastVerifiedAt: '2026-04-04T12:00:00.000Z',
        recallEnabled: false,
        staleAt: '2026-04-05T09:15:00.000Z',
        reviewedBy: reviewerId,
        spaceId,
      });

      expect(result?.recallEnabled).toBe(false);
      expect(result?.expiresAt).toEqual(new Date('2026-04-10T12:30:00.000Z'));
      expect(result?.lastVerifiedAt).toEqual(new Date('2026-04-04T12:00:00.000Z'));
      expect(result?.staleAt).toEqual(new Date('2026-04-05T09:15:00.000Z'));

      const [updated] = await serverDB
        .select({
          expiresAt: spaceMemoryEntries.expiresAt,
          lastVerifiedAt: spaceMemoryEntries.lastVerifiedAt,
          metadata: spaceMemoryEntries.metadata,
          recallEnabled: spaceMemoryEntries.recallEnabled,
          staleAt: spaceMemoryEntries.staleAt,
        })
        .from(spaceMemoryEntries)
        .where(eq(spaceMemoryEntries.id, published!.id))
        .limit(1);

      expect(updated?.recallEnabled).toBe(false);
      expect(updated?.expiresAt).toEqual(new Date('2026-04-10T12:30:00.000Z'));
      expect(updated?.lastVerifiedAt).toEqual(new Date('2026-04-04T12:00:00.000Z'));
      expect(updated?.staleAt).toEqual(new Date('2026-04-05T09:15:00.000Z'));
      expect((updated?.metadata as any)?.governance?.history?.[0]).toMatchObject({
        action: 'policy_updated',
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
        changes: {
          expiresAt: {
            after: '2026-04-10T12:30:00.000Z',
            before: null,
          },
          lastVerifiedAt: {
            after: '2026-04-04T12:00:00.000Z',
            before: '2026-04-03T09:00:00.000Z',
          },
          recallEnabled: {
            after: false,
            before: true,
          },
          staleAt: {
            after: '2026-04-05T09:15:00.000Z',
            before: null,
          },
        },
      });
    });
  });

  describe('mergeCandidateIntoPublishedEntry', () => {
    it('merges candidate content into a published entry and archives the candidate', async () => {
      const [candidate, target] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            content: 'Updated workflow details',
            createdBy: userId,
            sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Release topic' }],
            spaceId,
            status: 'candidate',
            summary: 'Always confirm rollback owner before deployment.',
            title: 'Rollback owner confirmation',
            updatedBy: userId,
          },
          {
            category: 'general',
            content: 'Existing published workflow',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            reviewedBy: reviewerId,
            sourceRefs: [{ id: 'doc_1', kind: 'document', title: 'Runbook' }],
            spaceId,
            status: 'published',
            summary: 'Older summary',
            title: 'Release checklist',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.mergeCandidateIntoPublishedEntry({
        candidateId: candidate!.id,
        reviewedBy: reviewerId,
        spaceId,
        targetEntryId: target!.id,
      });

      expect(result?.updatedTarget.title).toBe('Rollback owner confirmation');
      expect(result?.updatedTarget.summary).toBe(
        'Always confirm rollback owner before deployment.',
      );
      expect(result?.updatedTarget.content).toBe('Updated workflow details');
      expect(result?.updatedTarget.sourceRefs).toEqual([
        { id: 'doc_1', kind: 'document', title: 'Runbook' },
        { id: 'topic_1', kind: 'topic', title: 'Release topic' },
      ]);
      expect(result?.archivedCandidate.status).toBe('archived');
      expect(result?.archivedCandidate.reviewedBy).toBe(reviewerId);

      const updatedCandidate = await serverDB.query.spaceMemoryEntries.findFirst({
        where: (table, { eq }) => eq(table.id, candidate!.id),
      });
      const updatedTarget = await serverDB.query.spaceMemoryEntries.findFirst({
        where: (table, { eq }) => eq(table.id, target!.id),
      });

      expect(updatedCandidate?.status).toBe('archived');
      expect(updatedTarget?.title).toBe('Rollback owner confirmation');
      expect(updatedTarget?.sourceRefs).toEqual([
        { id: 'doc_1', kind: 'document', title: 'Runbook' },
        { id: 'topic_1', kind: 'topic', title: 'Release topic' },
      ]);
      expect((updatedTarget?.metadata as any)?.governance?.history?.[0]).toMatchObject({
        action: 'merged',
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
        changes: {
          content: {
            after: 'Updated workflow details',
            before: 'Existing published workflow',
          },
          summary: {
            after: 'Always confirm rollback owner before deployment.',
            before: 'Older summary',
          },
          title: {
            after: 'Rollback owner confirmation',
            before: 'Release checklist',
          },
        },
        resolution: {
          appendSources: true,
          applyContent: true,
          applySummary: true,
          applyTitle: true,
        },
        sourceTitle: 'Rollback owner confirmation',
      });
    });

    it('supports selective merge resolution', async () => {
      const [candidate, target] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            content: 'Candidate content',
            createdBy: userId,
            sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Release topic' }],
            spaceId,
            status: 'candidate',
            summary: 'Candidate summary',
            title: 'Candidate title',
            updatedBy: userId,
          },
          {
            category: 'general',
            content: 'Published content',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            reviewedBy: reviewerId,
            sourceRefs: [{ id: 'doc_1', kind: 'document', title: 'Runbook' }],
            spaceId,
            status: 'published',
            summary: 'Published summary',
            title: 'Published title',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.mergeCandidateIntoPublishedEntry({
        candidateId: candidate!.id,
        merge: {
          appendSources: true,
          applyContent: false,
          applySummary: true,
          applyTitle: false,
        },
        reviewedBy: reviewerId,
        spaceId,
        targetEntryId: target!.id,
      });

      expect(result?.updatedTarget.title).toBe('Published title');
      expect(result?.updatedTarget.summary).toBe('Candidate summary');
      expect(result?.updatedTarget.content).toBe('Published content');
      expect(result?.updatedTarget.sourceRefs).toEqual([
        { id: 'doc_1', kind: 'document', title: 'Runbook' },
        { id: 'topic_1', kind: 'topic', title: 'Release topic' },
      ]);
      expect((result?.updatedTarget.metadata as any)?.governance?.history?.[0]).toMatchObject({
        action: 'merged',
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
        changes: {
          summary: {
            after: 'Candidate summary',
            before: 'Published summary',
          },
        },
        resolution: {
          appendSources: true,
          applyContent: false,
          applySummary: true,
          applyTitle: false,
        },
        sourceTitle: 'Candidate title',
      });
    });
  });

  describe('publishEntries', () => {
    it('returns per-item outcomes for published and skipped candidates', async () => {
      const [candidate, published] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            createdBy: userId,
            spaceId,
            status: 'candidate',
            title: 'Candidate entry',
            updatedBy: userId,
          },
          {
            category: 'general',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            title: 'Published entry',
            updatedBy: reviewerId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.publishEntries({
        ids: [candidate!.id, published!.id, 'mem_missing'],
        reviewedBy: reviewerId,
        spaceId,
      });

      expect(result).toEqual([
        { id: candidate!.id, reviewedBy: reviewerId, status: 'published' },
        { id: published!.id, reason: 'already_reviewed', status: 'skipped' },
        { id: 'mem_missing', reason: 'not_found', status: 'skipped' },
      ]);

      const updatedCandidate = await serverDB.query.spaceMemoryEntries.findFirst({
        where: (table, { eq }) => eq(table.id, candidate!.id),
      });

      expect((updatedCandidate?.metadata as any)?.governance?.history?.[0]).toMatchObject({
        action: 'published',
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
      });
    });
  });

  describe('revalidatePublishedEntries', () => {
    it('revalidates published memories and skips non-published ids', async () => {
      const [stalePublished, candidate] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            createdBy: userId,
            lastVerifiedAt: new Date('2026-04-03T09:00:00.000Z'),
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            staleAt: new Date('2026-04-05T09:15:00.000Z'),
            status: 'published',
            summary: 'Needs review',
            title: 'Stale published entry',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            spaceId,
            status: 'candidate',
            title: 'Candidate entry',
            updatedBy: userId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.revalidatePublishedEntries({
        ids: [stalePublished!.id, candidate!.id, 'mem_missing'],
        reviewedBy: reviewerId,
        spaceId,
      });

      expect(result).toEqual([
        { id: stalePublished!.id, reviewedBy: reviewerId, status: 'revalidated' },
        { id: candidate!.id, reason: 'not_published', status: 'skipped' },
        { id: 'mem_missing', reason: 'not_found', status: 'skipped' },
      ]);

      const [updated] = await serverDB
        .select({
          lastVerifiedAt: spaceMemoryEntries.lastVerifiedAt,
          metadata: spaceMemoryEntries.metadata,
          staleAt: spaceMemoryEntries.staleAt,
        })
        .from(spaceMemoryEntries)
        .where(eq(spaceMemoryEntries.id, stalePublished!.id))
        .limit(1);

      expect(updated?.staleAt).toBeNull();
      expect(updated?.lastVerifiedAt).toBeInstanceOf(Date);
      expect((updated?.metadata as any)?.governance?.history?.[0]).toMatchObject({
        action: 'policy_updated',
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
        changes: {
          lastVerifiedAt: {
            after: expect.any(String),
            before: '2026-04-03T09:00:00.000Z',
          },
          staleAt: {
            after: null,
            before: '2026-04-05T09:15:00.000Z',
          },
        },
      });
    });
  });

  describe('markPublishedEntriesStale', () => {
    it('marks published memories stale and skips already-stale or non-published ids', async () => {
      const [activePublished, stalePublished, candidate] = await serverDB
        .insert(spaceMemoryEntries)
        .values([
          {
            category: 'general',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:00:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            status: 'published',
            summary: 'Fresh memory',
            title: 'Active published entry',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            publishedAt: new Date('2026-04-04T10:30:00.000Z'),
            reviewedBy: reviewerId,
            spaceId,
            staleAt: new Date('2026-04-05T09:15:00.000Z'),
            status: 'published',
            summary: 'Already stale memory',
            title: 'Already stale entry',
            updatedBy: reviewerId,
          },
          {
            category: 'general',
            createdBy: userId,
            spaceId,
            status: 'candidate',
            title: 'Candidate entry',
            updatedBy: userId,
          },
        ])
        .returning();

      const result = await spaceMemoryModel.markPublishedEntriesStale({
        ids: [activePublished!.id, stalePublished!.id, candidate!.id, 'mem_missing'],
        reviewedBy: reviewerId,
        spaceId,
      });

      expect(result).toEqual([
        { id: activePublished!.id, reviewedBy: reviewerId, status: 'stale' },
        { id: stalePublished!.id, reason: 'already_stale', status: 'skipped' },
        { id: candidate!.id, reason: 'not_published', status: 'skipped' },
        { id: 'mem_missing', reason: 'not_found', status: 'skipped' },
      ]);

      const [updated] = await serverDB
        .select({
          metadata: spaceMemoryEntries.metadata,
          staleAt: spaceMemoryEntries.staleAt,
        })
        .from(spaceMemoryEntries)
        .where(eq(spaceMemoryEntries.id, activePublished!.id))
        .limit(1);

      expect(updated?.staleAt).toBeInstanceOf(Date);
      expect((updated?.metadata as any)?.governance?.history?.[0]).toMatchObject({
        action: 'policy_updated',
        actor: {
          id: reviewerId,
          name: 'Reviewer User',
          username: 'reviewer-user',
        },
        changes: {
          staleAt: {
            after: expect.any(String),
            before: null,
          },
        },
      });
    });
  });
});
