/**
 * Navigation ref for imperative navigation (e.g. from stores on 401/403).
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import type {
  ConversationOriginRouteParams,
  MainTabParamList,
  PortalStackEntry,
  RootStackParamList,
} from '../navigation/types';
import { getPreviousPortalTarget } from './portalNavigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

interface PortalBackNavigation {
  canGoBack: () => boolean;
  goBack: () => void;
  navigate?: (...args: any[]) => void;
}

interface NavigateBackFromPortalOptions {
  conversationOrigin?: ConversationOriginRouteParams | null;
  fallbackToMainTabs?: boolean;
  navigation: PortalBackNavigation;
  portalStack?: PortalStackEntry[];
}

export function resetToLogin(): void {
  if (!navigationRef.isReady()) return;

  const state = navigationRef.getRootState();
  const activeRoute = state.routes[state.index ?? 0];

  if (activeRoute?.name === 'Login' && state.routes.length === 1) return;

  navigationRef.resetRoot({
    index: 0,
    routes: [{ name: 'Login' }],
  });
}

export function navigateToLogin(): void {
  resetToLogin();
}

export function navigateToChatDetail(params: RootStackParamList['ChatDetail']): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('ChatDetail', params);
}

export function navigateToMessageDetail(params: RootStackParamList['MessageDetail']): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('MessageDetail', params);
}

export function navigateToToolDetail(params: RootStackParamList['ToolDetail']): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('ToolDetail', params);
}

export function navigateToThreadList(params: RootStackParamList['ThreadList']): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('ThreadList', params);
}

export function navigateToThreadDetail(params: RootStackParamList['ThreadDetail']): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('ThreadDetail', params);
}

export function navigateToNotebook(params?: RootStackParamList['Notebook']): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('Notebook', params);
}

export function navigateToContent(params?: MainTabParamList['Content']): void {
  if (!navigationRef.isReady()) return;
  const shouldOpenPortalContent =
    !!params &&
    !!(
      params.openItem ||
      params.openItemId ||
      params.openKind ||
      params.openSourceSetId !== undefined ||
      (params.portalStack && params.portalStack.length > 0)
    );

  if (shouldOpenPortalContent) {
    navigationRef.navigate('PortalContent', params);
    return;
  }

  navigationRef.navigate('MainTabs', { params, screen: 'Content' });
}

export function navigateToPortalEntry(
  entry: PortalStackEntry,
  remainingStack?: PortalStackEntry[],
): void {
  if (!navigationRef.isReady()) return;

  const portalParams =
    remainingStack && remainingStack.length > 0 ? { portalStack: remainingStack } : {};

  if (entry.route === 'Content') {
    navigationRef.navigate('PortalContent', {
      ...entry.params,
      ...portalParams,
    });
    return;
  }

  if (entry.route === 'ThreadList') {
    navigationRef.navigate('ThreadList', {
      ...entry.params,
      ...portalParams,
    });
    return;
  }

  navigationRef.navigate(entry.route, {
    ...entry.params,
    ...portalParams,
  } as never);
}

export function navigateToConversationOrigin(params?: ConversationOriginRouteParams): void {
  if (!navigationRef.isReady() || !params?.sessionId) return;

  if (params.threadId) {
    navigateToThreadDetail({
      sessionId: params.sessionId,
      threadId: params.threadId,
      ...(params.topicId ? { topicId: params.topicId } : {}),
    });
    return;
  }

  navigateToChatDetail({
    sessionId: params.sessionId,
    ...(params.topicId ? { topicId: params.topicId } : {}),
  });
}

export function navigateBackFromPortal({
  conversationOrigin,
  fallbackToMainTabs = false,
  navigation,
  portalStack,
}: NavigateBackFromPortalOptions): boolean {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return true;
  }

  const previousPortalTarget = getPreviousPortalTarget(portalStack);

  if (previousPortalTarget) {
    navigateToPortalEntry(previousPortalTarget.entry, previousPortalTarget.remainingStack);
    return true;
  }

  if (conversationOrigin?.sessionId) {
    navigateToConversationOrigin(conversationOrigin);
    return true;
  }

  if (fallbackToMainTabs && navigation.navigate) {
    navigation.navigate('MainTabs');
    return true;
  }

  return false;
}
