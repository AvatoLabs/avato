import { isDesktop } from '@lobechat/const';
import { useTranslation } from 'react-i18next';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import DeviceGatewaySection from './features/DeviceGatewaySection';
import ToolDetectorSection from './features/ToolDetectorSection';

const Page = () => {
  const { t } = useTranslation('setting');
  return (
    <>
      <SettingHeader title={t('tab.systemTools')} />
      {isDesktop && <DeviceGatewaySection />}
      {isDesktop && <ToolDetectorSection />}
    </>
  );
};

export default Page;
