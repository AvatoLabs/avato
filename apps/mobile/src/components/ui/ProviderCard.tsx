/**
 * ProviderCard — Card for provider browsing.
 */
import { Server } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';
import type { AiProviderListItem } from '../../types';
import PressableScale from './PressableScale';

interface ProviderCardProps {
  onPress?: () => void;
  provider: AiProviderListItem;
}

const ProviderCard = memo<ProviderCardProps>(({ provider, onPress }) => {
  const { t } = useI18n();
  return (
    <PressableScale
      className="flex-row items-center px-4 py-3.5 rounded-xl mx-3 mb-1"
      onPress={onPress}
    >
      <View className="w-9 h-9 rounded-full bg-green-500/10 items-center justify-center mr-3">
        <Server color="#4caf50" size={18} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[15px] font-medium tracking-tight" numberOfLines={1}>
          {provider.name}
        </Text>
        <Text className="text-secondary/50 text-[12px] font-medium mt-0.5" numberOfLines={1}>
          {provider.description || provider.source}
        </Text>
      </View>
      <View
        className={`px-2 py-1 rounded-lg ${provider.enabled ? 'bg-green-500/10' : 'bg-foreground/5'}`}
      >
        <Text
          className={`text-[11px] font-medium ${provider.enabled ? 'text-green-600' : 'text-secondary/50'}`}
        >
          {provider.enabled ? t.statusActive : t.statusInactive}
        </Text>
      </View>
    </PressableScale>
  );
});

ProviderCard.displayName = 'ProviderCard';

export default ProviderCard;
