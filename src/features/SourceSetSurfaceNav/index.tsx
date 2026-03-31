'use client';

import { Icon, Segmented } from '@lobehub/ui';
import { FileText, FolderOpen } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { buildPageScopeSearch, createSourceSetPageScope } from '@/features/Pages/usePageScope';
import { buildSourceSetPath } from '@/features/ResourceSpaces';
import { getPageRootPath } from '@/utils/docs';

interface SourceSetSurfaceNavProps {
  activeSurface: 'docs' | 'files';
  sourceSetId: string;
  spaceId?: string | null;
}

const SourceSetSurfaceNav = memo<SourceSetSurfaceNavProps>(
  ({ activeSurface, sourceSetId, spaceId }) => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();

    const docsPath = `${getPageRootPath(undefined, spaceId)}${buildPageScopeSearch(
      createSourceSetPageScope(sourceSetId),
    )}`;
    const filesPath = buildSourceSetPath(spaceId, sourceSetId);

    const options = useMemo(
      () => [
        {
          icon: <Icon icon={FileText} />,
          label: t('tab.pages'),
          value: 'docs',
        },
        {
          icon: <Icon icon={FolderOpen} />,
          label: t('tab.files'),
          value: 'files',
        },
      ],
      [t],
    );

    return (
      <Segmented
        options={options}
        size={'middle'}
        style={{ width: 'fit-content' }}
        value={activeSurface}
        onChange={(value) => navigate(value === 'docs' ? docsPath : filesPath)}
      />
    );
  },
);

SourceSetSurfaceNav.displayName = 'SourceSetSurfaceNav';

export default SourceSetSurfaceNav;
