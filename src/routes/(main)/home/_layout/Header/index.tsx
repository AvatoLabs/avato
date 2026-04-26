'use client';

import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import { ProductLogo } from '@/components/Branding';
import {
  WORKSPACE_HOME_SIDEBAR_NAV_ROW_PADDING_INLINE_PX,
  WORKSPACE_NAV_ITEM_BLOCK_PADDING_INLINE_PX,
  WORKSPACE_NAV_ROW_HEIGHT_PX,
} from '@/const/workspaceVisualTokens';
import ToggleLeftPanelButton from '@/features/NavPanel/ToggleLeftPanelButton';

import Nav from './components/Nav';

const Header = memo(() => {
  return (
    <>
      <Flexbox
        horizontal
        align={'center'}
        flex={'none'}
        justify={'space-between'}
        paddingBlock={4}
        paddingInline={WORKSPACE_HOME_SIDEBAR_NAV_ROW_PADDING_INLINE_PX}
        style={{ minHeight: WORKSPACE_NAV_ROW_HEIGHT_PX }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            lineHeight: 0,
            marginInlineStart: WORKSPACE_NAV_ITEM_BLOCK_PADDING_INLINE_PX,
          }}
        >
          <ProductLogo color={cssVar.colorText} size={26} type={'flat'} />
        </Link>
        <ToggleLeftPanelButton />
      </Flexbox>
      <Nav />
    </>
  );
});

export default Header;
