import { describe, expect, it } from 'vitest';

import type { MobileSpaceMemoryReviewHintPreview } from '../types';
import { useI18n } from './i18n';
import { buildMobileSpaceMemoryReviewHintSummary } from './spaceMemoryReviewHint';

const t = useI18n.getState().t;

describe('buildMobileSpaceMemoryReviewHintSummary', () => {
  it('returns null when no review hint is present', () => {
    expect(buildMobileSpaceMemoryReviewHintSummary(undefined, t)).toBeNull();
  });

  it('summarizes duplicate-published merge hints', () => {
    const reviewHint: MobileSpaceMemoryReviewHintPreview = {
      kind: 'duplicate_published',
      match: {
        id: 'mem_published',
        publishedAt: '2026-04-06T09:08:07.000Z',
        summary: 'Published summary',
        title: 'Release policy',
      },
      mergePreview: {
        addedSourceCount: 2,
        updatesContent: true,
        updatesSummary: false,
        updatesTitle: true,
      },
    };

    expect(buildMobileSpaceMemoryReviewHintSummary(reviewHint, t)).toEqual({
      impact: ['更新标题', '更新内容', '新增 2 个来源'],
      meta: [
        '发布候选前，先检查合并影响。',
        expect.stringMatching(/^匹配 Release policy$/),
        expect.stringMatching(/^发布于 2026-04-06 \d{2}:\d{2}$/),
      ],
      title: '可能重复',
    });
  });
});
