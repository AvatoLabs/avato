/**
 * ModelCard — Compact card for model browsing.
 */
import { Brain } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';
import type { DiscoverModel } from '../../types';
import PressableScale from './PressableScale';

interface ModelCardProps {
  model: DiscoverModel;
  onPress?: () => void;
}

const ModelCard = memo<ModelCardProps>(({ model, onPress }) => {
  const { t } = useI18n();
  return (
    <PressableScale
      className="flex-row items-center px-4 py-3.5 rounded-xl mx-3 mb-1"
      onPress={onPress}
    >
      <View className="w-9 h-9 rounded-full bg-blue-500/10 items-center justify-center mr-3">
        <Brain color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[15px] font-medium tracking-tight" numberOfLines={1}>
          {model.displayName}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-secondary/50 text-[12px] font-medium">
            {model.providerName || model.providerId}
          </Text>
          {model.vision && (
            <View className="ml-2 bg-green-500/10 rounded px-1.5 py-0.5">
              <Text className="text-green-600 text-[9px] font-medium">{t.badgeVision}</Text>
            </View>
          )}
          {model.functionCall && (
            <View className="ml-1 bg-purple-500/10 rounded px-1.5 py-0.5">
              <Text className="text-purple-600 text-[9px] font-medium">{t.badgeTools}</Text>
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

ModelCard.displayName = 'ModelCard';

export default ModelCard;
