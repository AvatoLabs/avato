import { isDesktop } from '@lobechat/const';
import { type Theme } from 'antd-style';
import { css } from 'antd-style';
import { rgba } from 'polished';

const antdOverride = ({ token }: { prefixCls: string; token: Theme }) => css`
  /**
   * 暗色下「彩色实心」按钮字色：与 AppTheme / AuthThemeLite 的 theme.token.colorTextLightSolid 双保险。
   * 含 primary、dangerous、success、warning 及 PresetColors（lime 等）；排除 color-default（用 solidTextColor 按亮度算字色）。
   */
  html[data-theme='dark']
    .${token.prefixCls}-btn.${token.prefixCls}-btn-variant-solid:not(.${token.prefixCls}-btn-color-default):not(
      :disabled
    ):not(.${token.prefixCls}-btn-disabled) {
    color: #fff !important;
  }

  html[data-theme='dark']
    .${token.prefixCls}-btn.${token.prefixCls}-btn-variant-solid:not(.${token.prefixCls}-btn-color-default):not(
      :disabled
    ):not(.${token.prefixCls}-btn-disabled)
    .${token.prefixCls}icon,
    html[data-theme='dark']
    .${token.prefixCls}-btn.${token.prefixCls}-btn-variant-solid:not(.${token.prefixCls}-btn-color-default):not(
      :disabled
    ):not(.${token.prefixCls}-btn-disabled)
    svg {
    color: #fff !important;
  }

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

export default antdOverride;
