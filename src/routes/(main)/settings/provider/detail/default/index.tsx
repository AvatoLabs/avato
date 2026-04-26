'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useEffect } from 'react';

import { useAiInfraStore } from '@/store/aiInfra';
import { useServerConfigStore } from '@/store/serverConfig';

import ModelList from '../../features/ModelList';
import { type ProviderConfigProps } from '../../features/ProviderConfig';
import ProviderConfig from '../../features/ProviderConfig';

interface ProviderDetailProps extends ProviderConfigProps {
  showConfig?: boolean;
}
const ProviderDetail = memo<ProviderDetailProps>(({ showConfig = true, ...card }) => {
  const [setActiveAiProvider, useFetchAiProviderItem] = useAiInfraStore((s) => [
    s.setActiveAiProvider,
    s.useFetchAiProviderItem,
  ]);
  const useFetchAiProviderList = useAiInfraStore((s) => s.useFetchAiProviderList);
  const isMobile = useServerConfigStore((s) => s.isMobile);

  useFetchAiProviderList({ enabled: isMobile });
  useFetchAiProviderItem(card.id);

  // Sync active provider immediately so model actions target the current route before SWR finishes.
  useEffect(() => {
    setActiveAiProvider(card.id);
  }, [card.id, setActiveAiProvider]);

  return (
    <Flexbox gap={24} paddingBlock={8}>
      {/* ↓ cloud slot ↓ */}

      {/* ↑ cloud slot ↑ */}
      {showConfig && <ProviderConfig {...card} />}
      <ModelList id={card.id} {...card.settings} />
    </Flexbox>
  );
});

export default ProviderDetail;
