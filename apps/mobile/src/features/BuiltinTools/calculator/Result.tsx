/**
 * Calculator Result Render — Simple result card for lobe-calculator.
 * Displays calculation result from content.
 */
import { Calculator } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/colors';
import type { MobileBuiltinRenderProps } from '../types';

const CalculatorResultRender = memo<MobileBuiltinRenderProps>(({ content }) => {
  const colors = useThemeColors();

  const text = content?.trim();
  if (!text) return null;

  return (
    <View
      className="rounded-xl border px-3 py-3 flex-row items-center gap-2"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
      }}
    >
      <Calculator color={colors.primary} size={18} strokeWidth={2} />
      <Text
        selectable
        className="flex-1 text-[14px] font-medium"
        style={{
          color: colors.foreground,
          fontFamily: 'Menlo',
        }}
      >
        {text}
      </Text>
    </View>
  );
});

CalculatorResultRender.displayName = 'CalculatorResultRender';

export default CalculatorResultRender;
