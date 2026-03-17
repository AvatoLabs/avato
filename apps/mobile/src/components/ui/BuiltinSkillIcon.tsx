/**
 * BuiltinSkillIcon — Renders the icon for a pre-installed builtin skill.
 * Uses the same avatars as web (emoji from manifests).
 */
import React from 'react';
import { Text, View } from 'react-native';

import type { MobileRecommendedBuiltinIcon } from '../../constants/recommendedBuiltins';

const ICON_MAP: Record<MobileRecommendedBuiltinIcon, string> = {
  artifacts: '🎨',
  cloud: '💻',
  gtd: '✅',
  notebook: '📓',
  calculator: '🧮',
  memory: '🧠',
};

interface BuiltinSkillIconProps {
  icon: MobileRecommendedBuiltinIcon;
  size?: number;
}

export function BuiltinSkillIcon({ icon, size = 36 }: BuiltinSkillIconProps) {
  const emoji = ICON_MAP[icon] ?? '🔧';

  return (
    <View
      className="items-center justify-center rounded-xl overflow-hidden"
      style={{
        width: size,
        height: size,
        backgroundColor: 'rgba(0,0,0,0.04)',
      }}
    >
      <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
    </View>
  );
}
