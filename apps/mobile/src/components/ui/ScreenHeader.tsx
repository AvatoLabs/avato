import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, Text, type TouchableOpacityProps, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../lib/i18n';
import { useThemeStore } from '../../store/theme';
import { useThemeColors } from '../../theme/colors';
import { enteringSection } from '../../theme/motion';
import { tokens } from '../../theme/tokens';
import PortalChromeBar from './PortalChromeBar';
import PressableScale from './PressableScale';

type HeaderStyle = 'flat' | 'blur';
type HeaderLevel = 'default' | 'root';

interface ScreenHeaderProps {
  children?: React.ReactNode;
  headerLevel?: HeaderLevel;
  headerStyle?: HeaderStyle;
  leftActions?: React.ReactNode;
  leftElement?: React.ReactNode;
  onPressLeft?: () => void;
  onPressRight?: () => void;
  portalCurrentLabel?: string;
  portalRouteName?: string;
  portalRouteParams?: unknown;
  rightAccessibilityHint?: string;
  rightAccessibilityLabel?: string;
  rightActions?: React.ReactNode;
  rightElement?: React.ReactNode;
  subtitle?: string;
  title: string;
  titleIcon?: React.ReactNode;
  titleNode?: React.ReactNode;
}

interface HeaderIconButtonProps {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: TouchableOpacityProps['accessibilityRole'];
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  hitSlop?: TouchableOpacityProps['hitSlop'];
  onPress?: () => void;
}

const HEADER_ACTION_SIZE = tokens.mobile.heights.headerAction;
const HEADER_CONTENT_HEIGHT = tokens.mobile.heights.headerContent;
const HEADER_SUB_CONTENT_HEIGHT = tokens.mobile.heights.headerSubContent;
const HEADER_DISPLAY_SIZE = tokens.typography.mobile.display;
const HEADER_TITLE_SIZE = tokens.typography.mobile.title;
const HEADER_META_SIZE = tokens.typography.mobile.meta;
const HEADER_ROOT_HORIZONTAL_PADDING = tokens.spacing.lg;
const HEADER_SIDE_PADDING = tokens.spacing.md + tokens.spacing.xs;
const HEADER_TITLE_ICON_BOX_SIZE = tokens.icon.size.xl;

export function HeaderIconButton({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  active = false,
  children,
  disabled = false,
  hitSlop: _hitSlop = { bottom: 8, left: 8, right: 8, top: 8 },
  onPress,
}: HeaderIconButtonProps) {
  const colors = useThemeColors();

  return (
    <PressableScale
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      activeScale={0.94}
      className="items-center justify-center rounded-full"
      disabled={disabled || !onPress}
      style={{
        backgroundColor: active ? colors.primarySubtle : colors.fillQuaternary,
        height: HEADER_ACTION_SIZE,
        width: HEADER_ACTION_SIZE,
      }}
      onPress={onPress}
    >
      {children}
    </PressableScale>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  children,
  leftActions,
  leftElement,
  rightElement,
  rightActions,
  rightAccessibilityLabel,
  rightAccessibilityHint,
  headerLevel = 'default',
  titleIcon,
  titleNode,
  headerStyle = 'flat',
  portalCurrentLabel,
  portalRouteName,
  portalRouteParams,
  onPressLeft,
  onPressRight,
}: ScreenHeaderProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isSubScreen = !!leftElement;
  const isRootHeader = !isSubScreen && headerLevel === 'root';
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const blurTint = effectiveTheme === 'dark' ? 'dark' : 'light';
  const useFlat = headerStyle === 'flat' || Platform.OS === 'android';
  const portalChrome = portalRouteName ? (
    <PortalChromeBar
      currentLabel={portalCurrentLabel}
      routeName={portalRouteName}
      routeParams={portalRouteParams}
    />
  ) : null;

  const headerContent = (content: React.ReactNode) =>
    useFlat ? (
      <View
        className="border-b"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          paddingTop: insets.top,
        }}
      >
        {content}
      </View>
    ) : (
      <BlurView intensity={85} style={{ paddingTop: insets.top }} tint={blurTint}>
        {content}
      </BlurView>
    );

  const subScreenContent = (
    <>
      <Animated.View entering={enteringSection()}>
        <View
          className="flex-row items-center justify-between"
          style={{
            minHeight: HEADER_SUB_CONTENT_HEIGHT,
            paddingHorizontal: HEADER_SIDE_PADDING,
            paddingVertical: tokens.spacing.sm + 4,
          }}
        >
          <PressableScale
            accessibilityHint={t.accessibilityHintGoBack}
            accessibilityLabel={t.accessibilityGoBack}
            accessibilityRole="button"
            activeScale={0.94}
            className="-ml-2 items-center justify-center rounded-full"
            disabled={!onPressLeft}
            style={{ height: HEADER_ACTION_SIZE, minWidth: HEADER_ACTION_SIZE }}
            onPress={onPressLeft}
          >
            {leftElement}
          </PressableScale>

          <View
            className="ml-1 flex-1 flex-row items-center"
            style={{ minHeight: HEADER_TITLE_SIZE + tokens.spacing.sm }}
          >
            {titleIcon ? (
              <View
                className="mr-2.5 items-center justify-center"
                style={{ height: HEADER_TITLE_ICON_BOX_SIZE, width: HEADER_TITLE_ICON_BOX_SIZE }}
              >
                {titleIcon}
              </View>
            ) : null}
            <Text
              className="flex-1 font-semibold tracking-tighter"
              numberOfLines={1}
              style={{ color: colors.foreground, fontSize: HEADER_TITLE_SIZE }}
            >
              {title}
            </Text>
          </View>

          {rightActions ? (
            <View style={{ minWidth: HEADER_ACTION_SIZE }}>{rightActions}</View>
          ) : rightElement ? (
            <PressableScale
              accessibilityHint={rightAccessibilityHint}
              accessibilityLabel={rightAccessibilityLabel}
              accessibilityRole="button"
              activeScale={0.94}
              className="-mr-2 items-end justify-center rounded-full"
              disabled={!onPressRight}
              style={{ height: HEADER_ACTION_SIZE, minWidth: HEADER_ACTION_SIZE }}
              onPress={onPressRight}
            >
              {rightElement}
            </PressableScale>
          ) : (
            <View style={{ minWidth: HEADER_ACTION_SIZE }} />
          )}
        </View>
      </Animated.View>
      {portalChrome}
      {children}
    </>
  );

  const rootScreenContent = (
    <>
      <Animated.View entering={enteringSection()}>
        <View
          style={{
            minHeight: HEADER_CONTENT_HEIGHT,
            paddingBottom: tokens.spacing.md,
            paddingHorizontal: HEADER_ROOT_HORIZONTAL_PADDING,
            paddingTop: tokens.spacing.md + tokens.spacing.xs,
          }}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ minHeight: HEADER_CONTENT_HEIGHT }}
          >
            <View className="mr-4 flex-1 justify-center">
              {titleNode ? (
                <View className="flex-1 justify-center">{titleNode}</View>
              ) : (
                <View className="flex-row items-center">
                  {titleIcon ? (
                    <View
                      className="mr-3 items-center justify-center"
                      style={{
                        height: HEADER_TITLE_ICON_BOX_SIZE,
                        width: HEADER_TITLE_ICON_BOX_SIZE,
                      }}
                    >
                      {titleIcon}
                    </View>
                  ) : null}
                  <View className="flex-1">
                    <Text
                      className="font-bold tracking-tight"
                      numberOfLines={1}
                      style={{
                        color: colors.foreground,
                        fontSize: HEADER_DISPLAY_SIZE,
                        lineHeight: HEADER_DISPLAY_SIZE + tokens.spacing.xs,
                      }}
                    >
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text
                        className="mt-1 font-medium"
                        numberOfLines={2}
                        style={{ color: colors.muted, fontSize: HEADER_META_SIZE }}
                      >
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
            {rightActions ? (
              <View
                className="flex-row items-center justify-end"
                style={{ minWidth: HEADER_ACTION_SIZE }}
              >
                {rightActions}
              </View>
            ) : rightElement ? (
              <PressableScale
                accessibilityHint={rightAccessibilityHint}
                accessibilityLabel={rightAccessibilityLabel}
                accessibilityRole="button"
                activeScale={0.94}
                className="-mr-2 items-center justify-center rounded-full"
                disabled={!onPressRight}
                style={{ height: HEADER_ACTION_SIZE, width: HEADER_ACTION_SIZE }}
                onPress={onPressRight}
              >
                {rightElement}
              </PressableScale>
            ) : null}
          </View>
        </View>
      </Animated.View>
      {portalChrome}
      {children}
    </>
  );

  const mainScreenContent = (
    <>
      <Animated.View entering={enteringSection()}>
        <View
          style={{
            minHeight: HEADER_CONTENT_HEIGHT,
            paddingBottom: tokens.spacing.sm,
            paddingHorizontal: HEADER_SIDE_PADDING,
            paddingTop: tokens.spacing.sm + 4,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View
              className="mr-3 flex-1 flex-row items-center"
              style={{ minHeight: HEADER_TITLE_SIZE + tokens.spacing.sm }}
            >
              {leftActions ? (
                <View className="mr-2.5 flex-row items-center justify-center">{leftActions}</View>
              ) : null}
              {titleIcon ? (
                <View
                  className="mr-2.5 items-center justify-center"
                  style={{ height: HEADER_TITLE_ICON_BOX_SIZE, width: HEADER_TITLE_ICON_BOX_SIZE }}
                >
                  {titleIcon}
                </View>
              ) : null}
              {titleNode ? (
                <View className="flex-1 justify-center">{titleNode}</View>
              ) : (
                <View className="flex-1 justify-center">
                  <Text
                    className="font-semibold tracking-tighter"
                    style={{ color: colors.foreground, fontSize: HEADER_TITLE_SIZE }}
                  >
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text
                      className="mt-0.5 font-medium"
                      numberOfLines={1}
                      style={{ color: colors.muted, fontSize: HEADER_META_SIZE }}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
            {rightActions ? (
              <View className="flex-row items-center justify-end" style={{ minWidth: 40 }}>
                {rightActions}
              </View>
            ) : rightElement ? (
              <PressableScale
                accessibilityHint={rightAccessibilityHint}
                accessibilityLabel={rightAccessibilityLabel}
                accessibilityRole="button"
                activeScale={0.94}
                className="-mr-2 items-center justify-center rounded-full"
                disabled={!onPressRight}
                style={{ height: HEADER_ACTION_SIZE, width: HEADER_ACTION_SIZE }}
                onPress={onPressRight}
              >
                {rightElement}
              </PressableScale>
            ) : null}
          </View>
        </View>
      </Animated.View>
      {portalChrome}
      {children}
    </>
  );

  if (isSubScreen) {
    return headerContent(subScreenContent);
  }

  if (isRootHeader) {
    return headerContent(rootScreenContent);
  }

  return headerContent(mainScreenContent);
}
