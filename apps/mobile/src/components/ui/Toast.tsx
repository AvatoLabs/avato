/**
 * Toast — lightweight notification system with Zustand store.
 *
 * Usage:
 *   import { useToast, ToastContainer } from '../components/ui/Toast';
 *   const toast = useToast();
 *   toast.show('success', 'Saved!');
 *
 * Mount <ToastContainer /> once in App.tsx.
 */
import { CheckCircle, Info, XCircle } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  current: ToastItem | null;
  dismiss: () => void;
  show: (type: ToastType, message: string) => void;
}

let _toastId = 0;

export const useToast = create<ToastStore>((set) => ({
  current: null,
  show: (type, message) => {
    _toastId += 1;
    set({ current: { id: _toastId, type, message } });
  },
  dismiss: () => set({ current: null }),
}));

// ── Colors ───────────────────────────────────────────────────────────
const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#15803d', border: '#166534', icon: '#fff' },
  error: { bg: '#b42318', border: '#912018', icon: '#fff' },
  info: { bg: '#1d4ed8', border: '#1e40af', icon: '#fff' },
};

const ICONS: Record<ToastType, React.ComponentType<any>> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

// ── Toast UI ─────────────────────────────────────────────────────────
const DURATION = 2800;

const ToastBubble = memo<{ item: ToastItem; onDone: () => void }>(({ item, onDone }) => {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onDone());
    }, DURATION);

    return () => clearTimeout(timer);
  }, [item.id]);

  const colors = COLORS[item.type];
  const Icon = ICONS[item.type];

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginHorizontal: 16,
        maxWidth: 680,
        paddingHorizontal: 12,
        paddingVertical: 10,
        width: '92%',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 5,
        alignSelf: 'center',
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: 999,
          height: 22,
          justifyContent: 'center',
          width: 22,
        }}
      >
        <Icon color={colors.icon} size={14} strokeWidth={2.4} />
      </View>
      <Text
        numberOfLines={2}
        style={{ color: '#fff', fontSize: 13.5, fontWeight: '600', marginLeft: 8, flex: 1 }}
      >
        {item.message}
      </Text>
    </Animated.View>
  );
});
ToastBubble.displayName = 'ToastBubble';

// ── Container (mount once in App.tsx) ────────────────────────────────
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
        top: insets.top + 8,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <ToastBubble item={current} onDone={handleDone} />
    </View>
  );
});
ToastContainer.displayName = 'ToastContainer';
