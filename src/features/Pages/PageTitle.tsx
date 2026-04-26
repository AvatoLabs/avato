'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import PageTitle from '@/components/PageTitle';
import { DEFAULT_PAGE_KIND, type PageKind, TABLE_PAGE_KIND } from '@/utils/docs';

interface TitleProps {
  pageKind?: PageKind;
}

const Title = memo<TitleProps>(({ pageKind = DEFAULT_PAGE_KIND }) => {
  const { t } = useTranslation(['common', 'file']);

  const title =
    pageKind === TABLE_PAGE_KIND ? t('pageList.tableTitle', { ns: 'file' }) : t('tab.pages');

  return <PageTitle title={title} />;
});

Title.displayName = 'PageTitle';

export default Title;
