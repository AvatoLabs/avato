import { describe, expect, it } from 'vitest';

import {
  getCreateConfigContextLabel,
  getCreateScreenCopy,
  summarizeCreateConfig,
} from './createWorkspace';
import { enUS } from './i18n';

describe('createWorkspace helpers', () => {
  it('returns mode-specific create screen copy', () => {
    expect(getCreateScreenCopy('artwork', enUS)).toEqual({
      subtitle: enUS.artworkEmptyDesc,
      title: enUS.artworkTitle,
    });

    expect(getCreateScreenCopy('video', enUS)).toEqual({
      subtitle: enUS.videoHistoryEmptyDesc,
      title: enUS.videoTitle,
    });
  });

  it('builds mode-specific config labels and normalized summaries', () => {
    expect(getCreateConfigContextLabel('artwork', enUS)).toBe(enUS.artworkTitle);
    expect(getCreateConfigContextLabel('video', enUS)).toBe(enUS.videoTitle);

    expect(summarizeCreateConfig(['1024', undefined, '1:1'])).toBe('1024 · 1:1');
    expect(summarizeCreateConfig([undefined, ''], enUS.videoNoModels)).toBe(enUS.videoNoModels);
    expect(summarizeCreateConfig([])).toBeUndefined();
  });
});
