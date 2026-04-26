'use client';

import { ActionIcon } from '@lobehub/ui';
import { useDebounce } from 'ahooks';
import { Input } from 'antd';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

const SearchInput = memo(() => {
  const { t } = useTranslation(['components', 'file']);
  const [expanded, setExpanded] = useState(false);
  const [showIcon, setShowIcon] = useState(true);
  const [localQuery, setLocalQuery] = useState('');
  const inputRef = useRef<any>(null);
  const setSearchQuery = useContentManagerStore((s) => s.setSearchQuery);

  const debouncedQuery = useDebounce(localQuery, { wait: 350 });

  const placeholder = t('FileManager.search.placeholder', {
    defaultValue: 'Search Files',
    ns: 'components',
  });

  useEffect(() => {
    if (!expanded) return;
    setSearchQuery(debouncedQuery || null);
  }, [debouncedQuery, expanded, setSearchQuery]);

  const handleExpand = useCallback(() => {
    setShowIcon(false);
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpanded(false);
    setLocalQuery('');
    setSearchQuery(null);
  }, [setSearchQuery]);

  const handleBlur = useCallback(() => {
    if (!localQuery) {
      handleCollapse();
    }
  }, [localQuery, handleCollapse]);

  const handleTransitionEnd = useCallback(() => {
    if (!expanded) {
      setShowIcon(true);
    }
  }, [expanded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCollapse();
      }
    },
    [handleCollapse],
  );

  return (
    <>
      <div
        style={{
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'width 240ms ease-out, opacity 200ms ease-out',
          width: expanded ? 200 : 0,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <Input
          placeholder={placeholder}
          prefix={<RESOURCE_ENTRY_ICONS.search size={14} />}
          ref={inputRef}
          size="small"
          style={{ width: 200 }}
          value={localQuery}
          suffix={
            localQuery ? (
              <RESOURCE_ENTRY_ICONS.close
                size={14}
                style={{ cursor: 'pointer' }}
                onClick={handleCollapse}
              />
            ) : undefined
          }
          onBlur={handleBlur}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {showIcon && <ActionIcon icon={RESOURCE_ENTRY_ICONS.search} onClick={handleExpand} />}
    </>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
