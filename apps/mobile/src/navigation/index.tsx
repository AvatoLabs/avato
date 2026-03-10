import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Compass, MessageSquare, User } from 'lucide-react-native';
import React from 'react';

import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.border,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        component={ChatListScreen}
        name="ChatsTab"
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tab.Screen
        component={DiscoverScreen}
        name="DiscoverTab"
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="ProfileTab"
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      {/* The main tab navigator is the root of the stack */}
      <Stack.Screen
        component={MainTabs}
        name="MainTabs"
        options={{ headerShown: false }}
      />
      {/* Screens pushed on top of the tabs hide the tab bar automatically in NativeStack (on iOS. On Android we might need tweaks, but default is usually fine) */}
      <Stack.Screen
        component={ChatDetailScreen}
        name="ChatDetail"
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}
