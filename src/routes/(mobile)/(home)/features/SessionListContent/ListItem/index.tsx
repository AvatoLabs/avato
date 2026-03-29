import { type ListItemProps } from '@lobehub/ui';
import { Avatar, List } from '@lobehub/ui';
import { useHover } from 'ahooks';
import { createStaticStyles, cx } from 'antd-style';
import { memo, useMemo, useRef } from 'react';

import GroupAvatar from '@/features/GroupAvatar';
import { useServerConfigStore } from '@/store/serverConfig';

const { Item } = List;

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    active: css`
      background: color-mix(in srgb, ${cssVar.colorPrimary} 7%, ${cssVar.colorBgContainer});
      box-shadow: inset 0 0 0 1px color-mix(in srgb, ${cssVar.colorPrimaryBorder} 68%, transparent);
    `,
    container: css`
      position: relative;

      margin-block: 2px;
      padding-block: 6px;
      padding-inline: 12px 16px;
      border-radius: ${cssVar.borderRadius};

      transition:
        background-color 160ms ease,
        transform 160ms ease;

      &:active {
        transform: scale(0.995);
        background: ${cssVar.colorFillTertiary};
      }
    `,
    mobile: css`
      margin-block: 0;
      padding-block: 8px;
      padding-inline-start: 12px;
      border-radius: 14px;
    `,
    title: css`
      font-size: 14px;
      font-weight: 500;
      line-height: 1.25;
      letter-spacing: -0.01em;
    `,
  };
});

const ListItem = memo<
  ListItemProps & {
    avatar: string | { avatar: string; background?: string }[];
    avatarBackground?: string;
    type?: 'agent' | 'group' | 'inbox';
  }
>(({ avatar, avatarBackground, active, showAction, actions, title, type, ...props }) => {
  const ref = useRef(null);
  const isHovering = useHover(ref);
  const mobile = useServerConfigStore((s) => s.isMobile);

  const avatarRender = useMemo(() => {
    if (type === 'group') {
      const avatars = Array.isArray(avatar) ? avatar : [avatar];
      return <GroupAvatar avatars={avatars} size={40} />;
    }

    // For regular sessions, use the regular Avatar component
    return (
      <Avatar animation={isHovering} avatar={avatar} background={avatarBackground} size={40} />
    );
  }, [isHovering, avatar, avatarBackground, type]);

  return (
    <Item
      actions={actions}
      active={mobile ? false : active}
      avatar={avatarRender}
      className={cx(styles.container, mobile && styles.mobile, active && styles.active)}
      ref={ref}
      showAction={actions && (isHovering || showAction || mobile)}
      title={<span className={styles.title}>{title}</span>}
      {...(props as any)}
    />
  );
});

export default ListItem;
