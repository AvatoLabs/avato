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

export type MainTabParamList = {
  Chats: undefined;
  Create: undefined;
  Me: undefined;
  Resources: undefined;
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
  ModelPicker: { sessionId?: string } | undefined;
  Notebook: { sessionId: string; topicId: string };
  OnboardingWelcome: undefined;
  ProfileEdit: undefined;
  ProviderDetail: Record<string, unknown> | undefined;
  ServerConfig: { firstLaunch?: boolean } | undefined;
  Stats: undefined;
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
