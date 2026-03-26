/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProfileEditor from './index';

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => ({
  Divider: () => <hr />,
}));

vi.mock('antd-style', () => ({
  useTheme: () => ({ colorTextSecondary: '#999' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        advancedSettings: 'Advanced Settings',
        startConversation: 'Start Conversation',
      })[key] || key,
  }),
}));

vi.mock('@/features/ModelSelect', () => ({
  default: () => <div data-testid="model-select">model-select</div>,
}));

vi.mock('../AgentCronJobs', () => ({
  default: () => <div data-testid="agent-cron-jobs">agent-cron-jobs</div>,
}));

vi.mock('../AgentSettings', () => ({
  default: () => <div data-testid="agent-settings">agent-settings</div>,
}));

vi.mock('../EditorCanvas', () => ({
  default: () => <div data-testid="editor-canvas">editor-canvas</div>,
}));

vi.mock('../Header/AgentPublishButton', () => ({
  default: () => <button type="button">Publish</button>,
}));

vi.mock('./AgentHeader', () => ({
  default: () => <div data-testid="agent-header">agent-header</div>,
}));

vi.mock('./AgentKnowledgeInline', () => ({
  default: () => <div data-testid="agent-knowledge-inline">agent-knowledge-inline</div>,
}));

vi.mock('./AgentTool', () => ({
  default: () => <div data-testid="agent-tool">agent-tool</div>,
}));

vi.mock('@/hooks/useInterceptingRoutes', () => ({
  useOpenChatSettings: () => vi.fn(),
}));

vi.mock('@/hooks/useQueryRoute', () => ({
  useQueryRoute: () => ({ push: vi.fn() }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentConfig: (s: any) => s.config,
  },
  builtinAgentSelectors: {
    isInboxAgent: (s: any) => s.isInbox,
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: (state: any) => any) =>
    selector({
      activeAgentId: 'agent-1',
      config: { model: 'kimi', provider: 'moonshot' },
      isInbox: true,
      updateAgentConfig: vi.fn(),
    }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (state: any) => any) =>
    selector({
      switchTopic: vi.fn(),
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: {
    enableBusinessFeatures: (s: any) => s.enableBusinessFeatures,
  },
  useServerConfigStore: (selector: (state: any) => any) =>
    selector({
      enableBusinessFeatures: false,
    }),
}));

describe('ProfileEditor', () => {
  it('renders the inline knowledge entry for inbox agents', () => {
    render(<ProfileEditor />);

    expect(screen.getByTestId('agent-knowledge-inline')).toBeInTheDocument();
  });
});
