import { describe, expect, it } from 'vitest';

import { ComputerUseManifest } from './manifest';
import { ComputerUseApiName } from './types';

describe('ComputerUseManifest', () => {
  const getApi = (name: string) => ComputerUseManifest.api.find((api) => api.name === name);

  it('keeps observation APIs auto-runnable', () => {
    expect(getApi(ComputerUseApiName.screenshot)?.humanIntervention).toBeUndefined();
    expect(getApi(ComputerUseApiName.getDisplays)?.humanIntervention).toBeUndefined();
    expect(ComputerUseManifest.humanIntervention).toBe('never');
  });

  it('requires confirmation for mutating desktop-control APIs', () => {
    const mutatingApis = [
      ComputerUseApiName.click,
      ComputerUseApiName.doubleClick,
      ComputerUseApiName.drag,
      ComputerUseApiName.scroll,
      ComputerUseApiName.typeText,
      ComputerUseApiName.pressKey,
    ];

    for (const apiName of mutatingApis) {
      expect(getApi(apiName)?.humanIntervention).toBe('required');
    }
  });
});
