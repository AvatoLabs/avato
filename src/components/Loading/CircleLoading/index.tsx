'use client';

import { Center, Flexbox, Text } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import BubblesLoading from '@/components/BubblesLoading';

const CircleLoading = () => {
  const { t } = useTranslation('common');
  return (
    <Center height={'100%'} width={'100%'}>
      <Flexbox align={'center'} gap={8}>
        <div style={{ color: 'currentColor' }}>
          <BubblesLoading size={7} />
        </div>
        <Text style={{ letterSpacing: '0.1em' }} type={'secondary'}>
          {t('loading')}
        </Text>
      </Flexbox>
    </Center>
  );
};

export default CircleLoading;
