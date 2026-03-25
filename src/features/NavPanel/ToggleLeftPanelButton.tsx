'use client';

import { type ActionIconProps } from '@lobehub/ui';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { PanelLeft, PanelLeftOpen } from 'lucide-react';
import { type ReactNode } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import { HotkeyEnum } from '@/types/hotkey';

export const TOGGLE_BUTTON_ID = 'toggle_left_panel_button';

const useStyles = createStyles(({ css, cssVar }) => ({
  /** ActionIcon defaults to colorTextTertiary — too dim on dark glass rail */
  darkContrast: css`
    html[data-theme='dark'] & {
      color: ${cssVar.colorTextSecondary};

      &:hover {
        color: ${cssVar.colorText};
      }

      &:active {
        color: ${cssVar.colorText};
      }
    }
  `,
}));

interface ToggleLeftPanelButtonProps {
  icon?: ActionIconProps['icon'];
  id?: string;
  showActive?: boolean;
  size?: ActionIconProps['size'];
  title?: ReactNode;
  /** 收起轨上 tooltip 靠右，避免贴底被裁 */
  tooltipPlacement?: 'bottom' | 'right';
}

const ToggleLeftPanelButton = memo<ToggleLeftPanelButtonProps>(
  ({ title, showActive, icon, size, id, tooltipPlacement = 'bottom' }) => {
    const { styles } = useStyles();
    const [expand, leftPanelCollapsed, togglePanel] = useGlobalStore((s) => [
      systemStatusSelectors.showLeftPanel(s),
      s.status.leftPanelCollapsed ?? false,
      s.toggleLeftPanel,
    ]);
    const hotkey = useUserStore(settingsSelectors.getHotkeyById(HotkeyEnum.ToggleLeftPanel));

    const { t } = useTranslation(['chat', 'hotkey']);

    return (
      <ActionIcon
        active={showActive ? expand : undefined}
        className={styles.darkContrast}
        icon={icon ?? (leftPanelCollapsed ? PanelLeftOpen : PanelLeft)}
        id={id ?? TOGGLE_BUTTON_ID}
        size={size || DESKTOP_HEADER_ICON_SIZE}
        title={title || t('toggleLeftPanel.title', { ns: 'hotkey' })}
        tooltipProps={{
          hotkey,
          placement: tooltipPlacement,
        }}
        onClick={() => togglePanel()}
      />
    );
  },
);

export default ToggleLeftPanelButton;
