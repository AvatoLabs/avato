'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import BackButton from '@/features/NavPanel/components/BackButton';

import LibraryHead from './LibraryHead';

const Header = memo(() => {
  const { id } = useParams<{ id: string }>();
  return (
    <Flexbox
      horizontal
      align={'center'}
      flex={'none'}
      justify={'space-between'}
      padding={'6px 8px'}
    >
      <Flexbox horizontal align={'center'} flex={1} gap={4} style={{ minWidth: 0 }}>
        <BackButton
          to="/resource"
          size={{
            blockSize: 32,
            size: 16,
          }}
        />
        <LibraryHead id={id || ''} />
      </Flexbox>
    </Flexbox>
  );
});

export default Header;
