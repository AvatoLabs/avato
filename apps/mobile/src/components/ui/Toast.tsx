/**
 * Toast — minimal pill-style notification.
 *
 * Usage:
 *   import { useToast, ToastContainer } from '../components/ui/Toast';
 *   const toast = useToast();
 *   toast.show('success', 'Saved');
 *
 * Mount <ToastContainer /> once in App.tsx.
 */
import { AlertCircle, Check, Info } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  duration?: number;
  id: number;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  type: ToastType;
}

interface ToastStore {
  current: ToastItem | null;
  dismiss: () => void;
  mute: (durationMs: number) => void;
  mutedUntil: number;
  show: (
    type: ToastType,
    message: string,
    options?: { duration?: number; onRetry?: () => void; retryLabel?: string },
  ) => void;
}

let _toastId = 0;

export const useToast = create<ToastStore>((set, get) => ({
  current: null,
  mutedUntil: 0,
  mute: (durationMs) => set({ mutedUntil: Date.now() + Math.max(durationMs, 0) }),
  show: (type, message, options) => {
    if (get().mutedUntil > Date.now()) return;
    const safeMessage = (typeof message === 'string' && message.trim()) || 'Something went wrong.';
    _toastId += 1;
    const duration =
      options?.duration ??
      (type === 'error' ? Math.max(4000, Math.min(safeMessage.length * 60, 8000)) : DURATION);
    set({
      current: {
        id: _toastId,
        type,
        message: safeMessage,
        duration,
        onRetry: options?.onRetry,
        retryLabel: options?.retryLabel,
      },
    });
  },
  dismiss: () => set({ current: null }),
}));

const ICON_MAP: Record<ToastType, React.ComponentType<any>> = {
  error: AlertCircle,
  info: Info,
  success: Check,
};

const DURATION = 2200;

const ToastBubble = memo<{ item: ToastItem; onDone: () => void }>(({ item, onDone }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const displayDuration = item.duration ?? DURATION;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 3 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 3 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -16, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.95, duration: 220, useNativeDriver: true }),
      ]).start(() => onDone());
    }, displayDuration);

    return () => clearTimeout(timer);
  }, [item.id]);

  const isError = item.type === 'error';
  const Icon = ICON_MAP[item.type];
  const showRetry = isError && item.onRetry;
  const retryLabel = item.retryLabel ?? t.errorRetry;

  const handleRetry = useCallback(() => {
    onDone();
    item.onRetry?.();
  }, [item.onRetry, onDone]);

  return (
    <Animated.View
      style={{
        alignSelf: 'center',
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <View
        style={{
          alignItems: isError ? 'flex-start' : 'center',
          backgroundColor: isError ? 'rgba(220,38,38,0.92)' : 'rgba(28,28,30,0.92)',
          borderRadius: isError ? 14 : 50,
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: isError ? 12 : 10,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Icon
          color={colors.iconOnPrimary}
          size={15}
          strokeWidth={2.5}
          style={isError ? { marginTop: 2 } : undefined}
        />
        <Text
          numberOfLines={isError ? 6 : 1}
          style={{
            color: colors.iconOnPrimary,
            flex: 1,
            fontSize: isError ? 13 : 14,
            fontWeight: '600',
            letterSpacing: -0.2,
            lineHeight: isError ? 18 : undefined,
            marginLeft: 7,
            maxWidth: showRetry ? 220 : 300,
          }}
        >
          {item.message}
        </Text>
        {showRetry ? (
          <TouchableOpacity
            accessibilityHint={t.accessibilityHintRetry}
            accessibilityLabel={retryLabel}
            accessibilityRole="button"
            activeOpacity={0.8}
            className="ml-2 py-1 px-2"
            onPress={handleRetry}
          >
            <Text style={{ color: colors.iconOnPrimary, fontSize: 13, fontWeight: '700' }}>{retryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
});
ToastBubble.displayName = 'ToastBubble';

export const ToastContainer = memo(() => {
  const insets = useSafeAreaInsets();
  const current = useToast((s) => s.current);
  const dismiss = useToast((s) => s.dismiss);

  const handleDone = useCallback(() => dismiss(), [dismiss]);

  if (!current) return null;

  return (
    <View
      pointerEvents={current.onRetry ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        top: insets.top + 10,
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
      }}
    >
      <ToastBubble item={current} onDone={handleDone} />
    </View>
  );
});
ToastContainer.displayName = 'ToastContainer';
