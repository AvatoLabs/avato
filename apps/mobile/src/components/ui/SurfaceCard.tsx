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
 * A glassmorphic card using subtle background opacity and a thin border for depth.
 */
export function SurfaceCard({
  children,
  onPress,
  className = '',
  elevated = false,
  ...props
}: SurfaceCardProps) {
  const baseClasses = 'rounded-xl overflow-hidden border border-border';
  const surfaceClasses = elevated ? 'bg-foreground/5' : 'bg-transparent active:bg-foreground/5';

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className={`${baseClasses} ${surfaceClasses} ${className}`}
        onPress={onPress}
        {...(props as any)}
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
