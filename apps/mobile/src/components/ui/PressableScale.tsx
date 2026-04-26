/**
 * PressableScale — High-performance press feedback using UI-thread spring animations.
 *
 * All animation calculations run on the native UI thread via Reanimated worklets,
 * completely bypassing the JS bridge. The result: zero-latency tactile feedback
 * that feels like precision hardware, not software.
 *
 * Usage:
 *   <PressableScale onPress={handlePress} className="...">
 *     <Text>Tap me</Text>
 *   </PressableScale>
 */
import React, { memo } from 'react';
import { type AccessibilityRole, type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { tokens } from '../../theme/tokens';

interface PressableScaleProps {
  /** Accessibility */
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole | 'none';
  /** Scale when pressed. Default: 0.97 — subtle but perceptible */
  activeScale?: number;
  children: React.ReactNode;
  /** Additional NativeWind class names */
  className?: string;
  /** Layout style for the outer animated gesture container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Spring damping. Higher = less bounce. Default: 15 */
  damping?: number;
  /** Disable interaction */
  disabled?: boolean;
  /** Duration threshold for long press (ms). Default: 300 */
  longPressDuration?: number;
  /** Long-press handler */
  onLongPress?: () => void;
  /** Press handler (called on JS thread after gesture completes) */
  onPress?: () => void;
  /** Spring stiffness. Higher = snappier. Default: 150 */
  stiffness?: number;
  /** Extra inline styles */
  style?: StyleProp<ViewStyle>;
}

const PressableScale = memo<PressableScaleProps>(
  ({
    children,
    className,
    containerStyle,
    disabled = false,
    onPress,
    onLongPress,
    longPressDuration = 300,
    activeScale = 0.98,
    damping = tokens.motion.spring.snappy.damping,
    stiffness = tokens.motion.spring.snappy.stiffness,
    style,
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole = 'button',
  }) => {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);

    const springConfig = { damping, stiffness, mass: 1 };

    // Tap gesture — runs entirely on UI thread
    const tap = Gesture.Tap()
      .enabled(!disabled)
      .maxDuration(10_000)
      .onBegin(() => {
        'worklet';
        scale.value = withSpring(activeScale, springConfig);
        translateY.value = withSpring(1, springConfig);
        opacity.value = withSpring(0.96, springConfig);
      })
      .onFinalize((_event, success) => {
        'worklet';
        scale.value = withSpring(1, springConfig);
        translateY.value = withSpring(0, springConfig);
        opacity.value = withSpring(1, springConfig);
        if (success && onPress) {
          runOnJS(onPress)();
        }
      });

    // Long-press gesture — also UI thread
    const longPress = Gesture.LongPress()
      .enabled(!disabled && !!onLongPress)
      .minDuration(longPressDuration)
      .onStart(() => {
        'worklet';
        if (onLongPress) {
          runOnJS(onLongPress)();
        }
      })
      .onFinalize(() => {
        'worklet';
        scale.value = withSpring(1, springConfig);
        translateY.value = withSpring(0, springConfig);
        opacity.value = withSpring(1, springConfig);
      });

    // Compose: long press has priority, tap is fallback
    const composed = onLongPress ? Gesture.Exclusive(longPress, tap) : tap;

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
    }));

    return (
      <GestureDetector gesture={composed}>
        <Animated.View style={[animatedStyle, containerStyle]}>
          <View
            accessible
            accessibilityHint={accessibilityHint}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            className={className}
            style={style}
          >
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  },
);

PressableScale.displayName = 'PressableScale';

export default PressableScale;
