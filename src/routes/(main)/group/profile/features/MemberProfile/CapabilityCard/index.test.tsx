/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CapabilityCard from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockUpdateAgentConfigById = vi.hoisted(() => vi.fn());
const agentStoreState = vi.hoisted(() => ({
  agentMap: {
    'agent-1': {
      model: 'gpt-4o',
      provider: 'openai',
    },
  } as Record<string, { model: string; provider: string }>,
  updateAgentConfigById: mockUpdateAgentConfigById,
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
  Collapse: ({ items }: any) => (
    <div>
      {items.map((item: any) => (
        <section key={item.key}>
          <div>{item.label}</div>
          <div>{item.children}</div>
        </section>
      ))}
    </div>
  ),
}));

vi.mock('antd-style', () => ({
  useTheme: () => ({
    borderRadiusLG: 8,
    colorBgContainer: '#fff',
    colorBorderSecondary: '#ddd',
    colorPrimary: '#1677ff',
    colorText: '#111',
    colorTextSecondary: '#666',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/ModelSelect', () => ({
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange({ model: 'gpt-5.1', provider: 'openai' })}>
      change-model
    </button>
  ),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgentConfigById: (agentId: string) => (state: typeof agentStoreState) =>
      state.agentMap[agentId],
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) => selector(agentStoreState),
}));

vi.mock('@/store/groupProfile', () => ({
  useGroupProfileStore: (selector: any) =>
    selector({
      activeTabId: 'agent-1',
    }),
}));

vi.mock('../AgentTool', () => ({
  default: () => <div>agent-tool</div>,
}));

describe('CapabilityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when updating the model fails', async () => {
    const error = new Error('update failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateAgentConfigById.mockRejectedValue(error);

    render(<CapabilityCard />);

    fireEvent.click(screen.getByRole('button', { name: 'change-model' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('settingAgent.model.updateError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CapabilityCard] Failed to update agent model:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
