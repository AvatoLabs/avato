import { describe, expect, it } from 'vitest';

import type { MobileSpaceMemoryEntryPreview } from '../types';
import { useI18n } from './i18n';
import {
  buildMobileSpaceMemoryEntryMeta,
  getMobileSpaceMemoryIntakeLabel,
  getMobileSpaceMemoryRecallLabel,
} from './spaceMemoryEntryMeta';

const t = useI18n.getState().t;

const baseEntry: MobileSpaceMemoryEntryPreview = {
  actor: { id: 'u_1', name: 'Avery' },
  category: 'policy',
  content: 'Finalized reminder for deployment windows.',
  id: 'mem_1',
  intake: { origin: 'automation' },
  kind: 'memory',
  publishedAt: '2026-04-06T09:08:07.000Z',
  recall: { recallEnabled: true },
  sourceCount: 3,
  sourceRefs: [],
  summary: 'Deployment window guidance',
  title: 'Deployment window guidance',
  updatedAt: '2026-04-05T08:07:06.000Z',
};

describe('getMobileSpaceMemoryIntakeLabel', () => {
  it('maps known origins to localized labels', () => {
    expect(getMobileSpaceMemoryIntakeLabel(t, 'automation')).toBe('自动化');
    expect(getMobileSpaceMemoryIntakeLabel(t, 'manual')).toBe('手动');
  });
});

describe('getMobileSpaceMemoryRecallLabel', () => {
  it('maps recall status to localized labels', () => {
    expect(getMobileSpaceMemoryRecallLabel(t, { recallEnabled: true })).toBe('启用中');
    expect(
      getMobileSpaceMemoryRecallLabel(t, {
        recallBlockedReason: 'expired',
        recallEnabled: true,
      }),
    ).toBe('已过期');
  });
});

describe('buildMobileSpaceMemoryEntryMeta', () => {
  it('builds list metadata for intake, recall, actor, and date', () => {
    expect(buildMobileSpaceMemoryEntryMeta(baseEntry, t)).toEqual([
      { label: '3 个来源' },
      { label: '自动化' },
      { label: 'Recall: 启用中', tone: 'success' },
      { label: '由 Avery' },
      { label: '发布于 2026-04-06' },
    ]);
  });

  it('uses datetime formatting for detailed entry views', () => {
    expect(buildMobileSpaceMemoryEntryMeta(baseEntry, t, { detailedDate: true })[4]).toMatchObject(
      {
        label: expect.stringMatching(/^发布于 2026-04-06 \d{2}:\d{2}$/),
      },
    );
  });
});
