import { WalletCards } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';

import NavItem from '@/features/NavPanel/components/NavItem';

export const PROVIDER_ALL_PATH = 'all';

const All = memo((props: { onClick: (activeTab: string) => void }) => {
  const { onClick } = props;
  const { t } = useTranslation('modelProvider');
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Prefer route param style: /settings/provider/xxx
  // Fallback to legacy query-param style: ?active=provider&provider=xxx
  const activeKey = useMemo(() => {
    const pathParts = location.pathname.split('/');
    if (pathParts.length >= 4 && pathParts[2] === 'provider') {
      return pathParts[3];
    }

    return searchParams.get('provider');
  }, [location.pathname, searchParams]);

  return (
    <NavItem
      active={activeKey === PROVIDER_ALL_PATH}
      icon={WalletCards}
      title={t('menu.all')}
      onClick={() => {
        onClick(PROVIDER_ALL_PATH);
      }}
    />
  );
});
export default All;
