import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { agentService } from '@/services/agent';
import { AgentSourceKind } from '@/types/sourceSet';
import { withSWR } from '~test-utils';

import { useAgentStore } from '../../store';

// Mock zustand/traditional for store testing
vi.mock('zustand/traditional');

// Mock agentService
vi.mock('@/services/agent', () => ({
  agentService: {
    createAgentFiles: vi.fn(),
    attachSourceSetToAgent: vi.fn(),
    deleteAgentFile: vi.fn(),
    detachSourceSetFromAgent: vi.fn(),
    listAvailableSources: vi.fn(),
    toggleFile: vi.fn(),
    setSourceSetEnabled: vi.fn(),
  },
}));

// Mock SWR mutate
vi.mock('swr', async () => {
  const actual = await vi.importActual('swr');
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  setActiveWorkspaceSpaceId(undefined);
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/');
  }
  useAgentStore.setState({
    activeAgentId: undefined,
    agentMap: {},
    builtinAgentIdMap: {},
    updateAgentConfigSignal: undefined,
    updateAgentMetaSignal: undefined,
  });
});

afterEach(() => {
  setActiveWorkspaceSpaceId(undefined);
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/');
  }
  vi.restoreAllMocks();
});

describe('SourceSlice Actions', () => {
  describe('addFilesToAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.addFilesToAgent(['file-1', 'file-2']);
      });

      expect(agentService.createAgentFiles).not.toHaveBeenCalled();
    });

    it('should not call service if fileIds is empty', async () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.addFilesToAgent([]);
      });

      expect(agentService.createAgentFiles).not.toHaveBeenCalled();
    });

    it('should call createAgentFiles with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.createAgentFiles).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.addFilesToAgent(['file-1', 'file-2'], true);
      });

      expect(agentService.createAgentFiles).toHaveBeenCalledWith(
        'agent-1',
        ['file-1', 'file-2'],
        true,
      );
    });
  });

  describe('attachSourceSetToAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.attachSourceSetToAgent('kb-1');
      });

      expect(agentService.attachSourceSetToAgent).not.toHaveBeenCalled();
    });

    it('should call attachSourceSetToAgent with enabled=true', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.attachSourceSetToAgent).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.attachSourceSetToAgent('kb-1');
      });

      expect(agentService.attachSourceSetToAgent).toHaveBeenCalledWith('agent-1', 'kb-1', true);
    });
  });

  describe('removeFileFromAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.removeFileFromAgent('file-1');
      });

      expect(agentService.deleteAgentFile).not.toHaveBeenCalled();
    });

    it('should call deleteAgentFile with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.deleteAgentFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.removeFileFromAgent('file-1');
      });

      expect(agentService.deleteAgentFile).toHaveBeenCalledWith('agent-1', 'file-1');
    });
  });

  describe('detachSourceSetFromAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.detachSourceSetFromAgent('kb-1');
      });

      expect(agentService.detachSourceSetFromAgent).not.toHaveBeenCalled();
    });

    it('should call detachSourceSetFromAgent with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.detachSourceSetFromAgent).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.detachSourceSetFromAgent('kb-1');
      });

      expect(agentService.detachSourceSetFromAgent).toHaveBeenCalledWith('agent-1', 'kb-1');
    });
  });

  describe('toggleFile', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.toggleFile('file-1', true);
      });

      expect(agentService.toggleFile).not.toHaveBeenCalled();
    });

    it('should call toggleFile with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.toggleFile('file-1', true);
      });

      expect(agentService.toggleFile).toHaveBeenCalledWith('agent-1', 'file-1', true);
    });

    it('should call toggleFile with open=false', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.toggleFile('file-1', false);
      });

      expect(agentService.toggleFile).toHaveBeenCalledWith('agent-1', 'file-1', false);
    });
  });

  describe('setSourceSetEnabled', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.setSourceSetEnabled('kb-1', true);
      });

      expect(agentService.setSourceSetEnabled).not.toHaveBeenCalled();
    });

    it('should call setSourceSetEnabled with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.setSourceSetEnabled).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.setSourceSetEnabled('kb-1', true);
      });

      expect(agentService.setSourceSetEnabled).toHaveBeenCalledWith('agent-1', 'kb-1', true);
    });

    it('should call setSourceSetEnabled with open=false', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.setSourceSetEnabled).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.setSourceSetEnabled('kb-1', false);
      });

      expect(agentService.setSourceSetEnabled).toHaveBeenCalledWith('agent-1', 'kb-1', false);
    });
  });

  describe('useFetchAvailableSources', () => {
    it('should fetch files and knowledge bases for active agent', async () => {
      const mockData = [
        { enabled: true, id: 'file-1', name: 'file1.txt', type: AgentSourceKind.File },
        { enabled: true, id: 'kb-1', name: 'KB 1', type: AgentSourceKind.SourceSet },
      ];

      vi.mocked(agentService.listAvailableSources).mockResolvedValueOnce(mockData);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      const { result } = renderHook(() => useAgentStore().useFetchAvailableSources('agent-1'), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toEqual(mockData));

      expect(agentService.listAvailableSources).toHaveBeenCalledWith('agent-1', null);
    });

    it('should return empty array as fallback', async () => {
      vi.mocked(agentService.listAvailableSources).mockResolvedValueOnce([]);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      const { result } = renderHook(() => useAgentStore().useFetchAvailableSources('agent-1'), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toEqual([]));
    });

    it('should scope the fetch to the active workspace', async () => {
      setActiveWorkspaceSpaceId('space-1');
      vi.mocked(agentService.listAvailableSources).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useAgentStore().useFetchAvailableSources('agent-1'), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toEqual([]));

      expect(agentService.listAvailableSources).toHaveBeenCalledWith('agent-1', 'space-1');
    });

    it('should prefer the current workspace route over the mutable hint', async () => {
      setActiveWorkspaceSpaceId('space-hint');
      window.history.replaceState({}, '', '/spaces/space-route/files');
      vi.mocked(agentService.listAvailableSources).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useAgentStore().useFetchAvailableSources('agent-1'), {
        wrapper: withSWR,
      });

      await waitFor(() => expect(result.current.data).toEqual([]));

      expect(agentService.listAvailableSources).toHaveBeenCalledWith('agent-1', 'space-route');
    });
  });
});
