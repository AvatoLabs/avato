import React from 'react';
import { TouchableOpacity, View, type ViewProps } from 'react-native';

interface SurfaceCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  elevated?: boolean;
  onPress?: () => void;
}

/**
 * A borderless card using subtle background opacity instead of hard strokes.
 */
export function SurfaceCard({ children, onPress, className = '', elevated = false, ...props }: SurfaceCardProps) {
  const baseClasses = 'rounded-2xl overflow-hidden';
  // Use a very subtle background, no border!
  const surfaceClasses = elevated
      ? 'bg-foreground/5 dark:bg-white/10'
      : 'bg-transparent active:bg-foreground/5';

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className={`${baseClasses} ${surfaceClasses} ${className}`}
        onPress={onPress}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={`${baseClasses} ${surfaceClasses} ${className}`} {...props}>
      {children}
    </View>
  );
}
