'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  WORKSPACE_HOME_COLUMN_MAX_WIDTH_PX,
  WORKSPACE_HOME_SECTION_GAP_PX,
} from '@/const/workspaceVisualTokens';
import { useIsMobile } from '@/hooks/useIsMobile';

import InputArea from './InputArea';

const styles = createStaticStyles(({ css }) => ({
  workspaceRoot: css`
    width: 100%;
    max-width: ${WORKSPACE_HOME_COLUMN_MAX_WIDTH_PX}px;
    margin-inline: auto;
  `,
}));

const Home = memo(() => {
  const { t } = useTranslation(['home']);
  const isMobile = useIsMobile();

  return (
    <Flexbox
      align={'center'}
      className={styles.workspaceRoot}
      gap={WORKSPACE_HOME_SECTION_GAP_PX}
      width={'100%'}
    >
      <Flexbox align={'center'} gap={10} style={{ width: '100%' }}>
        <Text
          weight={700}
          style={{
            fontSize: isMobile ? 28 : 34,
            letterSpacing: '-0.02em',
            lineHeight: 1.18,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {t('workspace.hero.title')}
        </Text>
        <Text
          color={cssVar.colorTextSecondary}
          style={{
            fontSize: isMobile ? 15 : 16,
            lineHeight: 1.55,
            maxWidth: 640,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {t('workspace.hero.subtitle')}
        </Text>
      </Flexbox>

      <InputArea />
    </Flexbox>
  );
});

export default Home;
