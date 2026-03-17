/**
 * SessionHeaderSection — Title and description for ChatSettings.
 */
import { Pencil } from 'lucide-react-native';
import React from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { semanticColors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';

interface SessionHeaderSectionProps {
  delay?: number;
  description?: string;
  isGroupSession: boolean;
  onDescriptionChange?: (value: string) => void;
  onTitleChange: (value: string) => void;
  title: string;
}

export function SessionHeaderSection({
  delay = 50,
  description = '',
  isGroupSession,
  onDescriptionChange,
  onTitleChange,
  title,
}: SessionHeaderSectionProps) {
  const { t } = useI18n();

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mx-5 mb-5 mt-5">
        <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
          {t.chatSettingsTitle}
        </Text>
        <View className="rounded-2xl bg-foreground/[0.02] px-4 py-3">
          <View className="flex-row items-center">
            <View className="flex-1">
              <TextInput
                className="text-[16px] font-semibold tracking-tight text-foreground"
                placeholder={t.chatListNewConversation}
                placeholderTextColor={semanticColors.secondaryText}
                value={title}
                onChangeText={onTitleChange}
              />
            </View>
            <Pencil color={semanticColors.secondaryText} size={14} strokeWidth={1.5} />
          </View>
          {isGroupSession && onDescriptionChange ? (
            <View className="mt-4 border-t border-foreground/5 pt-4">
              <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
                {t.agentConfigDescription}
              </Text>
              <TextInput
                multiline
                className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
                placeholder={t.agentConfigDescriptionPlaceholder}
                placeholderTextColor={semanticColors.secondaryText}
                style={{ minHeight: 88, textAlignVertical: 'top' }}
                value={description}
                onChangeText={onDescriptionChange}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
