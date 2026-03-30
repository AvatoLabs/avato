'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import Item from './Item';
import { type QuestionItem } from './useRandomQuestions';

interface ListProps {
  questions: QuestionItem[];
}

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  `,
}));

const List = memo<ListProps>(({ questions }) => {
  const { t } = useTranslation('suggestQuestions');

  if (questions.length === 0) {
    return null;
  }

  return (
    <Flexbox className={styles.grid}>
      {questions.map((item) => {
        const prompt = t(item.promptKey as any);
        return (
          <Item
            description={prompt}
            key={item.id}
            prompt={prompt}
            title={t(item.titleKey as any)}
          />
        );
      })}
    </Flexbox>
  );
});

export default List;
