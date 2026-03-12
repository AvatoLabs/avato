'use client';

import { Outlet, useNavigate, useParams } from 'react-router-dom';

import ProviderMenu from '../../../../(main)/settings/provider/ProviderMenu';

const Layout = () => {
  const params = useParams<{ providerId: string }>();
  const navigate = useNavigate();

  const handleProviderSelect = (providerKey: string) => {
    navigate(`/settings/provider/${providerKey}`);
  };

  /**
   * Keep mobile provider details strictly aligned with web:
   * all provider IDs (including `all`) should render through ProviderDetailPage.
   * ProviderMenu remains as a fallback only when route params are missing.
   */
  if (!params.providerId) {
    return <ProviderMenu mobile={true} onProviderSelect={handleProviderSelect} />;
  }

  return <Outlet />;
};

export default Layout;
