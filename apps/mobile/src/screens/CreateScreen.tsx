import { Clapperboard, Palette, Settings2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SegmentedControl } from '../components/ui/ChoiceControls';
import { HeaderIconButton, ScreenHeader } from '../components/ui/ScreenHeader';
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
  const [configOpenVersion, setConfigOpenVersion] = useState(0);

  const switcherItems = useMemo(
    () => [
      {
        icon: Palette,
        label: t.artworkTitle,
        value: 'artwork' as const,
      },
      {
        icon: Clapperboard,
        label: t.videoTitle,
        value: 'video' as const,
      },
    ],
    [t.artworkTitle, t.videoTitle],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        headerLevel="root"
        title={t.tabArtwork}
        rightActions={
          <HeaderIconButton
            accessibilityLabel={t.settingsTitle ?? 'Settings'}
            onPress={() => setConfigOpenVersion((value) => value + 1)}
          >
            <Settings2 color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          </HeaderIconButton>
        }
      >
        <View className="px-6 pb-2">
          <SegmentedControl items={switcherItems} value={mode} onChange={setMode} />
        </View>
      </ScreenHeader>

      <View className="flex-1">
        {mode === 'artwork' ? (
          <ArtworkScreen hideHeader configOpenVersion={configOpenVersion} />
        ) : (
          <VideoScreen hideHeader configOpenVersion={configOpenVersion} />
        )}
      </View>
    </View>
  );
}
