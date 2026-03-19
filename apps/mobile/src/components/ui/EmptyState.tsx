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
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useThemeColors } from '../../theme/colors';
import { enteringEmptyState } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

const EMPTY_ILLUSTRATION_SIZE = 80;
const EMPTY_ICON_SIZE = 40;

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
  /** Additional padding */
  className?: string;
  /** Optional secondary description */
  description?: string;
  /** @deprecated Use iconVariant. Emoji fallback when iconVariant not set. */
  icon?: string;
  /** Theme-colored logo variant: chat | resource | store | topic | agent | memory | model | artwork | discover | provider | logs | warning | default */
  iconVariant?: keyof typeof VARIANT_ICONS;
  /** Primary title shown above description */
  title: string;
}

export default function EmptyState({
  title,
  description,
  icon = '📭',
  iconVariant,
  action,
  className = '',
}: EmptyStateProps) {
  const colors = useThemeColors();
  const IconComponent = iconVariant ? (VARIANT_ICONS[iconVariant] ?? VARIANT_ICONS.default) : null;

  return (
    <Animated.View
      accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
      className={`items-center justify-center px-8 py-12 ${className}`}
      entering={enteringEmptyState()}
      style={{ minHeight: 160 }}
    >
      {IconComponent ? (
        <View
          className="mb-4 items-center justify-center rounded-2xl"
          style={{
            width: EMPTY_ILLUSTRATION_SIZE,
            height: EMPTY_ILLUSTRATION_SIZE,
            backgroundColor: colors.primary + '15',
          }}
        >
          <IconComponent
            color={colors.primary}
            size={EMPTY_ICON_SIZE}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </View>
      ) : (
        <Text className="text-4xl mb-4" style={{ color: colors.foreground, fontSize: 32 }}>
          {icon}
        </Text>
      )}
      <Text
        className="text-center text-[16px] font-semibold mb-1.5"
        style={{ color: colors.foreground }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          className="text-center text-[14px] mb-4"
          style={{ color: colors.secondaryText + '99' }}
        >
          {description}
        </Text>
      ) : null}
      {action ?? null}
    </Animated.View>
  );
}
