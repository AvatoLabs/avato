/**
 * ParamsSection — Model parameters (temperature, top_p, etc.) for ChatSettings.
 * Aligns with Web Params/Controls. Saves to session.config (session-only) or agent config.
 */
import { Sliders } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SliderWithInput } from '../../components/ui/SliderWithInput';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

const PARAM_DEFAULTS = {
  frequency_penalty: 0,
  presence_penalty: 0,
  temperature: 0.7,
  top_p: 1,
} as const;

export interface ParamsState {
  frequency_penalty: number;
  presence_penalty: number;
  temperature: number;
  top_p: number;
}

export const DEFAULT_PARAMS: ParamsState = { ...PARAM_DEFAULTS };

export function toParamsState(config: { params?: Record<string, unknown> } | null): ParamsState {
  const p = config?.params;
  return {
    frequency_penalty:
      typeof p?.frequency_penalty === 'number'
        ? p.frequency_penalty
        : PARAM_DEFAULTS.frequency_penalty,
    presence_penalty:
      typeof p?.presence_penalty === 'number'
        ? p.presence_penalty
        : PARAM_DEFAULTS.presence_penalty,
    temperature: typeof p?.temperature === 'number' ? p.temperature : PARAM_DEFAULTS.temperature,
    top_p: typeof p?.top_p === 'number' ? p.top_p : PARAM_DEFAULTS.top_p,
  };
}

export function toParamsPatch(state: ParamsState): Record<string, number> {
  return {
    frequency_penalty: state.frequency_penalty,
    presence_penalty: state.presence_penalty,
    temperature: state.temperature,
    top_p: state.top_p,
  };
}

interface ParamsSectionProps {
  delay?: number;
  onParamsChange: (next: ParamsState) => void;
  params: ParamsState;
}

export function ParamsSection({ delay = 0, params, onParamsChange }: ParamsSectionProps) {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mb-5 px-5">
        <Text className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wider text-secondary/60">
          {t.chatSettingsModelParams}
        </Text>
        <View className="rounded-2xl bg-foreground/[0.02] p-4">
          <View className="mb-4 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
              <Sliders color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <Text className="text-[15px] font-semibold text-foreground">
              {t.chatSettingsModelParams}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
              {t.chatSettingsTemperature}
            </Text>
            <SliderWithInput
              max={2}
              min={0}
              step={0.1}
              value={params.temperature}
              onChange={(v) => onParamsChange({ ...params, temperature: v })}
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
              {t.chatSettingsTopP}
            </Text>
            <SliderWithInput
              max={1}
              min={0}
              step={0.1}
              value={params.top_p}
              onChange={(v) => onParamsChange({ ...params, top_p: v })}
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
              {t.chatSettingsFrequencyPenalty}
            </Text>
            <SliderWithInput
              max={2}
              min={-2}
              step={0.1}
              value={params.frequency_penalty}
              onChange={(v) => onParamsChange({ ...params, frequency_penalty: v })}
            />
          </View>

          <View>
            <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">
              {t.chatSettingsPresencePenalty}
            </Text>
            <SliderWithInput
              max={2}
              min={-2}
              step={0.1}
              value={params.presence_penalty}
              onChange={(v) => onParamsChange({ ...params, presence_penalty: v })}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
