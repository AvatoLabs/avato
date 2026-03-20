/**
 * Navigation — single unified navigator with all screens.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { FolderOpen, MessageCircle, Palette, Store } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image as RNImage, Platform, StyleSheet, View } from 'react-native';
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
import AgentListScreen from '../screens/AgentListScreen';
import AIProvidersScreen from '../screens/AIProvidersScreen';
import AppLogsScreen from '../screens/AppLogsScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import CreateScreen from '../screens/CreateScreen';
import DataManagementScreen from '../screens/DataManagementScreen';
import LoginScreen from '../screens/LoginScreen';
import MemoryDetailScreen from '../screens/MemoryDetailScreen';
import MemoryScreen from '../screens/MemoryScreen';
import ModelPickerScreen from '../screens/ModelPickerScreen';
import NotebookScreen from '../screens/NotebookScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';
import ResourceScreen from '../screens/ResourceScreen';
import ServerConfigScreen from '../screens/ServerConfigScreen';
import StatsScreen from '../screens/StatsScreen';
import StoreScreen from '../screens/StoreScreen';
import TopicListScreen from '../screens/TopicListScreen';
import { useThemeStore } from '../store/theme';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const TAB_TRANSITION_ANIMATION = 'shift' as const;
const STACK_CARD_ANIMATION = Platform.OS === 'android' ? 'ios_from_right' : 'default';
const STACK_ENTRY_ANIMATION = Platform.OS === 'android' ? 'ios_from_right' : 'simple_push';
const IOS_STACK_GESTURE_OPTIONS =
  Platform.OS === 'ios'
    ? ({
        animationMatchesGesture: true,
        fullScreenGestureEnabled: true,
        freezeOnBlur: true,
        gestureDirection: 'horizontal',
        gestureEnabled: true,
      } as const)
    : ({
        freezeOnBlur: true,
      } as const);

function MeTabIcon({
  focused,
  size,
  trigger,
}: {
  focused: boolean;
  size: number;
  trigger: number;
}) {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
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
          style={{
            height: logoSize,
            width: logoSize,
            ...(effectiveTheme === 'dark' ? { tintColor: '#ffffff' } : {}),
          }}
        />
      </Animated.View>
    </View>
  );
}

function AnimatedTabLabel({ focused, label }: { focused: boolean; label: string }) {
  const colors = useThemeColors();
  const opacity = useSharedValue(focused ? 1 : 0.7);
  const scale = useSharedValue(focused ? 1 : 0.94);
  const translateY = useSharedValue(focused ? 0 : 1.5);

  useEffect(() => {
    opacity.value = withTiming(focused ? 1 : 0.7, {
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
          color: focused ? colors.foreground : colors.secondaryText,
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

function AnimatedTabIcon({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  const colors = useThemeColors();
  const haloOpacity = useSharedValue(focused ? 1 : 0);
  const haloScale = useSharedValue(focused ? 1 : 0.92);
  const iconScale = useSharedValue(focused ? 1 : 0.94);
  const translateY = useSharedValue(focused ? -1.5 : 0);

  useEffect(() => {
    haloOpacity.value = withTiming(focused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    haloScale.value = withSpring(focused ? 1 : 0.92, {
      damping: 18,
      stiffness: 210,
    });
    iconScale.value = withSpring(focused ? 1 : 0.94, {
      damping: 16,
      stiffness: 240,
    });
    translateY.value = withTiming(focused ? -1.5 : 0.5, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [focused, haloOpacity, haloScale, iconScale, translateY]);

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: iconScale.value }],
  }));

  return (
    <View style={{ alignItems: 'center', height: 34, justifyContent: 'center', width: 34 }}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.activeTabBg,
            borderRadius: tokens.radius.full,
          },
          haloAnimatedStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            alignItems: 'center',
            backgroundColor: focused ? 'transparent' : colors.fillQuaternary,
            borderColor: focused ? 'transparent' : colors.borderSubtle,
            borderRadius: tokens.radius.full,
            borderWidth: focused ? 0 : 1,
            height: 34,
            justifyContent: 'center',
            width: 34,
          },
          iconAnimatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function FloatingTabBarBackground() {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const blurTint = effectiveTheme === 'dark' ? 'dark' : 'light';
  const overlay = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          opacity: Platform.OS === 'ios' ? 0.9 : 0.98,
        },
      ]}
    />
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={88} style={StyleSheet.absoluteFill} tint={blurTint}>
        {overlay}
      </BlurView>
    );
  }

  return overlay;
}

function BottomTabs() {
  const themeColors = useThemeColors();
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
        animation: TAB_TRANSITION_ANIMATION,
        freezeOnBlur: true,
        headerShown: false,
        tabBarActiveTintColor: themeColors.iconOnPrimary,
        tabBarInactiveTintColor: themeColors.secondaryText,
        tabBarBackground: () => <FloatingTabBarBackground />,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'android' ? 64 : 78,
          paddingTop: 6,
          shadowColor: themeColors.shadow,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: -6 },
          shadowRadius: 22,
          ...(Platform.OS === 'android' ? { paddingBottom: 8 } : {}),
        },
      }}
    >
      <Tab.Screen
        component={ChatListScreen}
        name="Chats"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon focused={focused}>
              <MessageCircle color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused }) => <AnimatedTabLabel focused={focused} label={t.tabChats} />,
          tabBarAccessibilityLabel: 'Chats tab',
        }}
      />
      <Tab.Screen
        component={CreateScreen}
        name="Create"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon focused={focused}>
              <Palette color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused }) => <AnimatedTabLabel focused={focused} label={t.tabArtwork} />,
          tabBarAccessibilityLabel: 'Create tab',
        }}
      />
      <Tab.Screen
        component={ResourceScreen}
        name="Resources"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon focused={focused}>
              <FolderOpen color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused }) => (
            <AnimatedTabLabel focused={focused} label={t.resourceTitle} />
          ),
          tabBarAccessibilityLabel: 'Resources tab',
        }}
      />
      <Tab.Screen
        component={StoreScreen}
        name="Store"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon focused={focused}>
              <Store color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused }) => <AnimatedTabLabel focused={focused} label={t.tabStore} />,
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
            <AnimatedTabIcon focused={focused}>
              <MeTabIcon focused={focused} size={size} trigger={meIconTrigger} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused }) => <AnimatedTabLabel focused={focused} label={t.tabMe} />,
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
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        animation: STACK_CARD_ANIMATION,
        headerShown: false,
        ...IOS_STACK_GESTURE_OPTIONS,
      }}
    >
      {/* Onboarding: Welcome -> ServerConfig (Connect) -> Login/MainTabs */}
      <Stack.Screen
        component={WelcomeScreen}
        name="OnboardingWelcome"
        options={{ animation: STACK_ENTRY_ANIMATION }}
      />
      <Stack.Screen
        component={ServerConfigScreen}
        initialParams={{ firstLaunch: initialRoute === 'ServerConfig' }}
        name="ServerConfig"
        options={{ animation: STACK_ENTRY_ANIMATION }}
      />
      <Stack.Screen
        component={LoginScreen}
        name="Login"
        options={{ animation: STACK_ENTRY_ANIMATION }}
      />
      <Stack.Screen
        component={BottomTabs}
        name="MainTabs"
        options={{ animation: STACK_ENTRY_ANIMATION }}
      />

      {/* Chat */}
      <Stack.Screen component={ChatDetailScreen} name="ChatDetail" />
      <Stack.Screen component={ChatSettingsScreen} name="ChatSettings" />
      <Stack.Screen component={TopicListScreen} name="TopicList" />
      <Stack.Screen component={NotebookScreen} name="Notebook" />

      {/* Settings */}
      <Stack.Screen component={AIProvidersScreen} name="AIProviders" />
      <Stack.Screen component={ProviderDetailScreen} name="ProviderDetail" />
      <Stack.Screen component={ModelPickerScreen} name="ModelPicker" />
      <Stack.Screen component={ProfileEditScreen} name="ProfileEdit" />
      <Stack.Screen component={DataManagementScreen} name="DataManagement" />
      <Stack.Screen component={AppLogsScreen} name="AppLogs" />
      <Stack.Screen component={StatsScreen} name="Stats" />
      <Stack.Screen component={MemoryScreen} name="Memory" />
      <Stack.Screen component={MemoryDetailScreen} name="MemoryDetail" />

      <Stack.Screen component={AgentListScreen} name="AgentList" />
      <Stack.Screen component={AgentConfigScreen} name="AgentConfig" />
    </Stack.Navigator>
  );
}
