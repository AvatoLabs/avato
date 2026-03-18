/**
 * SliderWithInput - A slider component with integrated input field
 * Similar to @lobehub/ui SliderWithInput but for React Native
 */
import React, { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface SliderWithInputProps {
  disabled?: boolean;
  enableCheckbox?: boolean;
  enabled?: boolean;
  max: number;
  min: number;
  onChange?: (value: number) => void;
  onToggleEnabled?: (enabled: boolean) => void;
  step?: number;
  value: number;
}

export const SliderWithInput: React.FC<SliderWithInputProps> = ({
  disabled = false,
  enableCheckbox = false,
  enabled = true,
  max,
  min,
  onChange,
  onToggleEnabled,
  step = 0.1,
  value,
}) => {
  const colors = useThemeColors();
  const [inputValue, setInputValue] = useState(String(value));
  const [sliderWidth, setSliderWidth] = useState<number>(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flexDirection: 'row', alignItems: 'center', width: '100%' },
        checkbox: {
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 1.5,
          marginRight: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        checkboxChecked: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        checkboxUnchecked: {
          borderColor: colors.borderDefault,
          backgroundColor: 'transparent',
        },
        checkboxInner: {
          width: 10,
          height: 10,
          backgroundColor: colors.surface,
          borderRadius: 2,
        },
        sliderContainer: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        sliderWrapper: {
          flex: 1,
          height: 40,
          justifyContent: 'center',
          position: 'relative' as const,
        },
        trackBackground: {
          height: 6,
          backgroundColor: colors.sliderTrack,
          borderRadius: 3,
          overflow: 'hidden' as const,
          width: '100%',
        },
        ticksContainer: {
          position: 'absolute' as const,
          top: 14,
          left: 0,
          right: 0,
          height: 8,
        },
        tick: {
          position: 'absolute' as const,
          backgroundColor: colors.iconMuted,
          opacity: 0.5,
          bottom: 0,
        },
        trackActive: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: 3,
        },
        trackDisabled: {
          backgroundColor: colors.sliderTrackDisabled,
        },
        thumb: {
          position: 'absolute' as const,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.primary,
          top: '50%',
          marginTop: -10,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        },
        thumbDisabled: {
          backgroundColor: colors.iconMuted,
        },
        input: {
          width: 60,
          height: 36,
          borderRadius: 8,
          backgroundColor: colors.fillTertiary,
          textAlign: 'center',
          fontSize: 14,
          color: colors.foreground,
          fontWeight: '500',
        },
        inputDisabled: {
          backgroundColor: colors.fillQuaternary,
          color: colors.iconMuted,
        },
      }),
    [colors],
  );

  // Calculate number of steps for tick marks
  const tickCount = Math.round((max - min) / step) + 1;
  const showTicks = tickCount <= 21; // Only show ticks if not too crowded

  // Calculate thumb position percentage (0-100%)
  const progress = ((value - min) / (max - min)) * 100;

  const handleLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    setSliderWidth(width);
  }, []);

  const calculateValueFromPosition = useCallback(
    (positionX: number) => {
      const containerWidth = sliderWidth || 1;
      const percentage = Math.max(0, Math.min(1, positionX / containerWidth));
      const rawValue = min + percentage * (max - min);
      return Math.round(rawValue / step) * step;
    },
    [min, max, step, sliderWidth],
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && (!enableCheckbox || enabled),
    onMoveShouldSetPanResponder: () => !disabled && (!enableCheckbox || enabled),
    onPanResponderGrant: () => {
      // Initial touch
    },
    onPanResponderMove: (_, gestureState) => {
      const newValue = calculateValueFromPosition(gestureState.moveX);
      setInputValue(String(newValue));
      onChange?.(newValue);
    },
    onPanResponderRelease: (_, gestureState) => {
      const newValue = calculateValueFromPosition(gestureState.moveX);
      setInputValue(String(newValue));
      onChange?.(newValue);
    },
  });

  const handleInputChange = useCallback(
    (text: string) => {
      setInputValue(text);
      const numValue = parseFloat(text);
      if (!isNaN(numValue)) {
        const clampedValue = Math.max(min, Math.min(max, numValue));
        onChange?.(clampedValue);
      }
    },
    [min, max, onChange],
  );

  const handleToggle = useCallback(() => {
    onToggleEnabled?.(!enabled);
  }, [enabled, onToggleEnabled]);

  const isDisabled = disabled || (enableCheckbox && !enabled);

  return (
    <View style={styles.container}>
      {/* Optional checkbox to enable/disable */}
      {enableCheckbox && (
        <TouchableOpacity
          disabled={disabled}
          style={[styles.checkbox, enabled ? styles.checkboxChecked : styles.checkboxUnchecked]}
          onPress={handleToggle}
        >
          {enabled && <View style={styles.checkboxInner} />}
        </TouchableOpacity>
      )}

      {/* Slider and Input */}
      <View style={styles.sliderContainer}>
        {/* Custom Slider Track */}
        <View style={styles.sliderWrapper} onLayout={handleLayout} {...panResponder.panHandlers}>
          {/* Background track */}
          <View style={styles.trackBackground}>
            {/* Active track (filled portion) */}
            <View
              style={[
                styles.trackActive,
                { width: `${Math.max(5, progress)}%` },
                isDisabled && styles.trackDisabled,
              ]}
            />
          </View>

          {/* Tick marks */}
          {showTicks && !isDisabled && (
            <View style={styles.ticksContainer}>
              {Array.from({ length: tickCount }).map((_, index) => {
                const tickPosition = (index / (tickCount - 1)) * 100;
                const isMajorTick = index % Math.ceil(tickCount / 5) === 0;
                return (
                  <View
                    key={index}
                    style={[
                      styles.tick,
                      {
                        left: `${tickPosition}%`,
                        height: isMajorTick ? 8 : 4,
                        width: isMajorTick ? 2 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}

          {/* Thumb (draggable knob) */}
          <View
            style={[
              styles.thumb,
              { left: `${Math.max(5, Math.min(95, progress))}%` },
              isDisabled && styles.thumbDisabled,
            ]}
          />
        </View>

        {/* Input field */}
        <TextInput
          editable={!isDisabled}
          keyboardType="decimal-pad"
          style={[styles.input, isDisabled && styles.inputDisabled]}
          value={inputValue}
          onChangeText={handleInputChange}
        />
      </View>
    </View>
  );
};
