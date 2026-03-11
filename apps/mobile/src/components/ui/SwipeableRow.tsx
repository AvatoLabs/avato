/**
 * SwipeableRow — Wraps a list item with swipe-to-reveal actions.
 *
 * Uses react-native-gesture-handler Swipeable.
 * Left swipe reveals a red "Delete" button.
 * Optional right swipe reveals a blue "Pin" button.
 */
import React, { memo, useCallback, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Called when user taps the delete action */
  onDelete?: () => void;
  /** Called when user taps the pin action (right swipe) */
  onPin?: () => void;
  /** Label for pin action */
  pinLabel?: string;
}

const SwipeableRow = memo<SwipeableRowProps>(({ children, onDelete, onPin, pinLabel }) => {
  const swipeableRef = useRef<Swipeable>(null);
  const { t } = useI18n();

  const close = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      if (!onDelete) return null;
      const scale = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
      });
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.deleteAction}
          onPress={() => {
            haptics.warning();
            close();
            onDelete();
          }}
        >
          <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
            {t.delete}
          </Animated.Text>
        </TouchableOpacity>
      );
    },
    [onDelete, close],
  );

  const renderLeftActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      if (!onPin) return null;
      const scale = dragX.interpolate({
        inputRange: [0, 80],
        outputRange: [0.5, 1],
        extrapolate: 'clamp',
      });
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.pinAction}
          onPress={() => {
            haptics.light();
            close();
            onPin();
          }}
        >
          <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
            {pinLabel || t.actionPin}
          </Animated.Text>
        </TouchableOpacity>
      );
    },
    [onPin, pinLabel, close],
  );

  const handleSwipeableOpen = useCallback((direction: 'left' | 'right') => {
    if (direction === 'right') haptics.medium();
    if (direction === 'left') haptics.medium();
  }, []);

  return (
    <Swipeable
      friction={2}
      leftThreshold={40}
      ref={swipeableRef}
      renderLeftActions={onPin ? renderLeftActions : undefined}
      renderRightActions={onDelete ? renderRightActions : undefined}
      rightThreshold={40}
      onSwipeableOpen={handleSwipeableOpen}
    >
      {children}
    </Swipeable>
  );
});

SwipeableRow.displayName = 'SwipeableRow';

const styles = StyleSheet.create({
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteAction: {
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    width: 80,
  },
  pinAction: {
    alignItems: 'center',
    backgroundColor: '#007aff',
    justifyContent: 'center',
    width: 80,
  },
});

export default SwipeableRow;
