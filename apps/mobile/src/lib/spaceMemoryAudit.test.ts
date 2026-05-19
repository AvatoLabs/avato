import { describe, expect, it } from 'vitest';

import type { MobileSpaceMemoryGovernanceHistoryPreview } from '../types';
import { useI18n } from './i18n';
import { buildMobileSpaceMemoryAuditRows } from './spaceMemoryAudit';

const t = useI18n.getState().t;

describe('buildMobileSpaceMemoryAuditRows', () => {
  it('formats action, actor meta, and field diffs', () => {
    const history: MobileSpaceMemoryGovernanceHistoryPreview[] = [
      {
        action: 'policy_updated',
        actor: { name: 'Avery' },
        at: '2026-04-06T09:08:07.000Z',
        changes: {
          recallEnabled: { after: false, before: true },
          summary: { after: 'New summary', before: 'Old summary' },
        },
      },
    ];

    expect(buildMobileSpaceMemoryAuditRows(history, t)).toEqual([
      {
        details: ['Recall：启用中 -> 已暂停', '摘要：Old summary -> New summary'],
        meta: expect.stringMatching(/^由 Avery 于 2026-04-06 \d{2}:\d{2}$/),
        title: '已更新策略',
      },
    ]);
  });

  it('formats merge resolution and set-only changes', () => {
    const history: MobileSpaceMemoryGovernanceHistoryPreview[] = [
      {
        action: 'merged',
        at: '2026-04-06T09:08:07.000Z',
        changes: {
          expiresAt: { after: '2026-04-10T10:00:00.000Z' },
        },
        resolution: { appendSources: true },
        sourceTitle: 'Release playbook',
      },
    ];

    expect(buildMobileSpaceMemoryAuditRows(history, t)[0]).toMatchObject({
      details: [
        '已合并变更到 Release playbook',
        expect.stringMatching(/^到期：2026-04-10 \d{2}:\d{2}$/),
      ],
      title: '已合并到正式记忆',
    });
  });
});
