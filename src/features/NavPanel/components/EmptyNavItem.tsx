'use client';

import { Block, Center, Icon, Text } from '@lobehub/ui';
import { cssVar, cx } from 'antd-style';
import { PlusIcon } from 'lucide-react';
import { memo } from 'react';

import { ENTRY_ICON_STROKE } from '@/config/entryIcons';
import { WORKSPACE_NAV_ROW_HEIGHT_PX } from '@/const/workspaceVisualTokens';

import { useGlassNavVisual } from '../GlassNavVisualContext';
import { glassSidebarStyles } from '../glassSidebar.styles';

interface EmptyStatusProps {
  className?: string;
  onClick: () => void;
  title: string;
}

const EmptyNavItem = memo<EmptyStatusProps>(({ title, onClick, className }) => {
  const glass = useGlassNavVisual();

  if (glass) {
    return (
      <Block
        clickable
        horizontal
        align={'center'}
        className={cx(glassSidebarStyles.emptyNavRow, className)}
        gap={10}
        height={WORKSPACE_NAV_ROW_HEIGHT_PX}
        paddingInline={8}
        variant={'borderless'}
        onClick={onClick}
      >
        <div className={glassSidebarStyles.emptyNavIconWell}>
          <Icon
            color={cssVar.colorTextDescription}
            icon={PlusIcon}
            size={{ size: 20, strokeWidth: ENTRY_ICON_STROKE }}
          />
        </div>
        <Text
          ellipsis
          style={{ color: cssVar.colorTextDescription, flex: 1, fontSize: cssVar.fontSizeSM }}
        >
          {title}
        </Text>
      </Block>
    );
  }

  return (
    <Block
      clickable
      horizontal
      align={'center'}
      className={className}
      gap={8}
      height={32}
      paddingInline={2}
      variant={'borderless'}
      onClick={onClick}
    >
      <Center flex={'none'} height={28} width={28}>
        <Icon icon={PlusIcon} size={'small'} />
      </Center>
      <Text align={'center'} type={'secondary'}>
        {title}
      </Text>
    </Block>
  );
});

export default EmptyNavItem;
