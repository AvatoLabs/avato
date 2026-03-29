'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import SourceSetTree from '@/features/ContentManager/components/SourceSetTree';

import Head from '../_layout/Header/SourceSetHeader';

const Menu = memo<{ id: string }>(({ id }) => {
  return (
    <Flexbox gap={16} height={'100%'} style={{ paddingTop: 12 }}>
      <Flexbox paddingInline={12}>
        <Head id={id} />
      </Flexbox>
      <SourceSetTree />
    </Flexbox>
  );
});

Menu.displayName = 'Menu';

export default Menu;
