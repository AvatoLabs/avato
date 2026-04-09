import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeNavigationProp,
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import type { ChatMessage } from '../types';

export interface ResourceNavigationTarget {
  content?: string | null;
  fileType?: string | null;
  id: string;
  name: string;
  sourceType?: 'document' | 'file';
  url?: string;
}

export interface ConversationOriginRouteParams {
  sessionId?: string;
  threadId?: string;
  topicId?: string;
}

export interface NotebookRouteParams extends ConversationOriginRouteParams {
  documentId?: string;
}

export interface MessageDetailRouteParams extends ConversationOriginRouteParams {
  message?: ChatMessage;
  messageId: string;
  sessionId: string;
  title?: string;
}

export interface MessageDetailPortalParams extends ConversationOriginRouteParams {
  messageId: string;
  sessionId: string;
  title?: string;
}

export interface ToolDetailRouteParams extends ConversationOriginRouteParams {
  apiName?: string;
  arguments?: string;
  content?: string;
  error?: unknown;
  identifier?: string;
  pluginState?: Record<string, unknown>;
  title?: string;
  toolCallId?: string;
}

export type ThreadDetailDraftType = 'continuation' | 'isolation' | 'standalone';

export interface ThreadDetailRouteParams {
  sessionId: string;
  sourceMessageId?: string;
  threadId?: string;
  threadType?: ThreadDetailDraftType;
  title?: string;
  topicId?: string;
}

export interface ThreadListRouteParams extends ConversationOriginRouteParams {
  sessionId: string;
  topicId: string;
}

export interface ResourcesRouteParams extends ConversationOriginRouteParams {
  openItem?: ResourceNavigationTarget;
  openItemId?: string;
  openKind?: 'document' | 'file' | 'source_set';
  openSourceSetId?: string | null;
}

export type PortalRouteName =
  | 'MessageDetail'
  | 'Notebook'
  | 'Resources'
  | 'ThreadDetail'
  | 'ThreadList'
  | 'ToolDetail';

export type PortalStackEntry =
  | { params: MessageDetailPortalParams; route: 'MessageDetail' }
  | { params: NotebookRouteParams; route: 'Notebook' }
  | { params: ResourcesRouteParams; route: 'Resources' }
  | { params: ThreadDetailRouteParams; route: 'ThreadDetail' }
  | { params: ThreadListRouteParams; route: 'ThreadList' }
  | { params: ToolDetailRouteParams; route: 'ToolDetail' };

export interface PortalRouteParams {
  portalStack?: PortalStackEntry[];
}

export type MainTabParamList = {
  Chats: undefined;
  Create: undefined;
  Me: undefined;
  Resources: (ResourcesRouteParams & PortalRouteParams) | undefined;
  Store: undefined;
};

export type RootStackParamList = {
  AgentConfig: { agentId?: string; sessionId?: string } | undefined;
  AgentList: undefined;
  AIProviders: undefined;
  AppLogs: undefined;
  ChatDetail: { messageId?: string; sessionId: string; topicId?: string };
  ChatSettings: { sessionId: string };
  DataManagement: undefined;
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Memory: undefined;
  MemoryDetail: Record<string, unknown> | undefined;
  MessageDetail: MessageDetailRouteParams & PortalRouteParams;
  ModelPicker: { sessionId?: string } | undefined;
  /** Standalone: no params. From chat/thread: pass source route params. */
  Notebook: (NotebookRouteParams & PortalRouteParams) | undefined;
  OnboardingWelcome: undefined;
  PortalResources: (ResourcesRouteParams & PortalRouteParams) | undefined;
  ProfileEdit: undefined;
  /** Public share link `/share/r/:token` (deep link or in-app). */
  PublicResourceShare: { initialPassword?: string; token: string };
  ProviderDetail: Record<string, unknown> | undefined;
  ServerConfig: { firstLaunch?: boolean } | undefined;
  Stats: undefined;
  ToolDetail: ToolDetailRouteParams & PortalRouteParams;
  ThreadDetail: ThreadDetailRouteParams & PortalRouteParams;
  ThreadList: ThreadListRouteParams & PortalRouteParams;
  TopicList: { sessionId: string };
};

export type BootstrapRoute = 'Login' | 'MainTabs' | 'OnboardingWelcome' | 'ServerConfig';

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootStackNavigationProp<T extends keyof RootStackParamList = keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type MainTabNavigationProp<T extends keyof MainTabParamList = keyof MainTabParamList> =
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, T>,
    NativeStackNavigationProp<RootStackParamList>
  >;
