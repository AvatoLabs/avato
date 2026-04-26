import type { SearchMemoryResult } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import type { PublishedSpaceMemoryRecallEntry } from '@/database/models/spaceMemory';
import { calculateWeightedLength } from '@/utils/textLength';

import {
  buildUserMemoryDataFromSpaceMemory,
  mergeRetrieveMemoryResultWithSpaceMemory,
} from './recall';

const makeLongText = (prefix: string, tailMarker: string) =>
  `${Array.from({ length: 120 }, (_, index) => `${prefix} step ${index}`).join(' ')} ${tailMarker}`;

const makeEntry = (
  overrides: Partial<PublishedSpaceMemoryRecallEntry> & Pick<PublishedSpaceMemoryRecallEntry, 'category'>,
): PublishedSpaceMemoryRecallEntry => ({
  category: overrides.category,
  content: overrides.content ?? null,
  id: overrides.id ?? `sm-${overrides.category}-1`,
  publishedAt: overrides.publishedAt ?? '2026-04-05T08:00:00.000Z',
  summary: overrides.summary ?? null,
  title: overrides.title ?? 'Shared memory',
  updatedAt: overrides.updatedAt ?? '2026-04-05T08:00:00.000Z',
});

describe('spaceMemory recall packaging', () => {
  it('compresses general recall descriptions within the context budget', () => {
    const data = buildUserMemoryDataFromSpaceMemory([
      makeEntry({
        category: 'general',
        content: makeLongText('Rollback owners stay assigned through the deploy.', 'GENERAL_TAIL'),
        summary: 'Rollback ownership is mandatory before deployment approval.',
        title: 'Rollback owner',
      }),
    ]);

    expect(data.contexts).toHaveLength(1);
    expect(data.contexts[0]?.description).toContain(
      'Rollback ownership is mandatory before deployment approval.',
    );
    expect(data.contexts[0]?.description).not.toContain('GENERAL_TAIL');
    expect(calculateWeightedLength(data.contexts[0]!.description ?? '')).toBeLessThanOrEqual(360);
  });

  it('compresses playbook and policy recall payloads within category-specific budgets', () => {
    const data = buildUserMemoryDataFromSpaceMemory([
      makeEntry({
        category: 'playbook',
        content: makeLongText('Escalate rollback ownership before rollout.', 'PLAYBOOK_TAIL'),
        summary: 'Pre-assign the rollback owner and approver.',
        title: makeLongText('Rollback drill title', 'PLAYBOOK_TITLE_TAIL'),
      }),
      makeEntry({
        category: 'policy',
        content: makeLongText('Do not publish ETAs without approver sign-off.', 'POLICY_TAIL'),
        summary: 'External ETA commitments require approval.',
        title: 'Customer communications',
      }),
    ]);

    expect(data.experiences).toHaveLength(1);
    expect(data.preferences).toHaveLength(1);
    expect(data.experiences[0]?.action).toContain('Escalate rollback ownership before rollout.');
    expect(data.experiences[0]?.action).not.toContain('PLAYBOOK_ACTION_TAIL');
    expect(data.experiences[0]?.keyLearning).not.toContain('PLAYBOOK_TAIL');
    expect(data.experiences[0]?.situation).not.toContain('PLAYBOOK_TITLE_TAIL');
    expect(calculateWeightedLength(data.experiences[0]!.keyLearning ?? '')).toBeLessThanOrEqual(
      280,
    );
    expect(calculateWeightedLength(data.experiences[0]!.situation ?? '')).toBeLessThanOrEqual(120);
    expect(data.preferences[0]?.conclusionDirectives).toContain('Customer communications');
    expect(data.preferences[0]?.conclusionDirectives).not.toContain('POLICY_TAIL');
    expect(data.preferences[0]?.suggestions).toContain('External ETA commitments require approval.');
    expect(calculateWeightedLength(data.preferences[0]!.conclusionDirectives ?? '')).toBeLessThanOrEqual(
      320,
    );
  });

  it('caps total injected recall volume per category instead of only truncating each entry', () => {
    const data = buildUserMemoryDataFromSpaceMemory([
      makeEntry({
        category: 'general',
        content: makeLongText('First general memory stays in budget.', 'FIRST_GENERAL_TAIL'),
        id: 'sm-general-1',
        summary: 'First general summary',
        title: 'First general',
      }),
      makeEntry({
        category: 'general',
        content: makeLongText('Second general memory would exceed the total budget.', 'SECOND_GENERAL_TAIL'),
        id: 'sm-general-2',
        summary: 'Second general summary',
        title: 'Second general',
      }),
      makeEntry({
        category: 'general',
        content: makeLongText('Third general memory should also stay out.', 'THIRD_GENERAL_TAIL'),
        id: 'sm-general-3',
        summary: 'Third general summary',
        title: 'Third general',
      }),
    ]);

    expect(data.contexts.map((item) => item.id)).toEqual(['sm-general-1']);
  });

  it('expands policy directive packaging for policy-focused queries', () => {
    const entries = [
      makeEntry({
        category: 'policy',
        content: makeLongText(
          'Do not promise external incident ETAs without incident commander approval.',
          'POLICY_DIRECTIVE_TAIL',
        ),
        id: 'sm-policy-1',
        summary: 'Customer ETA commitments require explicit approval.',
        title: 'Customer communications',
      }),
    ];

    const neutral = buildUserMemoryDataFromSpaceMemory(entries);
    const policyFocused = buildUserMemoryDataFromSpaceMemory(entries, {
      query: 'Can we promise a customer ETA during an incident?',
    });

    expect(neutral.preferences).toHaveLength(1);
    expect(policyFocused.preferences).toHaveLength(1);
    expect(
      calculateWeightedLength(policyFocused.preferences[0]!.conclusionDirectives ?? ''),
    ).toBeGreaterThan(calculateWeightedLength(neutral.preferences[0]!.conclusionDirectives ?? ''));
    expect(
      calculateWeightedLength(policyFocused.preferences[0]!.conclusionDirectives ?? ''),
    ).toBeLessThanOrEqual(432);
  });

  it('expands playbook packaging for procedure-focused queries', () => {
    const entries = [
      makeEntry({
        category: 'playbook',
        content: makeLongText(
          'Run the rollback drill and verify owner handoff before rollout.',
          'PLAYBOOK_ACTION_TAIL',
        ),
        id: 'sm-playbook-1',
        summary: 'Walk through the rollback checklist before approving deploys.',
        title: 'Rollback drill',
      }),
    ];

    const neutral = buildUserMemoryDataFromSpaceMemory(entries);
    const playbookFocused = buildUserMemoryDataFromSpaceMemory(entries, {
      query: 'How do we run the rollback checklist procedure?',
    });

    expect(neutral.experiences).toHaveLength(1);
    expect(playbookFocused.experiences).toHaveLength(1);
    expect(
      calculateWeightedLength(playbookFocused.experiences[0]!.keyLearning ?? ''),
    ).toBeGreaterThan(calculateWeightedLength(neutral.experiences[0]!.keyLearning ?? ''));
    expect(calculateWeightedLength(playbookFocused.experiences[0]!.keyLearning ?? '')).toBeLessThanOrEqual(
      378,
    );
  });

  it('dedupes repeated recall sentences and prefers complete sentence units', () => {
    const data = buildUserMemoryDataFromSpaceMemory([
      makeEntry({
        category: 'policy',
        content:
          'Customer ETA commitments require approval. Escalate to the incident commander before replying. Avoid making external commitments in Slack threads without approval.',
        id: 'sm-policy-dedupe',
        summary: 'Customer ETA commitments require approval.',
        title: 'Customer comms',
      }),
    ]);

    expect(data.preferences).toHaveLength(1);
    expect(data.preferences[0]?.conclusionDirectives).toContain(
      'Customer ETA commitments require approval.',
    );
    expect(data.preferences[0]?.conclusionDirectives).toContain(
      'Escalate to the incident commander before replying.',
    );
    expect(data.preferences[0]?.conclusionDirectives).not.toContain(
      'Customer ETA commitments require approval.\n\nCustomer ETA commitments require approval.',
    );
  });

  it('merges compacted recall results into topic memory retrieval output', () => {
    const base: SearchMemoryResult = {
      activities: [],
      contexts: [
        {
          accessedAt: new Date('2026-04-05T08:00:00.000Z'),
          associatedObjects: null,
          associatedSubjects: null,
          createdAt: new Date('2026-04-05T08:00:00.000Z'),
          currentStatus: null,
          description: 'Existing personal context',
          id: 'ctx-existing',
          metadata: null,
          scoreImpact: null,
          scoreUrgency: null,
          tags: null,
          title: 'Existing context',
          type: 'context',
          updatedAt: new Date('2026-04-05T08:00:00.000Z'),
          userMemoryIds: null,
        },
      ],
      experiences: [],
      preferences: [],
    };

    const result = mergeRetrieveMemoryResultWithSpaceMemory(base, [
      makeEntry({
        category: 'general',
        content: makeLongText('Rollback owner guidance.', 'GENERAL_SEARCH_TAIL'),
        id: 'ctx-existing',
        summary: 'This entry should dedupe against the existing personal context.',
        title: 'Rollback owner',
      }),
      makeEntry({
        category: 'playbook',
        content: makeLongText('Run the rollback drill.', 'PLAYBOOK_SEARCH_TAIL'),
        id: 'sm-playbook-search',
        summary: 'Practice the rollback sequence before rollout.',
        title: 'Rollback drill',
      }),
      makeEntry({
        category: 'playbook',
        content: makeLongText('This second playbook would exceed the total budget.', 'PLAYBOOK_SEARCH_TAIL_2'),
        id: 'sm-playbook-search-2',
        summary: 'A second long playbook entry.',
        title: 'Rollback drill follow-up',
      }),
      makeEntry({
        category: 'policy',
        content: makeLongText('Incident updates require approval.', 'POLICY_SEARCH_TAIL'),
        id: 'sm-policy-search',
        summary: 'Customer communications require approval.',
        title: 'Customer comms',
      }),
    ]);

    expect(result.contexts).toHaveLength(1);
    expect(result.contexts[0]?.id).toBe('ctx-existing');
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0]?.id).toBe('sm-playbook-search');
    expect(result.experiences[0]?.action).not.toContain('PLAYBOOK_SEARCH_TAIL');
    expect(calculateWeightedLength(result.experiences[0]!.action!)).toBeLessThanOrEqual(240);
    expect(result.preferences).toHaveLength(1);
    expect(result.preferences[0]?.conclusionDirectives).not.toContain('POLICY_SEARCH_TAIL');
    expect(result.preferences[0]?.suggestions).toContain('Customer communications require approval.');
    expect(
      calculateWeightedLength(result.preferences[0]!.conclusionDirectives ?? ''),
    ).toBeLessThanOrEqual(320);
  });
});
