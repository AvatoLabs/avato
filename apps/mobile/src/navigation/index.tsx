/**
 * Navigation — single unified navigator with all screens.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FolderOpen, MessageSquare, Palette, Puzzle, User } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Image as RNImage, Platform, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import AboutScreen from '../screens/AboutScreen';
import AgentDetailScreen from '../screens/AgentDetailScreen';
import AIProvidersScreen from '../screens/AIProvidersScreen';
import ArtworkScreen from '../screens/ArtworkScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import DataManagementScreen from '../screens/DataManagementScreen';
import LanguagePickerScreen from '../screens/LanguagePickerScreen';
import LoginScreen from '../screens/LoginScreen';
import MemoryDetailScreen from '../screens/MemoryDetailScreen';
import MemoryScreen from '../screens/MemoryScreen';
import ModelListScreen from '../screens/ModelListScreen';
import ModelPickerScreen from '../screens/ModelPickerScreen';
import NotebookScreen from '../screens/NotebookScreen';
import CompletionScreen from '../screens/onboarding/CompletionScreen';
import ProviderSetupScreen from '../screens/onboarding/ProviderSetupScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';
import ProviderListScreen from '../screens/ProviderListScreen';
import ResourceScreen from '../screens/ResourceScreen';
import ServerConfigScreen from '../screens/ServerConfigScreen';
import SessionGroupScreen from '../screens/SessionGroupScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SkillDetailScreen from '../screens/SkillDetailScreen';
import SkillMarketScreen from '../screens/SkillMarketScreen';
import SkillSettingsScreen from '../screens/SkillSettingsScreen';
import StatsScreen from '../screens/StatsScreen';
import TopicListScreen from '../screens/TopicListScreen';
import { useUserStore } from '../store/user';
import { tokens } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MeTabIcon({ color, focused, size }: { color: string; focused: boolean; size: number }) {
  const avatar = useUserStore((s) => s.avatar);

  if (!avatar) {
    return <User color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />;
  }

  const avatarSize = size - 2;
  return (
    <View
      style={{
        borderColor: focused ? '#007aff' : 'transparent',
        borderRadius: 999,
        borderWidth: focused ? 1.5 : 0,
        padding: focused ? 1 : 0,
      }}
    >
      <RNImage
        source={{ uri: avatar }}
        style={{ borderRadius: avatarSize / 2, height: avatarSize, width: avatarSize }}
      />
    </View>
  );
}

function BottomTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const fetchUser = useUserStore((s) => s.fetchUser);
  const isUserLoaded = useUserStore((s) => s.isLoaded);

  useEffect(() => {
    if (!isUserLoaded) void fetchUser();
  }, [isUserLoaded, fetchUser]);

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          haptics.selection();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007aff',
        tabBarInactiveTintColor: colors.text + '60',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0, // Removed hard border
          elevation: 0,
          paddingTop: 8,
          shadowOpacity: 0.05, // Extremely subtle shadow instead of hard line
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 10,
          ...(Platform.OS === 'android' ? { height: 60, paddingBottom: 8 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
          fontWeight: tokens.typography.weight.medium as any,
        },
      }}
    >
      <Tab.Screen
        component={ChatListScreen}
        name="Chats"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: t.tabChats,
          tabBarAccessibilityLabel: 'Chats tab',
        }}
      />
      <Tab.Screen
        component={ArtworkScreen}
        name="Artwork"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Palette color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: t.tabArtwork,
          tabBarAccessibilityLabel: 'Artwork tab',
        }}
      />
      <Tab.Screen
        component={ResourceScreen}
        name="Resources"
        options={{
          tabBarIcon: ({ color, size }) => (
            <FolderOpen color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: t.resourceTitle,
          tabBarAccessibilityLabel: 'Resources tab',
        }}
      />
      <Tab.Screen
        component={SkillSettingsScreen}
        name="Skills"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Puzzle color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: t.skillsTitle,
          tabBarAccessibilityLabel: 'Skills tab',
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="Me"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <MeTabIcon color={color} focused={focused} size={size} />
          ),
          tabBarLabel: 'Me',
          tabBarAccessibilityLabel: 'Me tab',
        }}
      />
    </Tab.Navigator>
  );
}

interface RootNavigatorProps {
  initialRoute?: 'Login' | 'MainTabs' | 'OnboardingWelcome' | 'ServerConfig';
}

export default function RootNavigator({ initialRoute = 'MainTabs' }: RootNavigatorProps) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      {/* Onboarding */}
      <Stack.Screen
        component={WelcomeScreen}
        name="OnboardingWelcome"
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        component={ProviderSetupScreen}
        name="OnboardingProviderSetup"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={CompletionScreen}
        name="OnboardingCompletion"
        options={{ animation: 'slide_from_right' }}
      />

      {/* Main */}
      <Stack.Screen
        component={ServerConfigScreen}
        initialParams={{ firstLaunch: initialRoute === 'ServerConfig' }}
        name="ServerConfig"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen component={LoginScreen} name="Login" options={{ animation: 'fade' }} />
      <Stack.Screen component={BottomTabs} name="MainTabs" />

      {/* Chat */}
      <Stack.Screen
        component={ChatDetailScreen}
        name="ChatDetail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={ChatSettingsScreen}
        name="ChatSettings"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={TopicListScreen}
        name="TopicList"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={NotebookScreen}
        name="Notebook"
        options={{ animation: 'slide_from_right' }}
      />

      {/* Session Groups */}
      <Stack.Screen
        component={SessionGroupScreen}
        name="SessionGroup"
        options={{ animation: 'slide_from_right' }}
      />

      {/* Settings */}
      <Stack.Screen
        component={SettingsScreen}
        name="Settings"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={AIProvidersScreen}
        name="AIProviders"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={ProviderDetailScreen}
        name="ProviderDetail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={ModelPickerScreen}
        name="ModelPicker"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={LanguagePickerScreen}
        name="LanguagePicker"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={ProfileEditScreen}
        name="ProfileEdit"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={DataManagementScreen}
        name="DataManagement"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={SkillSettingsScreen}
        name="SkillSettings"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={SkillDetailScreen}
        name="SkillDetail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={SkillMarketScreen}
        name="SkillMarket"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={StatsScreen}
        name="Stats"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={MemoryScreen}
        name="Memory"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={MemoryDetailScreen}
        name="MemoryDetail"
        options={{ animation: 'slide_from_right' }}
      />

      {/* Discover */}
      <Stack.Screen
        component={AgentDetailScreen}
        name="AgentDetail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={ModelListScreen}
        name="ModelList"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={ProviderListScreen}
        name="ProviderList"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={AboutScreen}
        name="About"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
