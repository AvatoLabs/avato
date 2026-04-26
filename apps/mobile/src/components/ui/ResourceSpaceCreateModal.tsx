import { Plus } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import AdaptiveSheetModal from './AdaptiveSheetModal';

interface ResourceSpaceCreateModalMessages {
  cancel: string;
  workspaceCreateConfirm: string;
  workspaceCreateCreating: string;
  workspaceCreateDescriptionPlaceholder: string;
  workspaceCreateNamePlaceholder: string;
  workspaceCreateTitle: string;
}

interface ResourceSpaceCreateModalProps {
  descriptionDraft: string;
  messages: ResourceSpaceCreateModalMessages;
  nameDraft: string;
  onChangeDescription: (value: string) => void;
  onChangeName: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  visible: boolean;
}

export default function ResourceSpaceCreateModal({
  descriptionDraft,
  messages,
  nameDraft,
  submitting,
  visible,
  onChangeDescription,
  onChangeName,
  onClose,
  onSubmit,
}: ResourceSpaceCreateModalProps) {
  const colors = useThemeColors();

  return (
    <AdaptiveSheetModal maxHeight="72%" preferredWidth={560} visible={visible} onClose={onClose}>
      <View className="items-center pt-3 pb-2">
        <View className="h-1 w-9 rounded-full bg-foreground/10" />
      </View>
      <View className="px-5">
        <Text className="text-[18px] font-bold text-foreground">
          {messages.workspaceCreateTitle}
        </Text>
      </View>
      <View className="px-5 pb-2 pt-4">
        <TextInput
          autoFocus
          className="rounded-xl px-4 py-3 text-[16px] text-foreground"
          editable={!submitting}
          placeholder={messages.workspaceCreateNamePlaceholder}
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          style={{ backgroundColor: colors.fillTertiary }}
          value={nameDraft}
          onChangeText={onChangeName}
        />
        <TextInput
          multiline
          className="mt-3 rounded-xl px-4 py-3 text-[15px] text-foreground"
          editable={!submitting}
          numberOfLines={4}
          placeholder={messages.workspaceCreateDescriptionPlaceholder}
          placeholderTextColor={colors.muted}
          value={descriptionDraft}
          style={{
            backgroundColor: colors.fillTertiary,
            minHeight: 112,
            textAlignVertical: 'top',
          }}
          onChangeText={onChangeDescription}
        />
        <View className="mt-4 flex-row">
          <TouchableOpacity
            activeOpacity={0.7}
            className="mr-2 flex-1 items-center rounded-xl py-3"
            style={{ backgroundColor: colors.fillTertiary }}
            onPress={onClose}
          >
            <Text className="text-[15px] font-medium" style={{ color: colors.secondaryText }}>
              {messages.cancel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.78}
            className="ml-2 flex-1 flex-row items-center justify-center rounded-xl py-3"
            disabled={!nameDraft.trim() || submitting}
            style={{
              backgroundColor:
                !nameDraft.trim() || submitting ? colors.fillQuaternary : colors.primary,
            }}
            onPress={onSubmit}
          >
            {submitting ? (
              <>
                <ActivityIndicator color={colors.background} size="small" />
                <Text
                  className="ml-2 text-[15px] font-semibold"
                  style={{ color: colors.background }}
                >
                  {messages.workspaceCreateCreating}
                </Text>
              </>
            ) : (
              <>
                <Plus color={colors.background} size={16} strokeWidth={tokens.icon.strokeWidth} />
                <Text
                  className="ml-2 text-[15px] font-semibold"
                  style={{ color: colors.background }}
                >
                  {messages.workspaceCreateConfirm}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AdaptiveSheetModal>
  );
}
