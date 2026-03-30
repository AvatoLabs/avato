'use client';

import { Text } from '@lobehub/ui';
import { Input } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

const { TextArea } = Input;

const styles = createStaticStyles(({ css }) => ({
  description: css`
    cursor: pointer;

    padding-block: 4px;
    padding-inline: 8px;
    border-radius: 4px;

    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};

    transition: background 0.2s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  placeholder: css`
    cursor: pointer;

    padding-block: 4px;
    padding-inline: 8px;
    border-radius: 4px;

    font-size: 12px;
    font-style: italic;
    color: ${cssVar.colorTextQuaternary};

    transition: background 0.2s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  textArea: css`
    resize: none;
    font-size: 12px;
    line-height: 1.5;
  `,
}));

const SourceSetDescription = memo(() => {
  const { t } = useTranslation('sourceSet');
  const { id = '' } = useParams<{ id?: string }>();
  const description = useSourceSetStore(sourceSetSelectors.getSourceSetDescriptionById(id));
  const name = useSourceSetStore(sourceSetSelectors.getSourceSetNameById(id));
  const updateSourceSet = useSourceSetStore((s) => s.updateSourceSet);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description || '');
  const textAreaRef = useRef<any>(null);

  // Sync value when description changes from external source
  useEffect(() => {
    if (!editing) {
      setValue(description || '');
    }
  }, [description, editing]);

  const handleClick = useCallback(() => {
    setEditing(true);
    setValue(description || '');
  }, [description]);

  const handleSave = useCallback(async () => {
    const trimmedValue = value.trim();
    if (trimmedValue !== (description || '')) {
      await updateSourceSet(id, { description: trimmedValue, name: name || '' });
    }
    setEditing(false);
  }, [description, id, name, updateSourceSet, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setEditing(false);
        setValue(description || '');
      }
    },
    [description, handleSave],
  );

  // Auto focus when entering edit mode
  useEffect(() => {
    if (editing && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <TextArea
        autoSize={{ minRows: 1, maxRows: 4 }}
        className={styles.textArea}
        placeholder={t('description.placeholder')}
        ref={textAreaRef}
        value={value}
        onBlur={handleSave}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    );
  }

  if (!description) {
    return (
      <Text className={styles.placeholder} onClick={handleClick}>
        {t('description.placeholder')}
      </Text>
    );
  }

  return (
    <Text
      className={styles.description}
      ellipsis={{ rows: 2, tooltip: description }}
      onClick={handleClick}
    >
      {description}
    </Text>
  );
});

SourceSetDescription.displayName = 'SourceSetDescription';

export default SourceSetDescription;
