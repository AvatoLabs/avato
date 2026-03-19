import { Clapperboard, Palette } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import ArtworkScreen from './ArtworkScreen';
import VideoScreen from './VideoScreen';

type CreateMode = 'artwork' | 'video';

export default function CreateScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [mode, setMode] = useState<CreateMode>('artwork');

  const switcherItems = useMemo(
    () => [
      {
        icon: Palette,
        key: 'artwork' as const,
        label: t.artworkTitle,
      },
      {
        icon: Clapperboard,
        key: 'video' as const,
        label: t.videoTitle,
      },
    ],
    [t.artworkTitle, t.videoTitle],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.tabArtwork}
        titleNode={
          <View
            className="self-start rounded-full p-1"
            style={{ backgroundColor: colors.fillTertiary }}
          >
            <View className="flex-row items-center">
              {switcherItems.map((item) => {
                const active = mode === item.key;
                const Icon = item.icon;

                return (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    className="flex-row items-center rounded-full px-3 py-2"
                    key={item.key}
                    style={{ backgroundColor: active ? colors.primary : 'transparent' }}
                    onPress={() => {
                      if (active) return;
                      haptics.selection();
                      setMode(item.key);
                    }}
                  >
                    <Icon
                      color={active ? colors.iconOnPrimary : colors.secondaryText}
                      size={15}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                    <Text
                      className="ml-1.5 text-[14px] font-semibold"
                      style={{ color: active ? colors.iconOnPrimary : colors.foreground }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
      />

      <View className="flex-1">
        {mode === 'artwork' ? <ArtworkScreen hideHeader /> : <VideoScreen hideHeader />}
      </View>
    </View>
  );
}
