/**
 * Navigation — single unified navigator with all screens.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FolderOpen, MessageCircle, Palette, Store } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image as RNImage, Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import AgentConfigScreen from '../screens/AgentConfigScreen';
import AgentDetailScreen from '../screens/AgentDetailScreen';
import AgentListScreen from '../screens/AgentListScreen';
import AIProvidersScreen from '../screens/AIProvidersScreen';
import AppLogsScreen from '../screens/AppLogsScreen';
import ArtworkScreen from '../screens/ArtworkScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import DataManagementScreen from '../screens/DataManagementScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
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
import SettingsScreen from '../screens/SettingsScreen';
import StatsScreen from '../screens/StatsScreen';
import StoreScreen from '../screens/StoreScreen';
import TopicListScreen from '../screens/TopicListScreen';
import { tokens } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MeTabIcon({
  focused,
  size,
  trigger,
}: {
  focused: boolean;
  size: number;
  trigger: number;
}) {
  const logoSize = Math.round(Math.max(size + 1, 24) * 1.15);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (trigger === 0) return;

    rotation.value = 0;
    scale.value = 1;

    rotation.value = withTiming(360, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withDelay(
      700,
      withSequence(
        withTiming(1.12, {
          duration: 120,
          easing: Easing.out(Easing.quad),
        }),
        withSpring(1, {
          damping: 10,
          stiffness: 220,
        }),
      ),
    );
  }, [rotation, scale, trigger]);

  useEffect(() => {
    if (!focused) {
      rotation.value = 0;
      scale.value = 1;
    }
  }, [focused, rotation, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return (
    <View>
      <Animated.View style={animatedStyle}>
        <RNImage
          resizeMode="contain"
          source={require('../../assets/avato-logo.png')}
          style={{ height: logoSize, width: logoSize }}
        />
      </Animated.View>
    </View>
  );
}

function AnimatedTabLabel({
  color,
  focused,
  label,
}: {
  color: string;
  focused: boolean;
  label: string;
}) {
  const opacity = useSharedValue(focused ? 1 : 0.7);
  const scale = useSharedValue(focused ? 1 : 0.94);
  const translateY = useSharedValue(focused ? 0 : 1.5);

  useEffect(() => {
    opacity.value = withTiming(focused ? 1 : 0.72, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    scale.value = withTiming(focused ? 1 : 0.94, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(focused ? 0 : 1.5, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [focused, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.Text
      style={[
        {
          color,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
          fontSize: 11,
          fontWeight: tokens.typography.weight.medium as any,
          marginTop: 2,
        },
        animatedStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
}

function BottomTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [meIconTrigger, setMeIconTrigger] = useState(0);

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
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0, // Removed hard border
          elevation: 0,
          height: Platform.OS === 'android' ? 64 : 78,
          paddingTop: 8,
          shadowOpacity: 0.05, // Extremely subtle shadow instead of hard line
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 10,
          ...(Platform.OS === 'android' ? { paddingBottom: 8 } : {}),
        },
      }}
    >
      <Tab.Screen
        component={ChatListScreen}
        name="Chats"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel color={color} focused={focused} label={t.tabChats} />
          ),
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
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel color={color} focused={focused} label={t.tabArtwork} />
          ),
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
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel color={color} focused={focused} label={t.resourceTitle} />
          ),
          tabBarAccessibilityLabel: 'Resources tab',
        }}
      />
      <Tab.Screen
        component={StoreScreen}
        name="Store"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Store color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel color={color} focused={focused} label={t.tabStore} />
          ),
          tabBarAccessibilityLabel: 'Store tab',
        }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="Me"
        listeners={{
          tabPress: () => {
            setMeIconTrigger((value) => value + 1);
          },
        }}
        options={{
          tabBarIcon: ({ focused, size }) => (
            <MeTabIcon focused={focused} size={size} trigger={meIconTrigger} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel color={color} focused={focused} label={t.tabMe} />
          ),
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
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
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
        component={AppLogsScreen}
        name="AppLogs"
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
        component={DiscoverScreen}
        name="Discover"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={AgentDetailScreen}
        name="AgentDetail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={AgentListScreen}
        name="AgentList"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        component={AgentConfigScreen}
        name="AgentConfig"
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
    </Stack.Navigator>
  );
}
