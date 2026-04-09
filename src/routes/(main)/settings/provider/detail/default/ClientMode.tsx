'use client';

import { Button, Center, Empty, Flexbox } from '@lobehub/ui';
import { CircleAlertIcon } from 'lucide-react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import Loading from '@/components/Loading/BrandTextLoading';
import { useClientDataSWR } from '@/libs/swr';
import { aiProviderService } from '@/services/aiProvider';
import { useAiInfraStore } from '@/store/aiInfra';

import ModelList from '../../features/ModelList';
import ProviderConfig from '../../features/ProviderConfig';

const ClientMode = memo<{ id: string }>(({ id }) => {
  const { t } = useTranslation(['common', 'modelProvider']);
  const [useFetchAiProviderItem, setActiveAiProvider] = useAiInfraStore((s) => [
    s.useFetchAiProviderItem,
    s.setActiveAiProvider,
  ]);
  useFetchAiProviderItem(id);

  // Sync activeAiProvider with route id on mount so refresh/toggle use correct provider before fetches complete
  useEffect(() => {
    setActiveAiProvider(id);
  }, [id, setActiveAiProvider]);

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useClientDataSWR(`get-client-provider-${id}`, () =>
    aiProviderService.getAiProviderById(id),
  );

  if (isLoading) return <Loading debugId="Provider > ClientMode" />;

  if (error || !data || !data.id) {
    return (
      <Center height="100%" style={{ minHeight: '40vh' }} width="100%">
        <Empty
          action={
            error ? (
              <Button
                onClick={() => {
                  void mutate();
                }}
              >
                {t('retry', { ns: 'common' })}
              </Button>
            ) : undefined
          }
          description={t(error ? 'detail.loadError' : 'detail.notFound', {
            ns: 'modelProvider',
          })}
          descriptionProps={{
            fontSize: 14,
          }}
          icon={CircleAlertIcon}
          style={{
            maxWidth: 420,
          }}
        />
      </Center>
    );
  }

  return (
    <Flexbox gap={24} paddingBlock={8}>
      <ProviderConfig {...data} id={id} name={data.name || ''} />
      <ModelList id={id} />
    </Flexbox>
  );
});

export default ClientMode;
