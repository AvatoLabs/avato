import { describe, expect, it } from 'vitest';

import { resolveChatDetailComposerConfig } from './chatDetailComposer';

describe('resolveChatDetailComposerConfig', () => {
  it('falls back to global memory defaults when session settings are absent', () => {
    expect(
      resolveChatDetailComposerConfig({
        globalMemoryEffort: 'high',
        globalMemoryEnabled: true,
        sessionSearchMode: null,
      }),
    ).toEqual({
      memoryEffort: 'high',
      memoryEnabled: true,
      searchEnabled: false,
    });
  });

  it('prefers session-level settings when provided', () => {
    expect(
      resolveChatDetailComposerConfig({
        globalMemoryEffort: 'medium',
        globalMemoryEnabled: true,
        sessionMemoryEffort: 'low',
        sessionMemoryEnabled: false,
        sessionSearchMode: 'on',
      }),
    ).toEqual({
      memoryEffort: 'low',
      memoryEnabled: false,
      searchEnabled: true,
    });
  });
});
