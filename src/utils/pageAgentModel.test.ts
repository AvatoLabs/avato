import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import { DEFAULT_MODEL } from '@lobechat/const';
import { describe, expect, it } from 'vitest';

import {
  isCompleteModelProviderConfig,
  isLegacyDocsAgentModelConfig,
  resolveModelProviderWithFallback,
  shouldSyncDocsAgentToUserDefault,
} from './docsAgentModel';

describe('docsAgentModel', () => {
  it('should detect complete model/provider config', () => {
    expect(isCompleteModelProviderConfig({ model: 'kimi-2.5', provider: 'moonshot' })).toBe(true);
    expect(isCompleteModelProviderConfig({ model: 'kimi-2.5' })).toBe(false);
    expect(isCompleteModelProviderConfig(undefined)).toBe(false);
  });

  it('should detect legacy page agent config', () => {
    expect(isLegacyDocsAgentModelConfig({ model: DEFAULT_MODEL, provider: DEFAULT_PROVIDER })).toBe(
      true,
    );
    expect(isLegacyDocsAgentModelConfig({ model: 'kimi-2.5', provider: 'moonshot' })).toBe(false);
  });

  it('should resolve model/provider with fallback', () => {
    expect(
      resolveModelProviderWithFallback(
        { model: 'kimi-2.5', provider: 'moonshot' },
        { model: 'claude-sonnet', provider: 'anthropic' },
      ),
    ).toEqual({ model: 'kimi-2.5', provider: 'moonshot' });

    expect(
      resolveModelProviderWithFallback(
        { model: 'kimi-2.5' },
        { model: 'claude-sonnet', provider: 'anthropic' },
      ),
    ).toEqual({ model: 'claude-sonnet', provider: 'anthropic' });

    expect(resolveModelProviderWithFallback({ model: 'kimi-2.5' }, undefined)).toEqual({});
  });

  it('should sync page agent when config is missing or still on legacy defaults', () => {
    const userDefault = { model: 'kimi-2.5', provider: 'moonshot' };

    expect(shouldSyncDocsAgentToUserDefault(undefined, userDefault)).toBe(true);
    expect(
      shouldSyncDocsAgentToUserDefault(
        { model: DEFAULT_MODEL, provider: DEFAULT_PROVIDER },
        userDefault,
      ),
    ).toBe(true);
    expect(shouldSyncDocsAgentToUserDefault(userDefault, userDefault)).toBe(false);
    expect(
      shouldSyncDocsAgentToUserDefault({ model: 'gpt-5', provider: 'openai' }, userDefault),
    ).toBe(false);
  });
});
