import { isDesktop } from '@lobechat/const';
import { type Theme } from 'antd-style';
import { css } from 'antd-style';
import { rgba } from 'polished';

import { getContrastingTextColor } from '../utils/contrast';

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

const getSolidButtonColorOverride = (prefixCls: string, colorKey: string, background: string) => {
  const solidTextColor = getContrastingTextColor(background);

  return css`
    .${prefixCls}-btn.${prefixCls}-btn-variant-solid.${prefixCls}-btn-color-${colorKey}:not(
      :disabled
    ):not(.${prefixCls}-btn-disabled) {
      color: ${solidTextColor} !important;
    }

    .${prefixCls}-btn.${prefixCls}-btn-variant-solid.${prefixCls}-btn-color-${colorKey}:not(
      :disabled
    ):not(.${prefixCls}-btn-disabled)
      .${prefixCls}icon,
      .${prefixCls}-btn.${prefixCls}-btn-variant-solid.${prefixCls}-btn-color-${colorKey}:not(
      :disabled
    ):not(.${prefixCls}-btn-disabled)
      svg {
      color: ${solidTextColor} !important;
    }
  `;
};

const antdOverride = ({ token }: { prefixCls: string; token: Theme }) => {
  const presetSolidButtonOverrides = PRESET_BUTTON_COLORS.map((colorKey) =>
    getSolidButtonColorOverride(
      token.prefixCls,
      colorKey,
      token[`${colorKey}6` as keyof Theme] as string,
    ),
  ).join('\n');

  return css`
    ${getSolidButtonColorOverride(token.prefixCls, 'primary', token.colorPrimary)}
    ${getSolidButtonColorOverride(token.prefixCls, 'dangerous', token.colorError)}
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
