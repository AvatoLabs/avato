'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useEffect } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { useClientDataSWR } from '@/libs/swr';
import { aiProviderService } from '@/services/aiProvider';
import DiscoverRequestError from '@/routes/(main)/community/features/DiscoverRequestError';
import { useAiInfraStore } from '@/store/aiInfra';

import ModelList from '../../features/ModelList';
import ProviderConfig from '../../features/ProviderConfig';

const ClientMode = memo<{ id: string }>(({ id }) => {
  const [useFetchAiProviderItem, setActiveAiProvider] = useAiInfraStore((s) => [
    s.useFetchAiProviderItem,
    s.setActiveAiProvider,
  ]);
  useFetchAiProviderItem(id);

  // Sync activeAiProvider with route id on mount so refresh/toggle use correct provider before fetches complete
  useEffect(() => {
    setActiveAiProvider(id);
  }, [id, setActiveAiProvider]);

  const { data, error, isLoading, mutate } = useClientDataSWR(`get-client-provider-${id}`, () =>
    aiProviderService.getAiProviderById(id),
  );

  if (error) return <DiscoverRequestError onRetry={() => void mutate()} />;
  if (isLoading) return <Loading debugId="Provider > ClientMode" />;
  if (!data?.id) return <DiscoverRequestError onRetry={() => void mutate()} />;

  return (
    <Flexbox gap={24} paddingBlock={8}>
      <ProviderConfig {...data} id={id} name={data.name || ''} />
      <ModelList id={id} />
    </Flexbox>
  );
});

export default ClientMode;
