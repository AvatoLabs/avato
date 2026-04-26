import { Block, Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { AtomIcon } from 'lucide-react';
import { memo } from 'react';

import BubblesLoading from '@/components/BubblesLoading';

interface StatusIndicatorProps {
  showDetail?: boolean;
  thinking?: boolean;
}

const StatusIndicator = memo<StatusIndicatorProps>(({ thinking, showDetail }) => {
  let icon;

  if (thinking) {
    icon = <BubblesLoading size={4} />;
  } else {
    icon = <Icon color={showDetail ? cssVar.gold : cssVar.colorTextDescription} icon={AtomIcon} />;
  }

  return (
    <Block
      horizontal
      align={'center'}
      flex={'none'}
      gap={4}
      height={24}
      justify={'center'}
      variant={'outlined'}
      width={24}
      style={{
        color: cssVar.colorTextDescription,
        fontSize: 12,
      }}
    >
      {icon}
    </Block>
  );
});

export default StatusIndicator;
