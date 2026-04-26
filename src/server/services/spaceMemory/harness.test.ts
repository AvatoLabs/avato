// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  normalizeSpaceMemoryHarnessDraft,
  normalizeSpaceMemoryHarnessIngestPayload,
} from './harness';

describe('spaceMemory harness normalization', () => {
  it('projects supported source refs and preserves full harness attribution metadata', () => {
    const normalized = normalizeSpaceMemoryHarnessIngestPayload({
      adapter: 'ops-harness-v1',
      drafts: [
        {
          confidence: 0.92,
          decision: {
            confidence: 0.88,
            decision: 'REVIEW',
            reason: 'Possible overlap with existing release guidance.',
            targetEntryId: 'mem_existing',
          },
          kind: 'playbook',
          normalizedKey: 'release.rollback-owner',
          recall: {
            reason: 'The user asked how to run the release checklist.',
            relevance: 0.97,
            slots: ['action'],
          },
          scope: 'space',
          sourceRefs: [
            { objectId: 'topic_1', objectType: 'topic', title: 'Release topic' },
            { objectId: 'doc_1', objectType: 'doc', title: 'Runbook v2', version: 'v2' },
            { objectId: 'task_1', objectType: 'task', title: 'Checklist task' },
          ],
          summary: 'Assign a rollback owner before production changes.',
          title: 'Rollback owner playbook',
        },
      ],
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-1',
    });

    expect(normalized).toMatchObject({
      adapter: 'ops-harness-v1',
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-1',
    });
    expect(normalized.drafts[0]).toMatchObject({
      category: 'playbook',
      sourceRefs: [
        { id: 'topic_1', kind: 'topic', title: 'Release topic' },
        { id: 'doc_1', kind: 'document', title: 'Runbook v2' },
      ],
      summary: 'Assign a rollback owner before production changes.',
      title: 'Rollback owner playbook',
    });
    expect(normalized.drafts[0].metadata).toMatchObject({
      harness: {
        adapter: 'ops-harness-v1',
        confidence: 0.92,
        contractVersion: 1,
        decision: {
          confidence: 0.88,
          decision: 'REVIEW',
          reason: 'Possible overlap with existing release guidance.',
          targetEntryId: 'mem_existing',
        },
        kind: 'playbook',
        normalizedKey: 'release.rollback-owner',
        recall: {
          reason: 'The user asked how to run the release checklist.',
          relevance: 0.97,
          slots: ['action'],
        },
        scope: 'space',
        sourceAttribution: [
          { objectId: 'topic_1', objectType: 'topic', title: 'Release topic' },
          { objectId: 'doc_1', objectType: 'doc', title: 'Runbook v2', version: 'v2' },
          { objectId: 'task_1', objectType: 'task', title: 'Checklist task' },
        ],
      },
    });
  });

  it('maps non-policy non-playbook kinds to general category', () => {
    const normalized = normalizeSpaceMemoryHarnessDraft({
      kind: 'fact',
      sourceRefs: [{ objectId: 'msg_1', objectType: 'message', title: 'Quoted reply' }],
      summary: 'Enterprise rollout needs legal signoff.',
      title: 'Legal signoff requirement',
    });

    expect(normalized).toMatchObject({
      category: 'general',
      sourceRefs: [{ id: 'msg_1', kind: 'message', title: 'Quoted reply' }],
      title: 'Legal signoff requirement',
    });
  });
});
