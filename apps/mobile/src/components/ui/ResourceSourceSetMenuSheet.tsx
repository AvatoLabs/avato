import { Pencil, Share2, Trash2, Users } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import AdaptiveSheetModal from './AdaptiveSheetModal';

interface ResourceSourceSetMenuSheetProps {
  onClose: () => void;
  onDelete: () => void;
  onManageShare: () => void;
  onRename: () => void;
  onShare: () => void;
  visible: boolean;
}

export default function ResourceSourceSetMenuSheet({
  visible,
  onClose,
  onDelete,
  onManageShare,
  onRename,
  onShare,
}: ResourceSourceSetMenuSheetProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <AdaptiveSheetModal overflowHidden preferredWidth={520} visible={visible} onClose={onClose}>
      <View className="items-center pt-3 pb-2">
        <View className="w-9 h-1 rounded-full bg-foreground/10" />
      </View>
      <Text className="mb-1 px-5 text-[16px] font-semibold text-foreground">
        {t.resourceShareSourceSetMenuTitle}
      </Text>
      <Pressable
        className="flex-row items-center px-5 py-3.5 active:bg-foreground/5"
        onPress={onShare}
      >
        <Share2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
        <Text className="ml-3 text-base text-foreground">{t.resourceShareSourceSet}</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center px-5 py-3.5 active:bg-foreground/5"
        onPress={onManageShare}
      >
        <Users color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
        <Text className="ml-3 text-base text-foreground">{t.resourceShareManage}</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center px-5 py-3.5 active:bg-foreground/5"
        onPress={onRename}
      >
        <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
        <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
      </Pressable>
      <Pressable
        className="flex-row items-center px-5 py-3.5 active:bg-foreground/5"
        onPress={onDelete}
      >
        <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
        <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
      </Pressable>
      <View className="mt-1 px-5">
        <Pressable
          className="items-center rounded-xl bg-foreground/[0.04] py-3.5"
          onPress={onClose}
        >
          <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
            {t.cancel}
          </Text>
        </Pressable>
      </View>
    </AdaptiveSheetModal>
  );
}
