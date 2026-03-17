import { BrainCircuit, CircleOff } from 'lucide-react-native';
import React, { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { semanticColors } from '../../constants/colors';
import { haptics } from '../../lib/haptics';
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
    return (
      <Pressable
        className={`flex-row items-start px-3.5 py-3 ${
          !isLast ? 'mb-px' : ''
        } ${active ? 'bg-primary/5' : ''}`}
        onPress={onPress}
      >
        <View className="w-9 h-9 rounded-xl bg-foreground/[0.04] items-center justify-center mr-3">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-[17px] font-semibold tracking-tight">{title}</Text>
          <Text className="text-secondary/60 text-[13px] leading-5 mt-1">{description}</Text>
        </View>
      </Pressable>
    );
  },
);

ToggleOption.displayName = 'ToggleOption';

const MemoryToolSheet = memo<MemoryToolSheetProps>(
  ({ visible, enabled, effort, onClose, onChangeEnabled, onChangeEffort }) => {
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
              <View className="bg-foreground/5 rounded-2xl overflow-hidden">
                <ToggleOption
                  active={!enabled}
                  description={t.memoryToolOffDesc}
                  icon={
                    <CircleOff
                      color={semanticColors.foreground}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  }
                  title={t.memoryToolOffTitle}
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
                      color={semanticColors.foreground}
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
                <View className="mt-3 bg-foreground/5 rounded-2xl p-3.5">
                  <Text className="text-foreground text-[17px] font-semibold tracking-tight">
                    {t.memoryToolEffortTitle}
                  </Text>
                  <Text className="text-secondary/60 text-[13px] leading-5 mt-1">
                    {t.memoryToolEffortDesc}
                  </Text>

                  <View className="flex-row mt-3 gap-2">
                    {effortOptions.map((item) => {
                      const active = effort === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          className={`flex-1 items-center py-2.5 rounded-xl ${
                            active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                          }`}
                          onPress={() => {
                            haptics.selection();
                            onChangeEffort(item.value);
                          }}
                        >
                          <Text
                            className={`text-[15px] font-medium ${
                              active ? 'text-primary' : 'text-secondary/70'
                            }`}
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
