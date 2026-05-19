import { describe, expect, it } from 'vitest';

import type {
  MemoryActivityItem,
  MemoryContextItem,
  MemoryIdentityItem,
  MemoryPreferenceItem,
} from '../types';
import { buildMemoryEditState, hasMemoryEditChanges } from './memoryEditing';

describe('buildMemoryEditState', () => {
  it('builds identity edit state from item and detail summary', () => {
    const item: MemoryIdentityItem = {
      createdAt: '2026-04-06T00:00:00.000Z',
      id: 'mem_1',
      title: 'Arthur',
      updatedAt: '2026-04-06T00:00:00.000Z',
    };

    expect(
      buildMemoryEditState({
        item,
        layer: 'identity',
        memory: { id: 'base_1', title: 'Fallback', updatedAt: '2026-04-06T00:00:00.000Z' },
        summary: 'Founder profile',
      }),
    ).toEqual({
      summary: 'Founder profile',
      title: 'Arthur',
    });
  });
});

describe('hasMemoryEditChanges', () => {
  it('detects no changes when draft matches current context item', () => {
    const item: MemoryContextItem = {
      createdAt: '2026-04-06T00:00:00.000Z',
      currentStatus: 'In progress',
      description: 'Context detail',
      id: 'mem_2',
      title: 'Project Alpha',
      updatedAt: '2026-04-06T00:00:00.000Z',
    };

    expect(
      hasMemoryEditChanges({
        editState: {
          currentStatus: 'In progress',
          description: 'Context detail',
          title: 'Project Alpha',
        },
        item,
        layer: 'context',
      }),
    ).toBe(false);
  });

  it('detects changes for activity edits', () => {
    const item: MemoryActivityItem = {
      createdAt: '2026-04-06T00:00:00.000Z',
      id: 'mem_3',
      narrative: 'Met with design',
      notes: 'Original note',
      status: 'done',
      updatedAt: '2026-04-06T00:00:00.000Z',
    };

    expect(
      hasMemoryEditChanges({
        editState: {
          narrative: 'Met with design',
          notes: 'Updated note',
          status: 'done',
        },
        item,
        layer: 'activity',
      }),
    ).toBe(true);
  });

  it('treats empty preference drafts as unchanged when source is empty', () => {
    const item: MemoryPreferenceItem = {
      conclusionDirectives: '',
      createdAt: '2026-04-06T00:00:00.000Z',
      id: 'mem_4',
      suggestions: '',
      updatedAt: '2026-04-06T00:00:00.000Z',
    };

    expect(
      hasMemoryEditChanges({
        editState: {
          conclusionDirectives: '',
          suggestions: '',
        },
        item,
        layer: 'preference',
      }),
    ).toBe(false);
  });
});
