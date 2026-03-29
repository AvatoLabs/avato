'use client';

import { Block, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ActivityIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { agentByIdSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    position: relative;

    overflow: hidden;

    min-height: 100%;
    padding: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;

    background:
      radial-gradient(
        circle at top right,
        color-mix(in srgb, ${cssVar.colorPrimaryBg} 56%, transparent) 0%,
        transparent 56%
      ),
      color-mix(in srgb, ${cssVar.colorBgContainer} 94%, ${cssVar.colorFillTertiary} 6%);
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  eyebrow: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextDescription};
    text-transform: uppercase;
    letter-spacing: 0.12em;
  `,
  header: css`
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    color: ${cssVar.colorText};
    letter-spacing: -0.03em;
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;

    @media (width <= 860px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  metricCard: css`
    padding: 12px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorFillTertiary} 8%);
  `,
  metricLabel: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  metricValue: css`
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  primaryPanel: css`
    padding: 14px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, ${cssVar.colorBgContainer} 94%, ${cssVar.colorFillTertiary} 6%);
  `,
  primaryLabel: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextDescription};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  `,
  primaryValue: css`
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  statusPill: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;
    align-self: flex-start;

    padding-block: 6px;
    padding-inline: 10px;
    border-radius: 999px;

    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 78%, ${cssVar.colorBgContainer});
  `,
}));

const WorkspaceStatusPanel = memo(() => {
  const { t } = useTranslation('home');

  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const model = useAgentStore((s) =>
    inboxAgentId ? agentByIdSelectors.getAgentModelById(inboxAgentId)(s) : null,
  );
  const provider = useAgentStore((s) =>
    inboxAgentId ? agentByIdSelectors.getAgentModelProviderById(inboxAgentId)(s) : null,
  );
  const [recentPages, recentResources, recentTopics, loading] = useHomeStore((s) => [
    homeRecentSelectors.recentPages(s),
    homeRecentSelectors.recentResources(s),
    homeRecentSelectors.recentTopics(s),
    s.homeInputLoading,
  ]);
  const [enableLobehubSkill, enableKlavis] = useServerConfigStore((s) => [
    serverConfigSelectors.enableLobehubSkill(s),
    serverConfigSelectors.enableKlavis(s),
  ]);

  const recentCount =
    (recentPages?.length || 0) + (recentResources?.length || 0) + (recentTopics?.length || 0);
  const modelLabel = [provider, model].filter(Boolean).join(' / ') || t('workspace.status.off');

  const rows = [
    {
      label: t('workspace.status.skills'),
      value: enableLobehubSkill ? t('workspace.status.on') : t('workspace.status.off'),
    },
    {
      label: t('workspace.status.mcp'),
      value: enableKlavis ? t('workspace.status.on') : t('workspace.status.off'),
    },
    { label: t('workspace.status.recent'), value: String(recentCount) },
  ];

  return (
    <Block className={styles.card} variant={'outlined'}>
      <Flexbox gap={18} height={'100%'} justify={'space-between'}>
        <Flexbox gap={12}>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            <span className={styles.eyebrow}>{t('workspace.status.title')}</span>
            <span className={styles.statusPill}>
              <ActivityIcon size={12} />
              {loading ? t('workspace.status.syncing') : t('workspace.status.on')}
            </span>
          </Flexbox>
          <Text as={'div'} className={styles.header}>
            {loading ? t('workspace.status.syncing') : t('workspace.status.ready')}
          </Text>
          <div className={styles.primaryPanel}>
            <Flexbox gap={4}>
              <span className={styles.primaryLabel}>{t('workspace.status.model')}</span>
              <Text ellipsis as={'div'} className={styles.primaryValue}>
                {modelLabel}
              </Text>
            </Flexbox>
          </div>
        </Flexbox>
        <div className={styles.metricGrid}>
          {rows.map((row) => (
            <div className={styles.metricCard} key={row.label}>
              <Flexbox gap={4}>
                <span className={styles.metricLabel}>{row.label}</span>
                <span className={styles.metricValue}>{row.value}</span>
              </Flexbox>
            </div>
          ))}
        </div>
      </Flexbox>
    </Block>
  );
});

WorkspaceStatusPanel.displayName = 'WorkspaceStatusPanel';

export default WorkspaceStatusPanel;
