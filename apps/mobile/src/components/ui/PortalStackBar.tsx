import { ChevronRight } from 'lucide-react-native';
import React, { memo, useCallback, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { navigateToPortalEntry } from '../../lib/navigation';
import { getPortalTrail } from '../../lib/portalNavigation';
import type { PortalStackEntry } from '../../navigation/types';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface PortalStackBarProps {
  currentLabel?: string;
  routeName: string;
  routeParams: unknown;
}

const getPortalEntryLabel = (
  entry: PortalStackEntry,
  labels: {
    messageDetailTitle: string;
    notebookTitle: string;
    resourceTitle: string;
    threadDetailTitle: string;
    threadListTitle: string;
    toolDetailTitle: string;
  },
  isCurrent: boolean,
  currentLabel?: string,
) => {
  switch (entry.route) {
    case 'MessageDetail': {
      return (
        (isCurrent ? currentLabel?.trim() : undefined) ||
        entry.params.title?.trim() ||
        labels.messageDetailTitle
      );
    }
    case 'Notebook': {
      return (isCurrent ? currentLabel?.trim() : undefined) || labels.notebookTitle;
    }
    case 'Resources': {
      return (
        entry.params.openItem?.name ||
        entry.params.openItemId ||
        (isCurrent ? currentLabel?.trim() : undefined) ||
        labels.resourceTitle
      );
    }
    case 'ThreadDetail': {
      return (
        (isCurrent ? currentLabel?.trim() : undefined) ||
        entry.params.title?.trim() ||
        labels.threadDetailTitle
      );
    }
    case 'ThreadList': {
      return (isCurrent ? currentLabel?.trim() : undefined) || labels.threadListTitle;
    }
    case 'ToolDetail': {
      return (
        (isCurrent ? currentLabel?.trim() : undefined) ||
        entry.params.title?.trim() ||
        labels.toolDetailTitle
      );
    }
    default: {
      return (isCurrent ? currentLabel?.trim() : undefined) || '';
    }
  }
};

const PortalStackBar = memo<PortalStackBarProps>(({ currentLabel, routeName, routeParams }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const trail = useMemo(() => getPortalTrail(routeName, routeParams), [routeName, routeParams]);

  const labels = useMemo(
    () => ({
      messageDetailTitle: t.messageDetailTitle,
      notebookTitle: t.notebookTitle,
      resourceTitle: t.resourceTitle,
      threadDetailTitle: t.threadDetailTitle,
      threadListTitle: t.threadListTitle,
      toolDetailTitle: t.toolDetailTitle,
    }),
    [
      t.messageDetailTitle,
      t.notebookTitle,
      t.resourceTitle,
      t.threadDetailTitle,
      t.threadListTitle,
      t.toolDetailTitle,
    ],
  );

  const handleJump = useCallback(
    (entry: PortalStackEntry, index: number) => {
      navigateToPortalEntry(entry, trail.slice(0, index));
    },
    [trail],
  );

  if (trail.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      className="px-4 pb-2"
      contentContainerStyle={{ alignItems: 'center', gap: 6 }}
      showsHorizontalScrollIndicator={false}
    >
      {trail.map((entry, index) => {
        const isCurrent = index === trail.length - 1;
        const label = getPortalEntryLabel(entry, labels, isCurrent, currentLabel);

        if (!label) return null;

        return (
          <View className="flex-row items-center" key={`${entry.route}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                color={colors.tertiaryText}
                size={12}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ) : null}
            {isCurrent ? (
              <View
                className="ml-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: colors.primarySubtle }}
              >
                <Text
                  className="text-[11px] font-semibold"
                  numberOfLines={1}
                  style={{ color: colors.primary, maxWidth: 180 }}
                >
                  {label}
                </Text>
              </View>
            ) : (
              <PressableScale
                className="ml-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={() => handleJump(entry, index)}
              >
                <Text
                  className="text-[11px] font-medium"
                  numberOfLines={1}
                  style={{ color: colors.secondaryText, maxWidth: 160 }}
                >
                  {label}
                </Text>
              </PressableScale>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
});

PortalStackBar.displayName = 'PortalStackBar';

export default PortalStackBar;
