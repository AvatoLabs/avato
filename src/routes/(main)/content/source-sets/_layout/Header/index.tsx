'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import BackButton from '@/features/NavPanel/components/BackButton';
import { useSourceSetBackPath } from '@/routes/(main)/content/source-sets/features/useSourceSetBackPath';

import SourceSetDescription from './SourceSetDescription';
import SourceSetHeader from './SourceSetHeader';

const Header = memo(() => {
  const backPath = useSourceSetBackPath();

  return (
    <Flexbox flex={'none'} gap={4} padding={'6px 8px'}>
      <Flexbox horizontal align={'center'} flex={1} gap={4} style={{ minWidth: 0 }}>
        <BackButton
          to={backPath}
          useHistory={false}
          size={{
            blockSize: 32,
            size: 16,
          }}
        />
        <SourceSetHeader />
      </Flexbox>
      <Flexbox paddingInline={4}>
        <SourceSetDescription />
      </Flexbox>
    </Flexbox>
  );
});

export default Header;
