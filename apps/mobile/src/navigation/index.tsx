/**
 * Navigation — single unified navigator with all screens.
 */
import { type BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { FolderOpen, MessageCircle, Palette, Store } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Image as RNImage,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT, TAB_BAR_HORIZONTAL_INSET } from '../lib/bottomChrome';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { getResponsiveLayoutMetrics } from '../lib/responsiveLayout';
import AgentConfigScreen from '../screens/AgentConfigScreen';
import AgentListScreen from '../screens/AgentListScreen';
import AIProvidersScreen from '../screens/AIProvidersScreen';
import AppLogsScreen from '../screens/AppLogsScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import ContentScreen from '../screens/ContentScreen';
import CreateScreen from '../screens/CreateScreen';
import DataManagementScreen from '../screens/DataManagementScreen';
import LoginScreen from '../screens/LoginScreen';
import MemoryDetailScreen from '../screens/MemoryDetailScreen';
import MemoryScreen from '../screens/MemoryScreen';
import MessageDetailScreen from '../screens/MessageDetailScreen';
import ModelPickerScreen from '../screens/ModelPickerScreen';
import NotebookScreen from '../screens/NotebookScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import PortalContentScreen from '../screens/PortalContentScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';
import PublicResourceShareScreen from '../screens/PublicResourceShareScreen';
import ServerConfigScreen from '../screens/ServerConfigScreen';
import SpaceMemoryScreen from '../screens/SpaceMemoryScreen';
import StatsScreen from '../screens/StatsScreen';
import StoreScreen from '../screens/StoreScreen';
import ThreadDetailScreen from '../screens/ThreadDetailScreen';
import ThreadListScreen from '../screens/ThreadListScreen';
import ToolDetailScreen from '../screens/ToolDetailScreen';
import TopicListScreen from '../screens/TopicListScreen';
import { useThemeStore } from '../store/theme';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { BootstrapRoute, MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const TAB_TRANSITION_ANIMATION = 'shift' as const;
const STACK_CARD_ANIMATION = Platform.OS === 'android' ? 'ios_from_right' : 'default';
const STACK_ENTRY_ANIMATION = Platform.OS === 'android' ? 'ios_from_right' : 'simple_push';
const PORTAL_SCREEN_OPTIONS: NativeStackNavigationOptions =
  Platform.OS === 'ios'
    ? {
        animation: 'slide_from_bottom',
        animationMatchesGesture: true,
        contentStyle: { backgroundColor: 'transparent' },
        fullScreenGestureEnabled: true,
        gestureDirection: 'vertical',
        presentation: 'containedTransparentModal',
      }
    : {
        animation: 'fade_from_bottom',
        contentStyle: { backgroundColor: 'transparent' },
        presentation: 'containedTransparentModal',
      };
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

const isPortalNotebookRoute = (params: RootStackParamList['Notebook']) =>
  !!params?.documentId || !!params?.portalStack?.length;

/** Fixed bottom tab bar layout — matte surfaces only, no floating capsule treatment */
const TAB_BAR_ACTIVE_INDICATOR_HEIGHT = 36;
const TAB_BAR_ACTIVE_INDICATOR_HORIZONTAL_INSET = 12;
const TAB_BAR_HIDE_TRANSLATE_EXTRA = 12;

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
  const colors = useThemeColors();
  const logoSize = Math.round(Math.max(size - 2, 20));
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
            ...(effectiveTheme === 'dark' ? { tintColor: colors.foreground } : {}),
          }}
        />
      </Animated.View>
    </View>
  );
}

function AnimatedTabLabel({ focused, label }: { focused: boolean; label: string }) {
  const colors = useThemeColors();
  const opacity = useSharedValue(focused ? 1 : 0.7);
  const scale = useSharedValue(focused ? 1 : 0.97);
  const translateY = useSharedValue(focused ? 0 : 0.75);

  useEffect(() => {
    opacity.value = withTiming(focused ? 1 : 0.7, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    scale.value = withTiming(focused ? 1 : 0.97, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(focused ? 0 : 1, {
      duration: 220,
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
          fontSize: 10.5,
          fontWeight: tokens.typography.weight.medium as any,
          lineHeight: 13,
          marginTop: 0,
          textAlign: 'center',
        },
        animatedStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
}

function AnimatedTabIcon({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  const iconScale = useSharedValue(focused ? 1 : 0.97);
  const translateY = useSharedValue(focused ? -0.5 : 0.5);

  useEffect(() => {
    iconScale.value = withSpring(focused ? 1 : 0.97, {
      damping: 18,
      stiffness: 180,
    });
    translateY.value = withTiming(focused ? -0.5 : 0.5, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
  }, [focused, iconScale, translateY]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: iconScale.value }],
  }));

  return (
    <View style={{ alignItems: 'center', height: 26, justifyContent: 'center', width: 26 }}>
      <Animated.View
        style={[
          {
            alignItems: 'center',
            height: 26,
            justifyContent: 'center',
            width: 26,
          },
          iconAnimatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function MainTabBarBackground({ height }: { height: number }) {
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const blurTint = effectiveTheme === 'dark' ? 'dark' : 'light';
  const overlay = (
    <View
      pointerEvents="none"
      style={{
        backgroundColor: colors.surfaceElevated,
        borderTopColor: colors.borderSubtle,
        borderTopWidth: StyleSheet.hairlineWidth,
        height,
        opacity: Platform.OS === 'ios' ? 0.8 : 0.92,
        width: '100%',
      }}
    />
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={48}
        style={{ height, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 }}
        tint={blurTint}
      >
        {overlay}
      </BlurView>
    );
  }

  return (
    <View style={{ height, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 }}>
      {overlay}
    </View>
  );
}

function useTabBarKeyboardVisible() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardVisible;
}

function MainTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useTabBarKeyboardVisible();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const tabBarVisibility = useSharedValue(keyboardVisible ? 1 : 0);
  const activeIndicatorX = useSharedValue(0);

  const tabBarBottomSpacing = Platform.OS === 'ios' ? Math.max(Math.min(insets.bottom, 10), 6) : 0;
  const tabBarVisualHeight = TAB_BAR_HEIGHT;
  const tabBarHeight = tabBarVisualHeight + tabBarBottomSpacing;
  const tabBarWidth = Math.min(
    Math.max(screenWidth - TAB_BAR_HORIZONTAL_INSET * 2, 0),
    responsiveMetrics.tabBarMaxWidth,
  );
  const tabWidth = layoutWidth > 0 ? layoutWidth / state.routes.length : 0;
  const activeIndicatorWidth =
    tabWidth > 0 ? Math.max(44, tabWidth - TAB_BAR_ACTIVE_INDICATOR_HORIZONTAL_INSET * 2) : 0;
  const activeIndicatorTargetX =
    tabWidth > 0 ? state.index * tabWidth + (tabWidth - activeIndicatorWidth) / 2 : 0;

  useEffect(() => {
    tabBarVisibility.value = withTiming(keyboardVisible ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardVisible, tabBarVisibility]);

  useEffect(() => {
    if (tabWidth <= 0) return;

    activeIndicatorX.value = withSpring(activeIndicatorTargetX, {
      damping: 18,
      mass: 0.9,
      stiffness: 190,
    });
  }, [activeIndicatorTargetX, activeIndicatorX, tabWidth]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - tabBarVisibility.value,
    transform: [
      { translateY: tabBarVisibility.value * (tabBarHeight + TAB_BAR_HIDE_TRANSLATE_EXTRA) },
    ],
  }));

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeIndicatorX.value }],
  }));
  const backgroundBlockerGesture = Gesture.Tap()
    .enabled(!keyboardVisible)
    .maxDuration(10_000)
    .onStart(() => {
      'worklet';
    });

  return (
    <Animated.View
      pointerEvents={keyboardVisible ? 'none' : 'auto'}
      style={[
        {
          backgroundColor: 'transparent',
          bottom: TAB_BAR_FLOAT_GAP,
          elevation: 48,
          height: tabBarHeight,
          left: (screenWidth - tabBarWidth) / 2,
          position: 'absolute',
          width: tabBarWidth,
          zIndex: 48,
        },
        containerAnimatedStyle,
      ]}
    >
      <GestureDetector gesture={backgroundBlockerGesture}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
        >
          <MainTabBarBackground height={tabBarVisualHeight} />
        </View>
      </GestureDetector>
      <View
        style={{
          flexDirection: 'row',
          height: tabBarVisualHeight,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
          width: '100%',
          zIndex: 1,
        }}
        onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
      >
        {activeIndicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                backgroundColor: themeColors.fillQuaternary,
                borderRadius: TAB_BAR_ACTIVE_INDICATOR_HEIGHT / 2,
                height: TAB_BAR_ACTIVE_INDICATOR_HEIGHT,
                left: 0,
                position: 'absolute',
                top: (tabBarVisualHeight - TAB_BAR_ACTIVE_INDICATOR_HEIGHT) / 2,
                width: activeIndicatorWidth,
              },
              indicatorAnimatedStyle,
            ]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? themeColors.foreground : themeColors.secondaryText;
          const labelText =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title || route.name;

          const icon =
            typeof options.tabBarIcon === 'function'
              ? options.tabBarIcon({ color, focused: isFocused, size: 24 })
              : null;
          const label =
            typeof options.tabBarLabel === 'function' ? (
              options.tabBarLabel({
                children: labelText,
                color,
                focused: isFocused,
                position: 'below-icon',
              })
            ) : (
              <AnimatedTabLabel focused={isFocused} label={labelText} />
            );

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              target: route.key,
              type: 'tabLongPress',
            });
          };

          return (
            <PressableScale
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              activeScale={0.96}
              containerStyle={{ flex: 1 }}
              key={route.key}
              style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}
              onLongPress={onLongPress}
              onPress={onPress}
            >
              {icon}
              {label}
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
}

function BottomTabs() {
  const { t } = useI18n();
  const [meIconTrigger, setMeIconTrigger] = useState(0);

  return (
    <Tab.Navigator
      tabBar={(props) => <MainTabBar {...props} />}
      screenListeners={{
        tabPress: () => {
          haptics.selection();
        },
      }}
      screenOptions={{
        animation: TAB_TRANSITION_ANIMATION,
        freezeOnBlur: true,
        headerShown: false,
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
          tabBarAccessibilityLabel: t.tabChats,
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
          tabBarAccessibilityLabel: t.tabArtwork,
        }}
      />
      <Tab.Screen
        component={ContentScreen}
        name="Content"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon focused={focused}>
              <FolderOpen color={color} size={size - 2} strokeWidth={tokens.icon.strokeWidth} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused }) => (
            <AnimatedTabLabel focused={focused} label={t.resourceTitle} />
          ),
          tabBarAccessibilityLabel: t.resourceTitle,
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
          tabBarAccessibilityLabel: t.tabStore,
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
          tabBarAccessibilityLabel: t.tabMe,
        }}
      />
    </Tab.Navigator>
  );
}

interface RootNavigatorProps {
  initialRoute?: BootstrapRoute;
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
      <Stack.Screen
        component={NotebookScreen}
        name="Notebook"
        options={({ route }) => (isPortalNotebookRoute(route.params) ? PORTAL_SCREEN_OPTIONS : {})}
      />
      <Stack.Group screenOptions={PORTAL_SCREEN_OPTIONS}>
        <Stack.Screen component={MessageDetailScreen} name="MessageDetail" />
        <Stack.Screen component={PortalContentScreen} name="PortalContent" />
        <Stack.Screen component={ToolDetailScreen} name="ToolDetail" />
        <Stack.Screen component={ThreadDetailScreen} name="ThreadDetail" />
        <Stack.Screen component={ThreadListScreen} name="ThreadList" />
      </Stack.Group>

      {/* Settings */}
      <Stack.Screen component={AIProvidersScreen} name="AIProviders" />
      <Stack.Screen component={ProviderDetailScreen} name="ProviderDetail" />
      <Stack.Screen component={ModelPickerScreen} name="ModelPicker" />
      <Stack.Screen component={ProfileEditScreen} name="ProfileEdit" />
      <Stack.Screen component={PublicResourceShareScreen} name="PublicResourceShare" />
      <Stack.Screen component={DataManagementScreen} name="DataManagement" />
      <Stack.Screen component={AppLogsScreen} name="AppLogs" />
      <Stack.Screen component={StatsScreen} name="Stats" />
      <Stack.Screen component={MemoryScreen} name="Memory" />
      <Stack.Screen component={MemoryDetailScreen} name="MemoryDetail" />
      <Stack.Screen component={SpaceMemoryScreen} name="SpaceMemory" />

      <Stack.Screen component={AgentListScreen} name="AgentList" />
      <Stack.Screen component={AgentConfigScreen} name="AgentConfig" />
    </Stack.Navigator>
  );
}
