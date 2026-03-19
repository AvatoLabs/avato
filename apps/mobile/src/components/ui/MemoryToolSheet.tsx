import { BrainCircuit, CircleOff } from 'lucide-react-native';
import React, { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme/colors';
import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';
import type { MobileMemoryEffort } from '../../types';

interface MemoryToolSheetProps {
  effort: MobileMemoryEffort;
  enabled: boolean;
  onChangeEffort: (effort: MobileMemoryEffort) => void;
  onChangeEnabled: (enabled: boolean) => void;
  onClose: () => void;
  visible: boolean;
}

interface ToggleOptionProps {
  active: boolean;
  description: string;
  icon: React.ReactNode;
  isLast?: boolean;
  onPress: () => void;
  title: string;
}

const ToggleOption = memo<ToggleOptionProps>(
  ({ active, description, icon, isLast, title, onPress }) => {
    const colors = useThemeColors();
    return (
      <Pressable
        className={`flex-row items-start px-3.5 py-3 ${!isLast ? 'mb-px' : ''}`}
        style={active ? { backgroundColor: colors.primarySubtle } : undefined}
        onPress={onPress}
      >
        <View className="w-9 h-9 rounded-xl bg-foreground/[0.04] items-center justify-center mr-3">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-[17px] font-semibold tracking-tight">{title}</Text>
          <Text className="text-[13px] leading-5 mt-1" style={{ color: colors.secondaryText }}>
            {description}
          </Text>
        </View>
      </Pressable>
    );
  },
);

ToggleOption.displayName = 'ToggleOption';

const MemoryToolSheet = memo<MemoryToolSheetProps>(
  ({ visible, enabled, effort, onClose, onChangeEnabled, onChangeEffort }) => {
    const colors = useThemeColors();
    const { t } = useI18n();

    const effortOptions: Array<{ label: string; value: MobileMemoryEffort }> = [
      { label: t.memoryToolEffortLow, value: 'low' },
      { label: t.memoryToolEffortMedium, value: 'medium' },
      { label: t.memoryToolEffortHigh, value: 'high' },
    ];

    return (
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={visible}
        onRequestClose={onClose}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="bg-card rounded-t-2xl"
            style={{ maxHeight: '72%' }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>

            <View className="px-5 pb-6 pt-2">
              <View className="bg-foreground/5 rounded-xl overflow-hidden">
                <ToggleOption
                  active={!enabled}
                  description={t.memoryToolOffDesc}
                  title={t.memoryToolOffTitle}
                  icon={
                    <CircleOff
                      color={colors.foreground}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  }
                  onPress={() => {
                    haptics.light();
                    onChangeEnabled(false);
                  }}
                />

                <ToggleOption
                  isLast
                  active={enabled}
                  description={t.memoryToolOnDesc}
                  title={t.memoryToolOnTitle}
                  icon={
                    <BrainCircuit
                      color={colors.foreground}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  }
                  onPress={() => {
                    haptics.light();
                    onChangeEnabled(true);
                  }}
                />
              </View>

              {enabled && (
                <View className="mt-3 bg-foreground/5 rounded-xl p-3.5">
                  <Text className="text-foreground text-[17px] font-semibold tracking-tight">
                    {t.memoryToolEffortTitle}
                  </Text>
                  <Text className="text-[13px] leading-5 mt-1" style={{ color: colors.secondaryText }}>
                    {t.memoryToolEffortDesc}
                  </Text>

                  <View className="flex-row mt-3 gap-2">
                    {effortOptions.map((item) => {
                      const active = effort === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          className="flex-1 items-center py-2.5 rounded-xl"
                          style={{ backgroundColor: active ? colors.primarySubtle : colors.fillTertiary }}
                          onPress={() => {
                            haptics.selection();
                            onChangeEffort(item.value);
                          }}
                        >
                          <Text
                            className="text-[15px] font-medium"
                            style={{ color: active ? colors.primary : colors.secondaryText }}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);

MemoryToolSheet.displayName = 'MemoryToolSheet';

export default MemoryToolSheet;
