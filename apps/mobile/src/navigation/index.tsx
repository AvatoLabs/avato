/**
 * Navigation — single unified navigator with all screens.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessageSquare, Sparkles, User } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { useI18n } from '../lib/i18n';
import AIProvidersScreen from '../screens/AIProvidersScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import LanguagePickerScreen from '../screens/LanguagePickerScreen';
import ModelPickerScreen from '../screens/ModelPickerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ServerConfigScreen from '../screens/ServerConfigScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThemePickerScreen from '../screens/ThemePickerScreen';
import { tokens } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BottomTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Tab.Navigator
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
        }}
      />
      <Tab.Screen
        component={DiscoverScreen}
        name="Discover"
        options={{
          tabBarIcon: ({ color, size }) => (
              <Sparkles color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: t.studioTitle,
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="Me"
        options={{
          tabBarIcon: ({ color, size }) => (
              <User color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: t.workspaceTitle,
        }}
      />
    </Tab.Navigator>
  );
}

interface RootNavigatorProps {
  initialRoute?: 'ServerConfig' | 'MainTabs';
}

export default function RootNavigator({ initialRoute = 'MainTabs' }: RootNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        component={ServerConfigScreen}
        initialParams={{ firstLaunch: initialRoute === 'ServerConfig' }}
        name="ServerConfig"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen component={BottomTabs} name="MainTabs" />
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
        component={ThemePickerScreen}
        name="ThemePicker"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
