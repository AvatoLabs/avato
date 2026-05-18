/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { AgentSourceKind } from '@/types/sourceSet';

import Actions from './Action';

const attachSourceSetToAgent = vi.fn();
const addFilesToAgent = vi.fn();
const removeFileFromAgent = vi.fn();
const detachSourceSetFromAgent = vi.fn();
const addFilesToConversation = vi.fn();
const deleteConversationFile = vi.fn();
const openMock = vi.fn();

vi.stubGlobal('open', openMock);

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ ...props }: any) => (
    <button type="button" {...props}>
      action
    </button>
  ),
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Icon: () => <span>icon</span>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'collection.picker.action.add': 'Add',
        'collection.picker.action.added': 'Added',
        'collection.picker.action.detail': 'Details',
        'collection.picker.action.remove': 'Remove',
      })[key] || key,
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesPreviewPath: (spaceId?: string | null, fileId?: string) =>
    `/spaces/${spaceId}/files/item/${fileId}`,
  buildSourceSetPath: (spaceId?: string | null, sourceSetId?: string) =>
    `/spaces/${spaceId}/files?scope=source-set:${sourceSetId}`,
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: (id: string, kind: string, spaceId?: string | null) =>
    `/spaces/${spaceId}/docs/${id}?kind=${kind}`,
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      activeAgentId: 'agent-1',
      addFilesToAgent,
      attachSourceSetToAgent,
      detachSourceSetFromAgent,
      removeFileFromAgent,
    }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) =>
    selector({
      activeGroupId: undefined,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) =>
    selector({
      isMobile: false,
    }),
}));

vi.mock('@/store/session/store', () => ({
  useSessionStore: (selector: any) =>
    selector({
      addFilesToConversation,
      deleteConversationFile,
    }),
}));

describe('AttachSourceSet Item Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
  });

  it('opens details in the current route workspace when no explicit space is provided', () => {
    render(<Actions enabled id="ss-1" scope={'agent' as any} type={AgentSourceKind.SourceSet} />);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(openMock).toHaveBeenCalledWith('/spaces/space-route/files?scope=source-set:ss-1');
  });

  it('prefers the explicit source workspace over the current route workspace', () => {
    render(
      <Actions
        enabled
        id="ss-2"
        scope={'agent' as any}
        spaceId="space-explicit"
        type={AgentSourceKind.SourceSet}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(openMock).toHaveBeenCalledWith('/spaces/space-explicit/files?scope=source-set:ss-2');
  });

  it('opens canonical document entries as docs instead of file previews', () => {
    render(
      <Actions
        enabled
        id="docs_existing_1"
        scope={'agent' as any}
        spaceId="space-explicit"
        type={AgentSourceKind.File}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(openMock).toHaveBeenCalledWith('/spaces/space-explicit/docs/docs_existing_1?kind=doc');
  });
});
