import { ChevronDown, FolderOpen } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface ResourceTreeRootHeaderProps {
  currentFolderId: string | null;
  onPress: () => void;
  rootLabel: string;
  subtitle: string;
}

export default function ResourceTreeRootHeader({
  currentFolderId,
  onPress,
  rootLabel,
  subtitle,
}: ResourceTreeRootHeaderProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity activeOpacity={0.72} className="px-4 pt-1 pb-2" onPress={onPress}>
      <View
        className="flex-row items-center rounded-2xl px-3 py-2.5"
        style={{
          backgroundColor: currentFolderId ? colors.fillTertiary : colors.primarySubtle,
        }}
      >
        <View className="mr-2 h-6 w-6 items-center justify-center">
          <ChevronDown
            color={currentFolderId ? colors.muted : colors.primary}
            size={16}
            strokeWidth={2.2}
          />
        </View>
        <View
          className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
          style={{
            backgroundColor: currentFolderId ? colors.fillQuaternary : `${colors.primary}18`,
          }}
        >
          <FolderOpen
            color={currentFolderId ? colors.muted : colors.primary}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-[14px] font-medium"
            numberOfLines={1}
            style={{ color: currentFolderId ? colors.foreground : colors.primary }}
          >
            {rootLabel}
          </Text>
          <Text
            className="mt-0.5 text-[11px]"
            numberOfLines={1}
            style={{ color: colors.secondaryText }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
