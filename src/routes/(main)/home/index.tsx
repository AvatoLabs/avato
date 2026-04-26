import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { useLocation } from 'react-router-dom';

import PageTitle from '@/components/PageTitle';
import WideScreenContainer from '@/features/WideScreenContainer';

import HomeContent from './features';

const Home: FC = () => {
  const { pathname } = useLocation();
  const isHomeRoute = pathname === '/';

  return (
    <Flexbox flex={1} height={'100%'} style={{ minHeight: 0, position: 'relative' }} width={'100%'}>
      {isHomeRoute && <PageTitle title="" />}
      <Flexbox
        align={'stretch'}
        flex={1}
        justify={'flex-start'}
        style={{ minHeight: 0, overflowY: 'auto', paddingBlock: 24 }}
        width={'100%'}
      >
        <WideScreenContainer paddingInline={20}>
          <HomeContent />
        </WideScreenContainer>
      </Flexbox>
    </Flexbox>
  );
};

export default Home;
