import { Center, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import PromptInput from '../PromptInput';
import PromptTitle from '../PromptInput/Title';

export type ImageEmptyHint = 'topicEmpty' | 'workspace';

export interface EmptyStateProps {
  emptyHint?: ImageEmptyHint;
}

const EmptyState = memo<EmptyStateProps>(({ emptyHint }) => {
  const { t } = useTranslation('image');

  return (
    <Center height={'min(calc(100vh - 180px), 100%)'} width={'100%'}>
      <Flexbox
        align={'center'}
        direction={'vertical'}
        gap={16}
        style={{ maxWidth: 560 }}
        width={'100%'}
      >
        <PromptTitle />
        {emptyHint === 'workspace' && (
          <>
            <Text style={{ lineHeight: 1.6, textAlign: 'center' }} type={'secondary'}>
              {t('empty.workspace.desc')}
            </Text>
            <Text
              size={'small'}
              style={{ lineHeight: 1.5, textAlign: 'center' }}
              type={'secondary'}
            >
              {t('empty.workspace.deepLink')}
            </Text>
          </>
        )}
        {emptyHint === 'topicEmpty' && (
          <Text style={{ lineHeight: 1.6, textAlign: 'center' }} type={'secondary'}>
            {t('empty.topic.desc')}
          </Text>
        )}
        <PromptInput showTitle={false} />
      </Flexbox>
    </Center>
  );
});

export default EmptyState;
