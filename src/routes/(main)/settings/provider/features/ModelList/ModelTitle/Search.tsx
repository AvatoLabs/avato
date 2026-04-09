import { type InputProps } from '@lobehub/ui';
import { SearchBar } from '@lobehub/ui';
import { type ChangeEvent } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface SearchProps {
  onChange: (value: string) => void;
  value: string;
  variant?: InputProps['variant'];
}

const Search = memo<SearchProps>(({ value, onChange, variant }) => {
  const { t } = useTranslation('modelProvider');

  return (
    <SearchBar
      allowClear
      placeholder={t('providerModels.list.search')}
      size={'small'}
      value={value}
      variant={variant}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
});
export default Search;
