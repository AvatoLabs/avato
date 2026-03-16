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
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  duration?: number;
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  current: ToastItem | null;
  dismiss: () => void;
  mute: (durationMs: number) => void;
  mutedUntil: number;
  show: (type: ToastType, message: string, options?: { duration?: number }) => void;
}

let _toastId = 0;

export const useToast = create<ToastStore>((set, get) => ({
  current: null,
  mutedUntil: 0,
  mute: (durationMs) => set({ mutedUntil: Date.now() + Math.max(durationMs, 0) }),
  show: (type, message, options) => {
    if (get().mutedUntil > Date.now()) return;
    _toastId += 1;
    const duration =
      options?.duration ?? (type === 'error' ? Math.max(4000, Math.min(message.length * 60, 8000)) : DURATION);
    set({ current: { id: _toastId, type, message, duration } });
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Icon color="#fff" size={15} strokeWidth={2.5} style={isError ? { marginTop: 2 } : undefined} />
        <Text
          numberOfLines={isError ? 6 : 1}
          style={{
            color: '#fff',
            fontSize: isError ? 13 : 14,
            fontWeight: '600',
            letterSpacing: -0.2,
            lineHeight: isError ? 18 : undefined,
            marginLeft: 7,
            maxWidth: 300,
          }}
        >
          {item.message}
        </Text>
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
      pointerEvents="none"
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
