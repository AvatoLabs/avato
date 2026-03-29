'use client';

import { DEFAULT_DOC_COPILOT_AVATAR, normalizeBuiltinAvatar } from '@lobechat/const';
import { Avatar, Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStyles, cssVar } from 'antd-style';
import {
  ArrowDownWideNarrowIcon,
  Columns3Icon,
  Rows3Icon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react';
import { memo, type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { conversationSelectors, useConversationStore } from '@/features/Conversation';
import { usePageEditorStore } from '@/features/PageEditor/store';
import SuggestQuestions from '@/features/SuggestQuestions';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { TABLE_PAGE_KIND } from '@/utils/docs';

const useStyles = createStyles(({ css, token }) => ({
  welcomeCopy: css`
    font-size: 14px;
    line-height: 1.7;
    color: ${cssVar.colorTextSecondary};

    strong {
      font-weight: 600;
      color: ${cssVar.colorText};
    }
  `,
  tableCard: css`
    cursor: pointer;
    border-radius: ${token.borderRadiusLG}px;
    transition:
      border-color ${token.motionDurationMid} ${token.motionEaseOut},
      background ${token.motionDurationMid} ${token.motionEaseOut};

    &:hover {
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 68%, transparent);
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 14%, ${cssVar.colorBgContainer} 86%);
    }
  `,
  tableCardIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    inline-size: 28px;
    block-size: 28px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorPrimaryBorder} 58%, transparent);
    border-radius: ${token.borderRadius}px;

    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 82%, transparent);
  `,
}));

const renderInlineMarks = (content: string): ReactNode[] =>
  content
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((segment, index) =>
      segment.startsWith('**') && segment.endsWith('**') ? (
        <strong key={`${segment}-${index}`}>{segment.slice(2, -2)}</strong>
      ) : (
        <span key={`${segment}-${index}`}>{segment}</span>
      ),
    );

const AgentBuilderWelcome = memo(() => {
  const { t } = useTranslation('chat');
  const { styles } = useStyles();
  const agentId = useConversationStore(conversationSelectors.agentId);
  const inputEditor = useConversationStore((s) => s.editor);
  const agent = useAgentStore(agentByIdSelectors.getAgentConfigById(agentId));
  const pageKind = usePageEditorStore((s) => s.pageKind);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const tablePrompts = useMemo(
    () => [
      {
        icon: SparklesIcon,
        key: 'fill-missing',
        prompt: t('docsCopilot.table.cards.fillMissing.prompt', {
          defaultValue:
            'Fill the cells that can be inferred safely. Keep the current structure and flag anything uncertain.',
        }),
        title: t('docsCopilot.table.cards.fillMissing.title', {
          defaultValue: 'Fill obvious blanks',
        }),
      },
      {
        icon: Columns3Icon,
        key: 'normalize',
        prompt: t('docsCopilot.table.cards.normalize.prompt', {
          defaultValue:
            'Standardize column names, dates, and status values without changing the meaning.',
        }),
        title: t('docsCopilot.table.cards.normalize.title', {
          defaultValue: 'Standardize values',
        }),
      },
      {
        icon: SearchIcon,
        key: 'audit',
        prompt: t('docsCopilot.table.cards.audit.prompt', {
          defaultValue:
            'Scan for duplicates, inconsistent values, and obvious gaps, then tell me what to fix first.',
        }),
        title: t('docsCopilot.table.cards.audit.title', {
          defaultValue: 'Find issues first',
        }),
      },
      {
        icon: Rows3Icon,
        key: 'reshape',
        prompt: t('docsCopilot.table.cards.reshape.prompt', {
          defaultValue:
            'Review this table structure, split overloaded columns, merge duplicate fields, and suggest a cleaner schema.',
        }),
        title: t('docsCopilot.table.cards.reshape.title', {
          defaultValue: 'Reshape the schema',
        }),
      },
      {
        icon: ArrowDownWideNarrowIcon,
        key: 'summary',
        prompt: t('docsCopilot.table.cards.summary.prompt', {
          defaultValue:
            'Summarize this table for me: row count, missing data, inconsistent values, and the next cleanup actions.',
        }),
        title: t('docsCopilot.table.cards.summary.title', {
          defaultValue: 'Summarize the table',
        }),
      },
    ],
    [t],
  );
  const welcomeCopy = t(isTablePage ? 'docsCopilot.table.welcome' : 'docsCopilot.welcome', {
    defaultValue: isTablePage
      ? '**Keep the table usable**\n\nFill blanks, standardize values, spot anomalies, or reshape columns without leaving this page.'
      : `**Clearer, sharper writing**\n\nDraft, rewrite, or polish—tell me your intent and I'll refine the rest.`,
  });
  const welcomeParagraphs = useMemo(
    () =>
      welcomeCopy
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [welcomeCopy],
  );

  return (
    <>
      <Flexbox flex={1} />
      <Flexbox
        gap={12}
        width={'100%'}
        style={{
          paddingBottom: 16,
        }}
      >
        <Avatar
          avatar={normalizeBuiltinAvatar(agent?.avatar) || DEFAULT_DOC_COPILOT_AVATAR}
          shape={'square'}
          size={78}
        />
        <Text fontSize={24} weight={'bold'}>
          {t(isTablePage ? 'docsCopilot.table.title' : 'docsCopilot.title', {
            defaultValue: isTablePage ? 'Table Assistant' : 'Docs Agent',
          })}
        </Text>
        <Flexbox className={styles.welcomeCopy} gap={4}>
          {welcomeParagraphs.map((paragraph, index) => (
            <div key={`${paragraph}-${index}`}>{renderInlineMarks(paragraph)}</div>
          ))}
        </Flexbox>
        {isTablePage ? (
          <Flexbox gap={12}>
            {tablePrompts.map((item) => (
              <Block
                clickable
                className={styles.tableCard}
                key={item.key}
                variant={'outlined'}
                onClick={() => {
                  inputEditor?.instance?.setDocument('markdown', item.prompt);
                  inputEditor?.focus();
                }}
              >
                <Flexbox gap={8} paddingBlock={12} paddingInline={14}>
                  <div className={styles.tableCardIcon}>
                    <Icon icon={item.icon} />
                  </div>
                  <Text ellipsis fontSize={14} style={{ fontWeight: 500 }}>
                    {item.title}
                  </Text>
                  <Text color={cssVar.colorTextTertiary} ellipsis={{ rows: 2 }} fontSize={12}>
                    {item.prompt}
                  </Text>
                </Flexbox>
              </Block>
            ))}
          </Flexbox>
        ) : (
          <SuggestQuestions count={3} mode="write" />
        )}
      </Flexbox>
    </>
  );
});

export default AgentBuilderWelcome;
