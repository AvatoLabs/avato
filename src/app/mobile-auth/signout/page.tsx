'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';

const MobileSignOutPageContent = () => {
  const searchParams = useSearchParams();

  useEffect(() => {
    const callbackUrl = searchParams.get('callbackUrl') || '/signin';

    const signOut = async () => {
      try {
        await fetch('/api/auth/sign-out', {
          credentials: 'include',
          method: 'POST',
        });
      } finally {
        window.location.replace(callbackUrl);
      }
    };

    void signOut();
  }, [searchParams]);

  return <Loading debugId={'MobileSignOut'} />;
};

const MobileSignOutPage = () => {
  return (
    <Suspense fallback={<Loading debugId={'MobileSignOut'} />}>
      <MobileSignOutPageContent />
    </Suspense>
  );
};

export default MobileSignOutPage;
