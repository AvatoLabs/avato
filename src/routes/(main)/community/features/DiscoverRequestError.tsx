import { Button, Center, Empty } from '@lobehub/ui';
import { TriangleAlert } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface DiscoverRequestErrorProps {
  onRetry?: () => void;
}

const DiscoverRequestError = memo<DiscoverRequestErrorProps>(({ onRetry }) => {
  const { t } = useTranslation(['common', 'discover']);

  return (
    <Center height="100%" style={{ minHeight: '50vh' }} width="100%">
      <Empty
        action={
          onRetry && (
            <Button type={'primary'} onClick={onRetry}>
              {t('retry', { ns: 'common' })}
            </Button>
          )
        }
        description={t('list.error.description', { ns: 'discover' })}
        icon={TriangleAlert}
        title={t('list.error.title', { ns: 'discover' })}
        type={'page'}
        descriptionProps={{
          fontSize: 14,
        }}
        style={{
          maxWidth: 400,
        }}
      />
    </Center>
  );
});

DiscoverRequestError.displayName = 'DiscoverRequestError';

export default DiscoverRequestError;
