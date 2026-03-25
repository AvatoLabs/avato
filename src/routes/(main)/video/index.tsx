'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import WideScreenContainer from '@/features/WideScreenContainer';
import WideScreenButton from '@/features/WideScreenContainer/WideScreenButton';

import VideoWorkspace from './features/VideoWorkspace';

const DesktopVideoPage = memo(() => {
  return (
    <>
      <Flexbox height={'100%'} style={{ overflowY: 'auto', position: 'relative' }} width={'100%'}>
        <Flexbox
          horizontal
          gap={8}
          style={{ position: 'absolute', insetInlineEnd: 12, insetBlockStart: 12, zIndex: 2 }}
        >
          <WideScreenButton />
        </Flexbox>
        <WideScreenContainer height={'100%'} wrapperStyle={{ height: '100%' }}>
          <VideoWorkspace />
        </WideScreenContainer>
      </Flexbox>
    </>
  );
});

DesktopVideoPage.displayName = 'DesktopVideoPage';

export default DesktopVideoPage;
