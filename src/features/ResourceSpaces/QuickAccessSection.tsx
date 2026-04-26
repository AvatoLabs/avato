'use client';

import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import { Share2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useFileScope } from '@/features/ContentManager/useFileScope';
import NavItem from '@/features/NavPanel/components/NavItem';
import { TrashNavItem } from '@/features/ResourceTrash';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

import { buildSharedFilesPath } from './paths';
import { useSpaceName } from './useSpaceName';

const QuickAccessSection = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation('file');
  const location = useLocation();
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const currentSpaceName = useSpaceName(currentSpaceId);
  const { sourceSetId } = useFileScope(currentSpaceId);
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );
  const sharedTitle = `${t('space.quickAccessTitle')} / ${t('shared.title')}`;
  const trashTitle = sourceSetName
    ? `${sourceSetName} / ${t('trash.title')}`
    : currentSpaceName
      ? `${currentSpaceName} / ${t('trash.title')}`
      : `${t('space.quickAccessTitle')} / ${t('trash.title')}`;

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
          active={location.pathname === buildSharedFilesPath()}
          icon={Share2Icon}
          title={sharedTitle}
          onClick={() => navigate(buildSharedFilesPath())}
        />
        <TrashNavItem
          sourceSetId={sourceSetId || undefined}
          spaceId={currentSpaceId}
          title={trashTitle}
        />
      </Flexbox>
    </AccordionItem>
  );
});

QuickAccessSection.displayName = 'QuickAccessSection';

export default QuickAccessSection;
