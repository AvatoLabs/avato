import { type FlexboxProps, type IconProps } from '@lobehub/ui';
import { Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type ReactNode } from 'react';
import { memo, Suspense, useState } from 'react';

interface GroupBlockProps extends Omit<FlexboxProps, 'title'> {
  action?: ReactNode;
  actionAlwaysVisible?: boolean;
  icon?: IconProps['icon'];
  title?: ReactNode;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  action: css`
    transform: translateY(0);
    opacity: 0.7;
    transition:
      opacity ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      transform ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    @media (hover: none) {
      opacity: 1;
    }
  `,
  actionVisible: css`
    transform: translateY(-1px);
    opacity: 1;
  `,
}));

const GroupBlock = memo<GroupBlockProps>(
  ({ title, action, actionAlwaysVisible, children, icon, ...rest }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <Flexbox
        gap={14}
        onBlur={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...rest}
      >
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Flexbox
            horizontal
            align={'center'}
            flex={1}
            gap={10}
            justify={'flex-start'}
            style={{ overflow: 'hidden' }}
          >
            <Icon color={cssVar.colorTextDescription} icon={icon} size={16} />
            <Text ellipsis fontSize={13} style={{ letterSpacing: '0.02em' }} weight={600}>
              {title}
            </Text>
          </Flexbox>
          <Flexbox
            horizontal
            align={'center'}
            flex={'none'}
            gap={2}
            justify={'flex-end'}
            className={cx(
              styles.action,
              (isHovered || actionAlwaysVisible) && styles.actionVisible,
            )}
          >
            {action}
          </Flexbox>
        </Flexbox>
        <Suspense fallback={'loading'}>{children}</Suspense>
      </Flexbox>
    );
  },
);

export default GroupBlock;
