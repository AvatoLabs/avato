'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { buildSourceSetPath } from '@/features/ResourceSpaces';
import EmptyNavItem from '@/features/NavPanel/components/EmptyNavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useSourceSetStore } from '@/store/sourceSet';

import { useProjectMenuItems } from '../../../hooks';
import Item from './Item';

const ProjectList = memo(() => {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data, isLoading } = useFetchSourceSetList();
  const { createProject } = useProjectMenuItems();

  if (!data || isLoading) return <SkeletonList />;

  const isEmpty = data.length === 0;

  if (isEmpty) {
    return <EmptyNavItem title={t('project.create')} onClick={createProject} />;
  }

  return (
    <Flexbox gap={1}>
      {data.map((item) => (
        <Link
          aria-label={item.id}
          key={item.id}
          to={buildSourceSetPath(item.spaceId, item.id)}
          onClick={(e) => {
            e.preventDefault();
            navigate(buildSourceSetPath(item.spaceId, item.id));
          }}
        >
          <Item {...item} key={item.id} />
        </Link>
      ))}
    </Flexbox>
  );
});

export default ProjectList;
