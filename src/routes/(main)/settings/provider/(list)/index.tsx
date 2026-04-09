'use client';

import { useSearchParams } from 'react-router-dom';

import { isCustomBranding } from '@/const/version';

import DesktopLayout from '../_layout/Desktop';
import MobileLayout from '../_layout/Mobile';
import ProviderDetailPage from '../detail';
import Footer from './Footer';

const Page = (props: { mobile?: boolean }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const provider = searchParams.get('provider') || 'all';

  const setProvider = (provider: string) => {
    setSearchParams({ active: 'provider', provider });
  };

  const { mobile } = props;
  const ProviderLayout = mobile ? MobileLayout : DesktopLayout;

  return (
    <ProviderLayout onProviderSelect={setProvider}>
      <ProviderDetailPage id={provider} onProviderSelect={setProvider} />
      {!isCustomBranding && <Footer />}
    </ProviderLayout>
  );
};

export default Page;
