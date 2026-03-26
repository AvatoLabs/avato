import { type EmptyProps } from '@lobehub/ui';
import { Center, Empty } from '@lobehub/ui';
import { FileText, Table2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_PAGE_KIND, type PageKind, TABLE_PAGE_KIND } from '@/utils/page';

interface PageEmptyProps extends Omit<EmptyProps, 'icon'> {
  pageKind?: PageKind;
  search?: boolean;
}

const PageEmpty = memo<PageEmptyProps>(({ pageKind = DEFAULT_PAGE_KIND, search, ...rest }) => {
  const { t } = useTranslation('file');
  const isTablePage = pageKind === TABLE_PAGE_KIND;

  return (
    <Center height="100%" style={{ minHeight: '50vh' }} width="100%">
      <Empty
        icon={isTablePage ? Table2 : FileText}
        description={
          search
            ? t(isTablePage ? 'pageList.tableNoResults' : 'pageList.noResults')
            : t(isTablePage ? 'pageList.tableEmpty' : 'pageList.empty')
        }
        descriptionProps={{
          fontSize: 14,
        }}
        style={{
          maxWidth: 400,
        }}
        {...rest}
      />
    </Center>
  );
});

PageEmpty.displayName = 'PageEmpty';

export default PageEmpty;
