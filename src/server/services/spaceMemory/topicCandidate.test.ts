import { describe, expect, it } from 'vitest';

import { buildTopicSpaceMemoryCandidateDraft } from './topicCandidate';

describe('buildTopicSpaceMemoryCandidateDraft', () => {
  it('prefers history summary and appends recent context lines', () => {
    const result = buildTopicSpaceMemoryCandidateDraft({
      messages: [
        { content: 'Need a deployment checklist.', id: 'msg_1', role: 'user' } as any,
        {
          content: 'Include smoke tests and rollback owner.',
          id: 'msg_2',
          role: 'assistant',
        } as any,
      ],
      topic: {
        historySummary: 'The team agreed on a repeatable Friday deployment checklist.',
        id: 'topic_1',
        title: 'Friday rollout',
      },
    });

    expect(result).toMatchObject({
      category: 'general',
      summary: 'The team agreed on a repeatable Friday deployment checklist.',
      title: 'Friday rollout',
    });
    expect(result?.content).toContain('Recent context:');
    expect(result?.sourceRefs).toEqual([
      { id: 'topic_1', kind: 'topic', title: 'Friday rollout' },
      { id: 'msg_1', kind: 'message', title: 'Need a deployment checklist.' },
      { id: 'msg_2', kind: 'message', title: 'Include smoke tests and rollback owner.' },
    ]);
  });

  it('falls back to recent messages when history summary is missing', () => {
    const result = buildTopicSpaceMemoryCandidateDraft({
      messages: [
        { content: 'Alpha client needs a revised pricing note.', id: 'msg_1', role: 'user' } as any,
        {
          content: 'Capture pricing exception and renewal window.',
          id: 'msg_2',
          role: 'assistant',
        } as any,
      ],
      topic: {
        historySummary: null,
        id: 'topic_2',
        title: '',
      },
    });

    expect(result?.summary).toContain('Alpha client needs a revised pricing note.');
    expect(result?.title).toBeTruthy();
  });

  it('returns null when there is no usable summary or message text', () => {
    const result = buildTopicSpaceMemoryCandidateDraft({
      messages: [{ content: [{ type: 'image' }], id: 'msg_1', role: 'assistant' } as any],
      topic: {
        historySummary: null,
        id: 'topic_3',
        title: '',
      },
    });

    expect(result).toBeNull();
  });
});
