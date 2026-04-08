import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigateBackFromPortal, navigateToPortalEntry, navigateToResources } from './navigation';

const { mockedIsReady, mockedNavigate } = vi.hoisted(() => ({
  mockedIsReady: vi.fn(),
  mockedNavigate: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    getRootState: vi.fn(),
    isReady: mockedIsReady,
    navigate: mockedNavigate,
    resetRoot: vi.fn(),
  }),
}));

describe('navigation', () => {
  beforeEach(() => {
    mockedIsReady.mockReset();
    mockedNavigate.mockReset();
    mockedIsReady.mockReturnValue(true);
  });

  it('keeps resource browsing on the resources tab root', () => {
    navigateToResources();

    expect(mockedNavigate).toHaveBeenCalledWith('MainTabs', {
      params: undefined,
      screen: 'Resources',
    });
  });

  it('routes resource object opens through the portal resources stack screen', () => {
    navigateToResources({
      openItemId: 'file-1',
      openKind: 'file',
      sessionId: 'session-1',
    });

    expect(mockedNavigate).toHaveBeenCalledWith('PortalResources', {
      openItemId: 'file-1',
      openKind: 'file',
      sessionId: 'session-1',
    });
  });

  it('restores resource portal entries through the stack route', () => {
    navigateToPortalEntry(
      {
        params: {
          openItemId: 'file-1',
          openKind: 'file',
          sessionId: 'session-1',
        },
        route: 'Resources',
      },
      [
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
      ],
    );

    expect(mockedNavigate).toHaveBeenCalledWith('PortalResources', {
      openItemId: 'file-1',
      openKind: 'file',
      portalStack: [
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
      ],
      sessionId: 'session-1',
    });
  });

  it('falls back through portal stack before conversation origin', () => {
    const goBack = vi.fn();

    navigateBackFromPortal({
      conversationOrigin: { sessionId: 'session-2' },
      navigation: {
        canGoBack: () => false,
        goBack,
        navigate: mockedNavigate,
      },
      portalStack: [
        {
          params: {
            messageId: 'msg-1',
            sessionId: 'session-1',
          },
          route: 'MessageDetail',
        },
      ],
    });

    expect(goBack).not.toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith('MessageDetail', {
      messageId: 'msg-1',
      sessionId: 'session-1',
    });
  });

  it('falls back to main tabs when requested and no origin is available', () => {
    navigateBackFromPortal({
      fallbackToMainTabs: true,
      navigation: {
        canGoBack: () => false,
        goBack: vi.fn(),
        navigate: mockedNavigate,
      },
    });

    expect(mockedNavigate).toHaveBeenCalledWith('MainTabs');
  });
});
