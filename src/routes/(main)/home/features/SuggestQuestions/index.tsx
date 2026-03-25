'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { SUGGEST_QUESTIONS_ICONS } from '@/config/entryIcons';
import { type StarterMode } from '@/store/home';

import GroupBlock from '../components/GroupBlock';
import List from './List';
import SuggestQuestionsSkeleton from './Skeleton';
import { useRandomQuestions } from './useRandomQuestions';

interface SuggestQuestionsProps {
  mode: StarterMode;
}

const SuggestQuestions = memo<SuggestQuestionsProps>(({ mode }) => {
  const { t } = useTranslation('common');
  const { questions, refresh } = useRandomQuestions(mode);

  if (!mode || !['agent', 'group', 'write'].includes(mode)) {
    return null;
  }

  return (
    <GroupBlock
      actionAlwaysVisible
      icon={SUGGEST_QUESTIONS_ICONS.bulb}
      title={t('home.suggestQuestions')}
      action={
        <Flexbox
          horizontal
          align={'center'}
          gap={4}
          style={{ cursor: 'pointer' }}
          onClick={refresh}
        >
          <ActionIcon icon={SUGGEST_QUESTIONS_ICONS.refresh} size={'small'} />
          <Text color={cssVar.colorTextSecondary} fontSize={12}>
            {t('switch')}
          </Text>
        </Flexbox>
      }
    >
      <Suspense fallback={<SuggestQuestionsSkeleton />}>
        <List questions={questions} />
      </Suspense>
    </GroupBlock>
  );
});

export default SuggestQuestions;
