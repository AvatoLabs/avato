'use client';

import { type BlockProps, type GenericItemType, type IconProps } from '@lobehub/ui';
import { Block, Center, ContextMenuTrigger, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type ReactNode } from 'react';
import { memo } from 'react';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { ENTRY_ICON_STROKE } from '@/config/entryIcons';
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

    /** 未选中：hover 次级高亮（同色带，亮度低于选中底） */
    &:not([data-selected='true'], [data-disabled='true']):hover:not(:active) {
      background: color-mix(in srgb, ${cssVar.colorText} 12%, transparent) !important;

      [data-glass-icon-well] {
        transform: scale(1.04);
        background: color-mix(in srgb, ${cssVar.colorText} 17%, transparent) !important;
      }
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
  /**
   * Selected row: neutral pill — 正式、克制，避免主题色描边/侧条带来的「霓虹」感。
   */
  chatgptSelected: css`
    margin-inline: 8px;
    border-radius: ${cssVar.borderRadiusLG};

    background: color-mix(in srgb, ${cssVar.colorText} 14%, transparent) !important;
    box-shadow: inset 0 0 0 1px ${cssVar.colorBorderSecondary};

    transition:
      background-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      transform ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorText} 18%, transparent) !important;
      box-shadow: inset 0 0 0 1px ${cssVar.colorBorder};
    }
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

    transition:
      background-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      transform ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};
  `,
  /** 选中时去掉 icon 井字底，避免「大灰底套小灰底」 */
  glassIconWellSelected: css`
    background: transparent !important;
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
    const iconSizeForLobeIcon = { size: iconSize, strokeWidth: ENTRY_ICON_STROKE };
    const labelColor = cssVar.colorText;
    const variant = 'borderless';

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
        data-disabled={disabled || loading ? 'true' : undefined}
        data-selected={active ? 'true' : undefined}
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
        className={cx(styles.container, active && styles.chatgptSelected, className)}
      >
        {icon &&
          (glass ? (
            <div
              className={cx(styles.glassIconWell, active && styles.glassIconWellSelected)}
              data-glass-icon-well=""
            >
              {loading ? (
                <NeuralNetworkLoading size={iconSize} />
              ) : (
                <Icon color={labelColor} icon={icon} size={iconSizeForLobeIcon} />
              )}
            </div>
          ) : (
            <Center flex={'none'} height={30} width={30}>
              {loading ? (
                <NeuralNetworkLoading size={iconSize} />
              ) : (
                <Icon color={labelColor} icon={icon} size={iconSizeForLobeIcon} />
              )}
            </Center>
          ))}

        {iconPostfix}
        <Flexbox horizontal align={'center'} flex={1} gap={8} style={{ overflow: 'hidden' }}>
          {titlePrefix}
          <Text
            color={labelColor}
            ellipsis={{
              tooltipWhenOverflow: true,
            }}
            style={{
              flex: 1,
              fontSize: cssVar.fontSize,
              fontWeight: active ? 450 : 400,
              lineHeight: 1.3,
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
