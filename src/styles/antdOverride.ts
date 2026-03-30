import { isDesktop } from '@lobechat/const';
import { type Theme } from 'antd-style';
import { css } from 'antd-style';
import { rgba } from 'polished';

const PRESET_BUTTON_COLORS = [
  'red',
  'orange',
  'gold',
  'yellow',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
  'magenta',
  'volcano',
] as const;

const getSolidButtonColorOverride = (prefixCls: string, colorKey: string, foreground: string) => {
  return css`
    .${prefixCls}-btn.${prefixCls}-btn-variant-solid.${prefixCls}-btn-color-${colorKey}:not(
      :disabled
    ):not(.${prefixCls}-btn-disabled) {
      color: ${foreground} !important;
    }

    .${prefixCls}-btn.${prefixCls}-btn-variant-solid.${prefixCls}-btn-color-${colorKey}:not(
      :disabled
    ):not(.${prefixCls}-btn-disabled)
      .${prefixCls}icon,
      .${prefixCls}-btn.${prefixCls}-btn-variant-solid.${prefixCls}-btn-color-${colorKey}:not(
      :disabled
    ):not(.${prefixCls}-btn-disabled)
      svg {
      color: ${foreground} !important;
    }
  `;
};

const antdOverride = ({ token }: { prefixCls: string; token: Theme }) => {
  const presetSolidButtonOverrides = PRESET_BUTTON_COLORS.map((colorKey) =>
    getSolidButtonColorOverride(token.prefixCls, colorKey, '#fff'),
  ).join('\n');

  return css`
    ${getSolidButtonColorOverride(token.prefixCls, 'primary', token.colorTextLightSolid)}
    ${getSolidButtonColorOverride(token.prefixCls, 'dangerous', '#fff')}
  ${presetSolidButtonOverrides}

  .${token.prefixCls}-popover {
      z-index: 1100;
    }

    .${token.prefixCls}-menu-item-selected {
      .${token.prefixCls}-menu-title-content {
        color: ${token.colorText};
      }
    }

    .${token.prefixCls}-modal-mask, .${token.prefixCls}-drawer-mask {
      background: ${rgba(token.colorBgLayout, 0.5)} !important;
      backdrop-filter: blur(2px);
    }

    ${isDesktop &&
    css`
      .${token.prefixCls}-modal-mask.${token.prefixCls}-modal-mask-blur {
        background: ${rgba(token.colorBgLayout, 0.8)} !important;
        backdrop-filter: none !important;
      }
    `}
  `;
};

export default antdOverride;
