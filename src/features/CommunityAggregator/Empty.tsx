import { type EmptyProps } from '@lobehub/ui';
import { Center, Empty } from '@lobehub/ui';
import { Network } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface AggregatorEmptyProps extends Omit<EmptyProps, 'icon'> {
  description?: string;
  search?: boolean;
  searchDescription?: string;
  title?: string;
}

const AggregatorEmpty = memo<AggregatorEmptyProps>(
  ({
    description = 'aggregator.empty.description',
    search,
    searchDescription = 'aggregator.empty.search',
    title = 'aggregator.empty.title',
    ...rest
  }) => {
    const { t } = useTranslation('discover');

    return (
      <Center height="100%" style={{ minHeight: '50vh' }} width="100%">
        <Empty
          description={search ? t(searchDescription as any) : t(description as any)}
          icon={Network}
          title={search ? undefined : t(title as any)}
          type={search ? 'default' : 'page'}
          descriptionProps={{
            fontSize: 14,
          }}
          style={{
            maxWidth: 420,
          }}
          {...rest}
        />
      </Center>
    );
  },
);

AggregatorEmpty.displayName = 'AggregatorEmpty';

export default AggregatorEmpty;
