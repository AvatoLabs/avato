import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import { DEFAULT_MODEL } from '@lobechat/const';
import { describe, expect, it } from 'vitest';

import {
  isCompleteModelProviderConfig,
  isLegacyPageAgentModelConfig,
  resolveModelProviderWithFallback,
  shouldSyncPageAgentToUserDefault,
} from './pageAgentModel';

describe('pageAgentModel', () => {
  it('should detect complete model/provider config', () => {
    expect(isCompleteModelProviderConfig({ model: 'kimi-2.5', provider: 'moonshot' })).toBe(true);
    expect(isCompleteModelProviderConfig({ model: 'kimi-2.5' })).toBe(false);
    expect(isCompleteModelProviderConfig(undefined)).toBe(false);
  });

  it('should detect legacy page agent config', () => {
    expect(isLegacyPageAgentModelConfig({ model: DEFAULT_MODEL, provider: DEFAULT_PROVIDER })).toBe(
      true,
    );
    expect(isLegacyPageAgentModelConfig({ model: 'kimi-2.5', provider: 'moonshot' })).toBe(false);
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

    expect(shouldSyncPageAgentToUserDefault(undefined, userDefault)).toBe(true);
    expect(
      shouldSyncPageAgentToUserDefault(
        { model: DEFAULT_MODEL, provider: DEFAULT_PROVIDER },
        userDefault,
      ),
    ).toBe(true);
    expect(shouldSyncPageAgentToUserDefault(userDefault, userDefault)).toBe(false);
    expect(
      shouldSyncPageAgentToUserDefault({ model: 'gpt-5', provider: 'openai' }, userDefault),
    ).toBe(false);
  });
});
