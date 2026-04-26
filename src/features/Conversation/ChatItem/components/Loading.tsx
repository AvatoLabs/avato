import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import BubblesLoading from '@/components/BubblesLoading';

import { styles } from '../style';
import { type ChatItemProps } from '../type';

export interface LoadingProps {
  loading?: ChatItemProps['loading'];
  placement?: ChatItemProps['placement'];
}

const Loading = memo<LoadingProps>(({ loading }) => {
  if (!loading) return null;

  return (
    <Flexbox align={'center'} className={styles.loading} justify={'center'}>
      <BubblesLoading size={4} />
    </Flexbox>
  );
});

export default Loading;
