'use client';

import { type BlockProps, type GenericItemType, type IconProps } from '@lobehub/ui';
import { Block, Center, ContextMenuTrigger, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type ReactNode } from 'react';
import { memo } from 'react';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { WORKSPACE_NAV_ROW_HEIGHT_PX } from '@/const/workspaceVisualTokens';
import { isModifierClick } from '@/utils/navigation';

import { useGlassNavVisual } from '../GlassNavVisualContext';

const ACTION_CLASS_NAME = 'nav-item-actions';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    user-select: none;

    overflow: hidden;

    min-width: 32px;
    border-radius: ${cssVar.borderRadiusSM};

    transition:
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      transform ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:active {
      transform: scale(0.99);
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }

    .${ACTION_CLASS_NAME} {
      transform: translateX(2px);
      margin-inline-end: 2px;
      opacity: 0.56;
      transition:
        opacity ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
        transform ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};

      &:has([data-popup-open]) {
        transform: translateX(0);
        opacity: 1;
      }
    }

    &:hover,
    &:focus-within {
      .${ACTION_CLASS_NAME} {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `,
  activeRail: css`
    box-shadow: inset 2px 0 0 ${cssVar.colorPrimary};
  `,
  glassIconWell: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 32px;
    height: 32px;
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
  glassRow: css`
    &:hover:not(:active) {
      background: ${cssVar.colorFillQuaternary} !important;
    }
  `,
  glassRowActive: css`
    background: ${cssVar.colorPrimaryBg} !important;
    box-shadow: inset 0 0 0 1px ${cssVar.colorPrimaryBorder};

    &:hover {
      background: ${cssVar.colorPrimaryBgHover} !important;
    }
  `,
}));

export interface NavItemSlots {
  iconPostfix?: ReactNode;
  titlePrefix?: ReactNode;
}

export interface NavItemProps extends Omit<BlockProps, 'children' | 'title'> {
  actions?: ReactNode;
  active?: boolean;
  contextMenuItems?: GenericItemType[] | (() => GenericItemType[]);
  disabled?: boolean;
  extra?: ReactNode;
  /**
   * Optional href for cmd+click to open in new tab
   */
  href?: string;
  icon?: IconProps['icon'];
  iconSize?: number;
  loading?: boolean;
  slots?: NavItemSlots;
  title: ReactNode;
}

const NavItem = memo<NavItemProps>(
  ({
    className,
    actions,
    contextMenuItems,
    active,
    href,
    icon,
    iconSize: iconSizeProp,
    title,
    onClick,
    disabled,
    loading,
    extra,
    slots,
    ...rest
  }) => {
    const glass = useGlassNavVisual();
    const iconSize = iconSizeProp ?? (glass ? 20 : 18);
    const iconColor = glass
      ? active
        ? cssVar.colorPrimary
        : cssVar.colorTextDescription
      : active
        ? cssVar.colorText
        : cssVar.colorTextSecondary;
    const textColor = glass
      ? active
        ? cssVar.colorPrimary
        : cssVar.colorTextDescription
      : active
        ? cssVar.colorText
        : cssVar.colorTextSecondary;
    const variant = glass ? 'borderless' : active ? 'filled' : 'borderless';

    const { titlePrefix, iconPostfix } = slots || {};
    // Link props for cmd+click support
    const linkProps = href
      ? {
          as: 'a' as const,
          href,
          style: { color: 'inherit', textDecoration: 'none' },
        }
      : {};

    const Content = (
      <Block
        horizontal
        align={'center'}
        clickable={!disabled}
        gap={10}
        height={WORKSPACE_NAV_ROW_HEIGHT_PX}
        paddingInline={8}
        variant={variant}
        onClick={(e) => {
          if (disabled || loading) return;
          // Prevent default link behavior for normal clicks (let onClick handle it)
          // But allow cmd+click to open in new tab
          if (href && !isModifierClick(e)) {
            e.preventDefault();
          }
          onClick?.(e);
        }}
        {...linkProps}
        {...rest}
        className={cx(
          styles.container,
          !glass && active && styles.activeRail,
          glass && styles.glassRow,
          glass && active && styles.glassRowActive,
          className,
        )}
      >
        {icon &&
          (glass ? (
            <div className={styles.glassIconWell}>
              {loading ? (
                <NeuralNetworkLoading size={iconSize} />
              ) : (
                <Icon color={iconColor} icon={icon} size={iconSize} />
              )}
            </div>
          ) : (
            <Center flex={'none'} height={30} width={30}>
              {loading ? (
                <NeuralNetworkLoading size={iconSize} />
              ) : (
                <Icon color={iconColor} icon={icon} size={iconSize} />
              )}
            </Center>
          ))}

        {iconPostfix}
        <Flexbox horizontal align={'center'} flex={1} gap={8} style={{ overflow: 'hidden' }}>
          {titlePrefix}
          <Text
            color={textColor}
            style={{ flex: 1, ...(glass ? { fontSize: cssVar.fontSizeSM } : undefined) }}
            ellipsis={{
              tooltipWhenOverflow: true,
            }}
          >
            {title}
          </Text>
          <Flexbox
            horizontal
            align={'center'}
            gap={2}
            justify={'flex-end'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {extra}
            {actions && (
              <Flexbox
                horizontal
                align={'center'}
                className={ACTION_CLASS_NAME}
                gap={2}
                justify={'flex-end'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {actions}
              </Flexbox>
            )}
          </Flexbox>
        </Flexbox>
      </Block>
    );
    if (!contextMenuItems) return Content;
    return <ContextMenuTrigger items={contextMenuItems}>{Content}</ContextMenuTrigger>;
  },
);

export default NavItem;
