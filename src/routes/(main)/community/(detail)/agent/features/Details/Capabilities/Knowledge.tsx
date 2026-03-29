import { Block, Empty, Flexbox } from '@lobehub/ui';
import { BookOpen } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDetailContext } from '../../DetailProvider';
import AgentSourceItem from './KnowledgeItem';

const Knowledge = memo(() => {
  const { t } = useTranslation('discover');
  const { config } = useDetailContext();

  if (!config?.sourceSets?.length)
    return (
      <Block variant={'outlined'}>
        <Empty
          description={t('assistants.details.capabilities.knowledge.desc')}
          descriptionProps={{ fontSize: 14 }}
          icon={BookOpen}
        />
      </Block>
    );

  return (
    <Flexbox gap={8}>
      {config?.sourceSets.map((item) => (
        <AgentSourceItem
          avatar={item.avatar || item.id}
          description={item?.description || ''}
          key={item.id}
          title={item.name}
        />
      ))}
    </Flexbox>
  );
});

export default Knowledge;
