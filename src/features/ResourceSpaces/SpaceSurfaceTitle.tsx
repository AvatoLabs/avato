'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { memo, type ReactNode } from 'react';

import { useSpaceName } from './useSpaceName';

interface SpaceSurfaceTitleProps {
  fallbackSpaceLabel?: ReactNode;
  spaceId?: string | null;
  surfaceLabel: ReactNode;
}

const SpaceSurfaceTitle = memo<SpaceSurfaceTitleProps>(
  ({ fallbackSpaceLabel, spaceId, surfaceLabel }) => {
    const spaceName = useSpaceName(spaceId);
    const resolvedSpaceLabel = spaceName || fallbackSpaceLabel;

    if (!resolvedSpaceLabel) {
      return (
        <Text ellipsis fontSize={16} weight={500}>
          {surfaceLabel}
        </Text>
      );
    }

    return (
      <Flexbox horizontal align={'center'} gap={6} style={{ minWidth: 0 }}>
        <Text ellipsis fontSize={16} style={{ minWidth: 0 }} weight={500}>
          {resolvedSpaceLabel}
        </Text>
        <Text fontSize={14} type={'secondary'}>
          /
        </Text>
        <Text ellipsis fontSize={16} style={{ minWidth: 0 }} type={'secondary'} weight={500}>
          {surfaceLabel}
        </Text>
      </Flexbox>
    );
  },
);

SpaceSurfaceTitle.displayName = 'SpaceSurfaceTitle';

export default SpaceSurfaceTitle;
