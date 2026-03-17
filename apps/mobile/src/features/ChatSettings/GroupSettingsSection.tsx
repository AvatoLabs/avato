/**
 * GroupSettingsSection — Group chat settings (allow DM, reveal DM, system prompt, etc.).
 */
import React from 'react';
import { ActivityIndicator, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { semanticColors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { themeColors } from '../../theme/colors';

function SectionCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View className="mx-5 mb-5">
      <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
        {title}
      </Text>
      <View className="rounded-2xl bg-foreground/[0.02] p-4">{children}</View>
    </View>
  );
}

function Field({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View className="mb-3 last:mb-0">
      <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">{label}</Text>
      <TextInput
        className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={semanticColors.secondaryText}
        style={multiline ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function ToggleRowSwitch({
  description,
  label,
  onValueChange,
  value,
}: {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View className="mb-3 flex-row items-center rounded-2xl bg-foreground/[0.04] px-4 py-3 last:mb-0">
      <View className="flex-1 pr-4">
        <Text className="text-[14px] font-semibold text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">{description}</Text>
        ) : null}
      </View>
      <Switch
        trackColor={{
          false: themeColors.switchTrackOffAlt,
          true: `${themeColors.switchTrackOn}66`,
        }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

interface GroupSettingsSectionProps {
  allowDM: boolean;
  config: {
    openingMessage: string;
    openingQuestions: string;
    systemPrompt: string;
  };
  delay?: number;
  loading: boolean;
  onAllowDMChange: (v: boolean) => void;
  onOpeningMessageChange: (v: string) => void;
  onOpeningQuestionsChange: (v: string) => void;
  onRevealDMChange: (v: boolean) => void;
  onSystemPromptChange: (v: string) => void;
  revealDM: boolean;
}

export function GroupSettingsSection({
  allowDM,
  config,
  delay = 100,
  loading,
  onAllowDMChange,
  onOpeningMessageChange,
  onOpeningQuestionsChange,
  onRevealDMChange,
  onSystemPromptChange,
  revealDM,
}: GroupSettingsSectionProps) {
  const { t } = useI18n();

  return (
    <>
      <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
        <SectionCard title={t.chatSettingsGroup}>
          {loading ? (
            <View className="items-center justify-center py-6">
              <ActivityIndicator color={semanticColors.primary} />
            </View>
          ) : (
            <>
              <ToggleRowSwitch
                description={t.groupSettingsAllowDMDesc}
                label={t.groupSettingsAllowDM}
                value={allowDM}
                onValueChange={onAllowDMChange}
              />
              <ToggleRowSwitch
                description={t.groupSettingsRevealDMDesc}
                label={t.groupSettingsRevealDM}
                value={revealDM}
                onValueChange={onRevealDMChange}
              />
            </>
          )}
        </SectionCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(300)}>
        <SectionCard title={t.chatSettingsSystemPrompt}>
          {loading ? (
            <View className="items-center justify-center py-6">
              <ActivityIndicator color={semanticColors.primary} />
            </View>
          ) : (
            <Field
              multiline
              label={t.chatSettingsSystemPrompt}
              placeholder={t.chatSettingsSystemPromptPlaceholder}
              value={config.systemPrompt}
              onChangeText={onSystemPromptChange}
            />
          )}
        </SectionCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(300)}>
        <SectionCard title={t.agentConfigOpening}>
          {loading ? (
            <View className="items-center justify-center py-6">
              <ActivityIndicator color={semanticColors.primary} />
            </View>
          ) : (
            <>
              <Field
                multiline
                label={t.agentConfigOpeningMessage}
                value={config.openingMessage}
                onChangeText={onOpeningMessageChange}
              />
              <Field
                multiline
                label={t.agentConfigOpeningQuestions}
                placeholder={t.agentConfigOpeningQuestionsPlaceholder}
                value={config.openingQuestions}
                onChangeText={onOpeningQuestionsChange}
              />
            </>
          )}
        </SectionCard>
      </Animated.View>
    </>
  );
}
