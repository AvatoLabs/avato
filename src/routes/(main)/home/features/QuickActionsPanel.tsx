'use client';

import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { Blocks, FileTextIcon, type LucideIcon } from 'lucide-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ACTION_ENTRY_ICONS } from '@/config/entryIcons';
import { useSpaceName } from '@/features/ResourceSpaces';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useChatStore } from '@/store/chat';
import { useHomeStore } from '@/store/home/store';
import { getPageRootPath } from '@/utils/docs';

const styles = createStaticStyles(({ css, cssVar }) => ({
  eyebrow: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextDescription};
    text-transform: uppercase;
    letter-spacing: 0.12em;
  `,
  modeGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    @media (width <= 960px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    min-height: 92px;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorFillTertiary} 8%);

    transition:
      transform ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};

    &:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 58%, ${cssVar.colorBorder} 42%);
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 16%, ${cssVar.colorBgContainer});
      box-shadow: ${cssVar.boxShadowSecondary};
    }

    &:active {
      transform: translateY(0) scale(0.985);
    }
  `,
  activeCard: css`
    border-color: ${cssVar.colorPrimaryBorder};
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 28%, ${cssVar.colorBgContainer});
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 16%, transparent),
      ${cssVar.boxShadowSecondary};
  `,
  contextHint: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextDescription};
  `,
  chip: css`
    padding-inline: 8px;
    border-radius: 999px;

    font-size: 11px;
    font-weight: 600;
    line-height: 20px;
    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 72%, ${cssVar.colorBgContainer});
  `,
  footer: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  iconWrap: css`
    display: flex;
    align-items: center;
    justify-content: center;

    width: 34px;
    height: 34px;
    border-radius: 12px;

    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 78%, ${cssVar.colorBgContainer});
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    color: ${cssVar.colorText};
  `,
  utilityGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;

    padding-block-start: 12px;
    border-block-start: 1px solid
      color-mix(in srgb, ${cssVar.colorBorderSecondary} 68%, transparent);

    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  `,
  utilityAction: css`
    cursor: pointer;

    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

    color: inherit;
    text-align: start;

    appearance: none;
    background: color-mix(in srgb, ${cssVar.colorBgContainer} 94%, ${cssVar.colorFillTertiary} 6%);

    transition:
      transform ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};

    &:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 42%, ${cssVar.colorBorder} 58%);
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 10%, ${cssVar.colorBgContainer});
      box-shadow: ${cssVar.boxShadowTertiary};
    }

    &:active {
      transform: scale(0.985);
    }
  `,
  utilityFooter: css`
    font-size: 12px;
    line-height: 1.45;
    color: ${cssVar.colorTextDescription};
  `,
  utilityIconWrap: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 32px;
    height: 32px;
    border-radius: 12px;

    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 76%, ${cssVar.colorBgContainer});
  `,
  utilityTitle: css`
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    color: ${cssVar.colorText};
  `,
}));

type ModeAction = 'agent' | 'group' | 'write';

interface BaseAction {
  footer: string;
  key: string;
  title: string;
}

interface ModeQuickAction extends BaseAction {
  icon: FC<any> | LucideIcon;
  kind: 'mode';
  mode: ModeAction;
}

interface UtilityQuickAction extends BaseAction {
  icon: FC<any> | LucideIcon;
  kind: 'utility';
  onClick: () => void;
}

const QuickActionsPanel = memo(() => {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const resolvedSpaceId = resolveWorkspaceSpaceId();
  const workspaceName = useSpaceName(resolvedSpaceId);

  const [inputActiveMode, setInputActiveMode, clearInputMode] = useHomeStore((s) => [
    s.inputActiveMode,
    s.setInputActiveMode,
    s.clearInputMode,
  ]);
  const mainInputEditor = useChatStore((s) => s.mainInputEditor);
  const translateText = (key: string, options?: Record<string, unknown>) =>
    t(key as any, options as any) as string;

  const modeActions: ModeQuickAction[] = [
    {
      footer: translateText('workspace.quickActions.hint.agent'),
      icon: ACTION_ENTRY_ICONS.createAgent,
      key: 'agent',
      kind: 'mode',
      mode: 'agent',
      title: t('starter.createAgent'),
    },
    {
      footer: translateText('workspace.quickActions.hint.group'),
      icon: ACTION_ENTRY_ICONS.createGroup,
      key: 'group',
      kind: 'mode',
      mode: 'group',
      title: t('starter.createGroup'),
    },
    {
      footer: workspaceName
        ? translateText('workspace.quickActions.hint.writeInWorkspace', { name: workspaceName })
        : translateText('workspace.quickActions.hint.write'),
      icon: ACTION_ENTRY_ICONS.write,
      key: 'write',
      kind: 'mode',
      mode: 'write',
      title: t('starter.write'),
    },
  ];

  const utilityActions: UtilityQuickAction[] = [
    {
      footer: workspaceName
        ? translateText('workspace.quickActions.hint.documentsInWorkspace', {
            name: workspaceName,
          })
        : translateText('workspace.quickActions.hint.documents'),
      icon: FileTextIcon,
      key: 'documents',
      kind: 'utility',
      onClick: () => navigate(getPageRootPath('doc', resolvedSpaceId)),
      title: t('workspace.quickActions.newDoc'),
    },
    {
      footer: translateText('workspace.quickActions.hint.community'),
      icon: Blocks,
      key: 'community',
      kind: 'utility',
      onClick: () => navigate('/community/agent'),
      title: t('workspace.quickActions.openCommunity'),
    },
  ];

  return (
    <Flexbox gap={10}>
      <Flexbox gap={6}>
        <span className={styles.eyebrow}>{t('workspace.quickActions.title')}</span>
        {workspaceName && (
          <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
            <Tag bordered={false}>{translateText('workspace.quickActions.scope.workspace')}</Tag>
            <span className={styles.contextHint}>
              {translateText('workspace.quickActions.scope.inWorkspace', { name: workspaceName })}
            </span>
          </Flexbox>
        )}
      </Flexbox>
      <div className={styles.modeGrid}>
        {modeActions.map((action) => {
          const isActive = inputActiveMode === action.mode;

          return (
            <Block
              clickable
              className={cx(styles.card, isActive && styles.activeCard)}
              key={action.key}
              variant={'outlined'}
              onClick={() => {
                if (inputActiveMode === action.mode) {
                  clearInputMode();
                } else {
                  setInputActiveMode(action.mode);
                  mainInputEditor?.focus();
                }
              }}
            >
              <Flexbox gap={14} height={'100%'} justify={'space-between'}>
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <div className={styles.iconWrap}>
                    <Icon icon={action.icon} size={16} />
                  </div>
                  {isActive && <span className={styles.chip}>{t('workspace.status.on')}</span>}
                </Flexbox>
                <Flexbox gap={6}>
                  <Text as={'div'} className={styles.title}>
                    {action.title}
                  </Text>
                  <span className={styles.footer}>{action.footer}</span>
                </Flexbox>
              </Flexbox>
            </Block>
          );
        })}
      </div>
      <div className={styles.utilityGrid}>
        {utilityActions.map((action) => (
          <button
            className={styles.utilityAction}
            key={action.key}
            type="button"
            onClick={action.onClick}
          >
            <Flexbox horizontal align={'center'} gap={10}>
              <div className={styles.utilityIconWrap}>
                <Icon icon={action.icon} size={16} />
              </div>
              <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
                <Text ellipsis as={'div'} className={styles.utilityTitle}>
                  {action.title}
                </Text>
                <span className={styles.utilityFooter}>{action.footer}</span>
              </Flexbox>
            </Flexbox>
          </button>
        ))}
      </div>
    </Flexbox>
  );
});

QuickActionsPanel.displayName = 'QuickActionsPanel';

export default QuickActionsPanel;
