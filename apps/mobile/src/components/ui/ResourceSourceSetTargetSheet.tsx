import { ChevronRight, FolderOpen } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { SourceSetItem } from '../../types';
import AdaptiveSheetModal from './AdaptiveSheetModal';

interface ResourceSourceSetTargetSheetProps {
  mode: 'add' | 'move';
  onClose: () => void;
  onSelect: (sourceSetId: string) => void | Promise<void>;
  sourceSets: SourceSetItem[];
  submitting: boolean;
  visible: boolean;
}

export default function ResourceSourceSetTargetSheet({
  mode,
  sourceSets,
  submitting,
  visible,
  onClose,
  onSelect,
}: ResourceSourceSetTargetSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <AdaptiveSheetModal maxHeight="60%" preferredWidth={560} visible={visible} onClose={onClose}>
      <View className="items-center pt-3 pb-2">
        <View className="w-9 h-1 rounded-full bg-foreground/10" />
      </View>
      <View className="px-5">
        <Text className="text-[18px] font-bold text-foreground">
          {mode === 'move' ? t.resourceMoveToSourceSet : t.resourceAddToSourceSet}
        </Text>
        <Text className="mt-1 text-[13px]" style={{ color: colors.secondaryText }}>
          {t.resourceSelectSourceSetTarget}
        </Text>
      </View>
      <ScrollView className="mt-3 max-h-72">
        {sourceSets.map((sourceSet) => (
          <TouchableOpacity
            activeOpacity={0.72}
            className="mx-5 mt-1 flex-row items-center rounded-xl px-4 py-3"
            disabled={submitting}
            key={sourceSet.id}
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={() => void onSelect(sourceSet.id)}
          >
            <FolderOpen color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
            <Text className="ml-3 flex-1 text-[16px] font-medium text-foreground">
              {sourceSet.name}
            </Text>
            {submitting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <ChevronRight color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AdaptiveSheetModal>
  );
}
