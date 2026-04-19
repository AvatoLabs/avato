import React, { useMemo } from 'react';
import { View } from 'react-native';

import { buildFileGovernanceBadges } from '../../lib/fileGovernance';
import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import type { FileListItem } from '../../types';
import { MetaTag } from './ChoiceControls';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

interface ResourceGovernanceBadgesProps {
  item: FileListItem;
  maxVisible?: number;
}

export default function ResourceGovernanceBadges({
  item,
  maxVisible = 3,
}: ResourceGovernanceBadgesProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const badges = useMemo(
    () => buildFileGovernanceBadges(item, t, maxVisible),
    [item, maxVisible, t],
  );

  if (isFolder(item) || badges.length === 0) return null;

  return (
    <View className="mt-1 flex-row flex-wrap">
      {badges.map((badge) => (
        <View className="mr-1.5 mt-1" key={badge.key}>
          <MetaTag
            backgroundColor={badge.emphasis === 'warning' ? colors.warningSubtle : undefined}
            label={badge.label}
            textColor={badge.emphasis === 'warning' ? colors.fileArchive : undefined}
            tone={
              badge.emphasis === 'warning'
                ? 'neutral'
                : badge.emphasis === 'accent'
                  ? 'accent'
                  : badge.emphasis === 'success'
                    ? 'success'
                    : 'neutral'
            }
          />
        </View>
      ))}
    </View>
  );
}
