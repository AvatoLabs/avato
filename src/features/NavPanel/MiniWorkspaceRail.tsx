'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { MessageSquarePlus, Search } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { APP_ENTRY_ICONS, ENTRY_ICON_STROKE } from '@/config/entryIcons';
import { WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX } from '@/const/workspaceVisualTokens';
import ToggleLeftPanelButton from '@/features/NavPanel/ToggleLeftPanelButton';
import User from '@/routes/(main)/home/_layout/Header/components/User';
import { useGlobalStore } from '@/store/global';
import { useSessionStore } from '@/store/session';

const iconSize = { size: 20, strokeWidth: ENTRY_ICON_STROKE };

const styles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    width: 100%;
    height: 100%;
    min-height: 0;
    padding-block: 10px 8px;
  `,
  topCluster: css`
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
  `,
  iconWell: css`
    cursor: pointer;

    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;

    width: 36px;
    height: 36px;
    border: none;
    border-radius: ${cssVar.borderRadiusLG};

    color: ${cssVar.colorText};
    text-decoration: none;

    background: transparent;

    transition:
      background-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorText} 12%, transparent);
    }

    &:active {
      background: color-mix(in srgb, ${cssVar.colorText} 16%, transparent);
    }
  `,
  footer: css`
    display: flex;
    flex-shrink: 0;
    justify-content: center;

    padding-block: 4px;
    padding-inline: 4px;
  `,
}));

/**
 * Qwen 式收起态：与主导航同一套动作（收展、新会话、搜索、首页、账户），仅保留图标列。
 */
const MiniWorkspaceRail = memo(() => {
  const { t } = useTranslation(['common', 'chat']);
  const { message } = App.useApp();
  const labelColor = cssVar.colorText;
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const createSession = useSessionStore((s) => s.createSession);

  const handleNewSession = useCallback(() => {
    void createSession().catch((error) => {
      console.error('Failed to create session from mini workspace rail:', error);
      message.error({ content: t('createAgentFailed', { ns: 'chat' }) });
    });
  }, [createSession, message, t]);

  return (
    <Flexbox
      className={styles.root}
      style={{
        maxWidth: WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX,
        minWidth: WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX,
      }}
    >
      <div className={styles.topCluster}>
        <ToggleLeftPanelButton tooltipPlacement="right" />
        <button
          aria-label={t('newSession')}
          className={styles.iconWell}
          title={t('newSession')}
          type="button"
          onClick={handleNewSession}
        >
          <Icon color={labelColor} icon={MessageSquarePlus} size={iconSize} />
        </button>
        <button
          aria-label={t('tab.search')}
          className={styles.iconWell}
          title={t('tab.search')}
          type="button"
          onClick={() => toggleCommandMenu(true)}
        >
          <Icon color={labelColor} icon={Search} size={iconSize} />
        </button>
        <Link aria-label={t('tab.home')} className={styles.iconWell} title={t('tab.home')} to="/">
          <Icon color={labelColor} icon={APP_ENTRY_ICONS.home} size={iconSize} />
        </Link>
      </div>
      <div className={styles.footer}>
        <User lite />
      </div>
    </Flexbox>
  );
});

MiniWorkspaceRail.displayName = 'MiniWorkspaceRail';

export default MiniWorkspaceRail;
