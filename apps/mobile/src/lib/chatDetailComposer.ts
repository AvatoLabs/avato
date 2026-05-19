import type { MobileMemoryEffort } from '../types';

interface ResolveChatDetailComposerConfigParams {
  globalMemoryEffort: MobileMemoryEffort;
  globalMemoryEnabled: boolean;
  sessionMemoryEffort?: MobileMemoryEffort | null;
  sessionMemoryEnabled?: boolean | null;
  sessionSearchMode?: string | null;
}

export function resolveChatDetailComposerConfig({
  globalMemoryEffort,
  globalMemoryEnabled,
  sessionMemoryEffort,
  sessionMemoryEnabled,
  sessionSearchMode,
}: ResolveChatDetailComposerConfigParams) {
  return {
    memoryEffort: sessionMemoryEffort || globalMemoryEffort,
    memoryEnabled: sessionMemoryEnabled ?? globalMemoryEnabled,
    searchEnabled: sessionSearchMode ? sessionSearchMode !== 'off' : false,
  };
}
