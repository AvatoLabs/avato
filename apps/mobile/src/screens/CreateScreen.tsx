import { Clapperboard, Palette } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SegmentedControl } from '../components/ui/ChoiceControls';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useI18n } from '../lib/i18n';
import ArtworkScreen from './ArtworkScreen';
import VideoScreen from './VideoScreen';

type CreateMode = 'artwork' | 'video';

export default function CreateScreen() {
  const { t } = useI18n();
  const [mode, setMode] = useState<CreateMode>('artwork');

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
      <ScreenHeader headerLevel="root" title={t.tabArtwork}>
        <View className="px-6 pb-2">
          <SegmentedControl items={switcherItems} value={mode} onChange={setMode} />
        </View>
      </ScreenHeader>

      <View className="flex-1">
        {mode === 'artwork' ? <ArtworkScreen hideHeader /> : <VideoScreen hideHeader />}
      </View>
    </View>
  );
}
