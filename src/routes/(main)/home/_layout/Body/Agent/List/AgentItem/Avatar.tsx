import { DEFAULT_AVATAR, normalizeBuiltinAvatar } from '@lobechat/const';
import { Avatar } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

interface AgentAvatarProps {
  avatar?: string;
}

/** Sidebar uses neutral fill so list rows stay visually consistent (no per-agent accent colors). */
const AgentAvatar = memo<AgentAvatarProps>(({ avatar }) => {
  return (
    <Avatar
      emojiScaleWithBackground
      avatar={normalizeBuiltinAvatar(avatar) || DEFAULT_AVATAR}
      background={cssVar.colorFillQuaternary}
      shape={'square'}
      size={22}
    />
  );
});

export default AgentAvatar;
