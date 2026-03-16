'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import PageTitle from '@/components/PageTitle';
import MCPWorkflowStudio from '@/features/MCPWorkflowStudio';
import NavHeader from '@/features/NavHeader';
import WideScreenContainer from '@/features/WideScreenContainer';
import WideScreenButton from '@/features/WideScreenContainer/WideScreenButton';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

const AvatoStudioPage = memo(() => {
  const { t } = useTranslation('common');
  const toggleWideScreen = useGlobalStore((s) => s.toggleWideScreen);

  useEffect(() => {
    const initialWideScreen = systemStatusSelectors.wideScreen(useGlobalStore.getState());

    if (!initialWideScreen) toggleWideScreen(true);

    return () => {
      if (!initialWideScreen) toggleWideScreen(false);
    };
  }, [toggleWideScreen]);

  return (
    <>
      <PageTitle title={t('tab.avatoStudio')} />
      <NavHeader right={<WideScreenButton />} />
      <Flexbox height={'100%'} style={{ overflowY: 'auto', position: 'relative' }} width={'100%'}>
        <WideScreenContainer height={'100%'} wrapperStyle={{ height: '100%' }}>
          <MCPWorkflowStudio />
        </WideScreenContainer>
      </Flexbox>
    </>
  );
});

AvatoStudioPage.displayName = 'AvatoStudioPage';

export default AvatoStudioPage;
