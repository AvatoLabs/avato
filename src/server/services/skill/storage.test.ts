// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  buildSkillResourceStorageKey,
  buildSkillZipStorageKey,
  getSkillResourceStoragePrefix,
  getSkillZipStorageDirname,
} from './storage';

describe('skill storage helpers', () => {
  it('builds deterministic opaque ZIP storage keys without exposing the raw hash', () => {
    const zipHash = 'abc123rawhash';
    const key = buildSkillZipStorageKey(zipHash);

    expect(key).toMatch(/^skills\/packages\/[a-f0-9]{2}\/[a-f0-9]{64}\.zip$/);
    expect(key).not.toContain(zipHash);
  });

  it('returns the shared ZIP storage dirname', () => {
    expect(getSkillZipStorageDirname()).toBe('skills/packages');
  });

  it('builds deterministic opaque resource storage keys without exposing the raw zip hash', () => {
    const zipHash = 'abc123rawhash';
    const key = buildSkillResourceStorageKey(zipHash, 'deadbeefcafebabe.md');

    expect(key).toMatch(/^skills\/source-files\/[a-f0-9]{16}\/deadbeefcafebabe\.md$/);
    expect(key).not.toContain(zipHash);
  });

  it('returns the shared resource storage prefix', () => {
    expect(getSkillResourceStoragePrefix()).toBe('skills/source-files');
  });
});
