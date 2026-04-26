import { Avatar, Block, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { DEFAULT_AVATAR } from '@/const/meta';
import { RECENT_BLOCK_SIZE } from '@/routes/(main)/home/features/const';

interface ItemProps {
  author?: string;
  avatar?: string;
  backgroundColor?: string;
  description?: string;
  title?: string;
}

const Item = memo<ItemProps>(({ title, avatar, backgroundColor, author, description }) => {
  return (
    <Block
      clickable
      flex={'none'}
      height={RECENT_BLOCK_SIZE.AGENT.HEIGHT}
      justify={'space-between'}
      variant={'filled'}
      width={RECENT_BLOCK_SIZE.AGENT.WIDTH}
      style={{
        backgroundColor: cssVar.colorFillQuaternary,
        border: `1px solid ${cssVar.colorBorderSecondary}`,
        borderRadius: cssVar.borderRadiusLG,
        overflow: 'hidden',
      }}
    >
      <Block
        flex={1}
        padding={12}
        variant={'outlined'}
        style={{
          background: `color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorFillTertiary} 8%)`,
          borderRadius: cssVar.borderRadiusLG,
          boxShadow: `inset 0 0 0 1px ${cssVar.colorBorderSecondary}`,
          overflow: 'hidden',
        }}
      >
        <Text color={cssVar.colorTextSecondary} ellipsis={{ rows: 3 }} fontSize={13}>
          {description}
        </Text>
      </Block>
      <Flexbox horizontal align={'center'} gap={8} paddingBlock={8} paddingInline={12}>
        <Flexbox
          flex={1}
          gap={1}
          style={{
            overflow: 'hidden',
          }}
        >
          <Text ellipsis fontSize={13} weight={500}>
            {title}
          </Text>
          <Text ellipsis fontSize={12} type={'secondary'}>
            {author}
          </Text>
        </Flexbox>
        <Avatar
          emojiScaleWithBackground
          avatar={avatar || DEFAULT_AVATAR}
          background={backgroundColor || undefined}
          shape={'square'}
          size={30}
          style={{
            flex: 'none',
          }}
        />
      </Flexbox>
    </Block>
  );
});

export default Item;
