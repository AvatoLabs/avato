import { ComputerUseManifest } from '@lobechat/builtin-tool-computer-use';
import { describe, expect, it } from 'vitest';

import { partitionToolsByIntervention } from './partitionToolsByIntervention';

describe('partitionToolsByIntervention', () => {
  it('requires approval for Computer Use mutating APIs while allowing screenshots', () => {
    const screenshotCall = {
      apiName: 'screenshot',
      arguments: '{}',
      id: 'screenshot-call',
      identifier: ComputerUseManifest.identifier,
      type: 'builtin' as const,
    };
    const clickCall = {
      apiName: 'click',
      arguments: '{"x":10,"y":20}',
      id: 'click-call',
      identifier: ComputerUseManifest.identifier,
      type: 'builtin' as const,
    };

    const [needsIntervention, executable] = partitionToolsByIntervention(
      [screenshotCall, clickCall],
      { approvalMode: 'manual' },
      { [ComputerUseManifest.identifier]: ComputerUseManifest },
    );

    expect(executable).toEqual([screenshotCall]);
    expect(needsIntervention).toEqual([clickCall]);
  });
});
