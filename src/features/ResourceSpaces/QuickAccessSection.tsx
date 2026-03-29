'use client';

import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import { Share2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import NavItem from '@/features/NavPanel/components/NavItem';
import { TrashNavItem } from '@/features/ResourceTrash';

import { buildSharedContentPath } from './paths';

const QuickAccessSection = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation('file');
  const location = useLocation();
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('space.quickAccessTitle')}
        </Text>
      }
    >
      <Flexbox gap={1} paddingInline={4}>
        <NavItem
          active={location.pathname === buildSharedContentPath()}
          icon={Share2Icon}
          title={t('shared.title')}
          onClick={() => navigate(buildSharedContentPath())}
        />
        <TrashNavItem spaceId={currentSpaceId} />
      </Flexbox>
    </AccordionItem>
  );
});

QuickAccessSection.displayName = 'QuickAccessSection';

export default QuickAccessSection;
