/**
 * EmptyState — Unified empty state with theme-colored logo illustration.
 * Uses vector icons (no实物图片), consistent position and style.
 */
import {
  AlertTriangle,
  Bot,
  Brain,
  Cpu,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  List,
  type LucideIcon,
  MessageSquare,
  Package,
  Search,
  Server,
} from 'lucide-react-native';
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { withAlpha } from '../../constants/tags';
import { useThemeColors } from '../../theme/colors';
import { enteringEmptyState } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

const EMPTY_WATERMARK_SIZE = 112;
const EMPTY_ILLUSTRATION_SIZE = 72;
const EMPTY_ICON_SIZE = 28;

const VARIANT_ICONS: Record<string, LucideIcon> = {
  agent: Bot,
  artwork: ImageIcon,
  chat: MessageSquare,
  default: MessageSquare,
  discover: Search,
  logs: FileText,
  memory: Brain,
  model: Cpu,
  provider: Server,
  resource: FolderOpen,
  store: Package,
  topic: List,
  warning: AlertTriangle,
};

interface EmptyStateProps {
  /** Optional CTA element (button, link) */
  action?: React.ReactNode;
  /** Tighter layout for hero-style home screens */
  compact?: boolean;
  /** Optional secondary description */
  description?: string;
  /** @deprecated Use iconVariant. Emoji fallback when iconVariant not set. */
  icon?: string;
  /** Theme-colored logo variant: chat | resource | store | topic | agent | memory | model | artwork | discover | provider | logs | warning | default */
  iconVariant?: keyof typeof VARIANT_ICONS;
  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
  /** Primary title shown above description */
  title: string;
}

export default function EmptyState({
  title,
  description,
  icon = '📭',
  iconVariant,
  action,
  compact = false,
  style,
}: EmptyStateProps) {
  const colors = useThemeColors();
  const IconComponent = iconVariant ? (VARIANT_ICONS[iconVariant] ?? VARIANT_ICONS.default) : null;
  const watermarkIconColor = withAlpha(colors.foreground, '12');
  const watermarkPlate = withAlpha(colors.foreground, '04');
  const illustrationSurface = withAlpha(colors.primary, '12');
  const illustrationBorder = withAlpha(colors.primary, '18');
  const shellBorder = colors.border;
  const shellBg = colors.card;
  const descriptionColor = colors.tertiaryText;
  const watermarkSize = compact ? 96 : EMPTY_WATERMARK_SIZE;
  const illustrationSize = compact ? 64 : EMPTY_ILLUSTRATION_SIZE;
  const iconSize = compact ? 24 : EMPTY_ICON_SIZE;
  const watermarkPlateRadius = compact ? 24 : 30;
  const shellRadius = compact ? 24 : 28;
  const shellMaxWidth = compact ? 312 : 336;

  return (
    <Animated.View
      accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
      entering={enteringEmptyState()}
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: compact ? 156 : 184,
          paddingHorizontal: 32,
          paddingVertical: compact ? 32 : 48,
        },
        style,
      ]}
    >
      <View
        className="items-center px-6"
        style={{
          backgroundColor: shellBg,
          borderColor: shellBorder,
          borderWidth: 1,
          borderRadius: shellRadius,
          maxWidth: shellMaxWidth,
          paddingVertical: compact ? 24 : 28,
          width: '100%',
        }}
      >
        <View className={`${compact ? 'mb-4' : 'mb-6'} items-center justify-center`}>
          {IconComponent ? (
            <View
              className="absolute items-center justify-center"
              pointerEvents="none"
              style={{ height: watermarkSize, width: watermarkSize }}
            >
              <View
                className="absolute"
                style={{
                  backgroundColor: watermarkPlate,
                  borderRadius: watermarkPlateRadius,
                  height: watermarkSize - 8,
                  transform: [{ rotate: '-8deg' }],
                  width: watermarkSize - 2,
                }}
              />
              <View
                className="absolute items-center justify-center"
                style={{
                  height: watermarkSize,
                  transform: [{ translateX: compact ? 8 : 10 }, { translateY: compact ? 4 : 6 }],
                  width: watermarkSize,
                }}
              >
                <IconComponent
                  color={watermarkIconColor}
                  size={compact ? 46 : 56}
                  strokeWidth={0.9}
                />
              </View>
            </View>
          ) : null}

          {IconComponent ? (
            <View
              className="items-center justify-center"
              style={{
                backgroundColor: illustrationSurface,
                borderColor: illustrationBorder,
                borderWidth: 1,
                borderRadius: compact ? 20 : 24,
                height: illustrationSize,
                width: illustrationSize,
              }}
            >
              <IconComponent
                color={colors.primary}
                size={iconSize}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </View>
          ) : (
            <Text className="text-4xl" style={{ color: colors.foreground, fontSize: 32 }}>
              {icon}
            </Text>
          )}
        </View>

        <Text
          className={`text-center ${compact ? 'text-[17px]' : 'text-[19px]'} font-semibold`}
          style={{ color: colors.foreground, lineHeight: compact ? 23 : 25 }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            className={`text-center ${compact ? 'mt-1.5' : 'mt-2'} text-[14px]`}
            style={{ color: descriptionColor, lineHeight: 21, maxWidth: compact ? 236 : 248 }}
          >
            {description}
          </Text>
        ) : null}
        {action ? <View className={`${compact ? 'mt-4' : 'mt-5'} w-full`}>{action}</View> : null}
      </View>
    </Animated.View>
  );
}
