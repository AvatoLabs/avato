'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import SourceSetTree from '@/features/ContentManager/components/SourceSetTree';
import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import { buildContentRootPath, SpaceListSection } from '@/features/ResourceSpaces';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

import Header from './Header';

const Sidebar = memo(() => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const { id = '', spaceId } = useParams<{ id?: string; spaceId?: string }>();
  const currentSourceSetName = useSourceSetStore(sourceSetSelectors.getSourceSetNameById(id));

  return (
    <NavPanelPortal navKey="contentSourceSets">
      <SideBarLayout
        header={<Header />}
        body={
          <Flexbox gap={8} height={'100%'} paddingBlock={8} paddingInline={4}>
            <SpaceListSection
              currentSpaceId={spaceId}
              onSelectSpace={(nextSpaceId) => navigate(buildContentRootPath(nextSpaceId))}
            />
            <Text
              ellipsis
              fontSize={12}
              style={{ paddingInline: 12 }}
              type={'secondary'}
              weight={500}
            >
              {currentSourceSetName || t('sourceSet.title')}
            </Text>
            <Flexbox flex={1} style={{ minHeight: 0 }}>
              <SourceSetTree />
            </Flexbox>
          </Flexbox>
        }
      />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'SourceSetSidebar';

export default Sidebar;
