'use client';

import { Button, Flexbox, Icon, Tag, Text, TextArea } from '@lobehub/ui';
import { createStyles, cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { SmilePlus } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EmojiPicker from '@/components/EmojiPicker';
import { AutoSaveHint } from '@/features/EditorCanvas';
import { useDocumentStore } from '@/store/document';
import { editorSelectors } from '@/store/document/slices/editor';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { truncateByWeightedLength } from '@/utils/textLength';

import { PAGE_EDITOR_SCROLL_ROOT_ID } from './constants';
import {
  countDocumentWords,
  extractDocumentOutline,
  normalizeHeadingText,
} from './documentInsights';
import { usePageEditorStore } from './store';

const useStyles = createStyles(({ css, token }) => ({
  chooseEmojiButton: css`
    width: fit-content;
    color: ${cssVar.colorTextSecondary};
    opacity: 0;
    transition: opacity ${token.motionDurationMid} ${token.motionEaseInOut};

    &:hover,
    &:focus-visible {
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 52%, transparent);
    }
  `,
  headingChip: css`
    overflow: hidden;

    max-width: 220px;
    border-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBorder} 28%,
      ${cssVar.colorBorderSecondary} 72%
    );

    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 18%, ${cssVar.colorBgContainer} 82%);

    &:hover,
    &:focus-visible {
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 72%, transparent);
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 44%, ${cssVar.colorBgContainer} 56%);
    }
  `,
  metaPill: css`
    margin-inline: 0;
    border-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBorder} 26%,
      ${cssVar.colorBorderSecondary} 74%
    );
    color: ${cssVar.colorTextSecondary};
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 20%, ${cssVar.colorFillTertiary} 80%);
  `,
  metaRow: css`
    flex-wrap: wrap;
  `,
  root: css`
    gap: 16px;
    padding-block: 22px 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  titleInput: css`
    resize: none;

    inline-size: 100%;
    padding: 0;

    font-size: clamp(34px, 4vw, 46px);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.03em;

    &::selection {
      background: color-mix(in srgb, ${cssVar.colorPrimary} 28%, transparent);
    }

    html[data-theme='dark'] &::selection {
      color: ${cssVar.colorTextLightSolid};
      background: color-mix(in srgb, ${cssVar.colorPrimary} 48%, ${cssVar.colorBgContainer} 52%);
    }

    html[data-theme='dark'] &::selection {
      color: ${cssVar.colorTextLightSolid};
      background: color-mix(in srgb, ${cssVar.colorPrimary} 48%, ${cssVar.colorBgContainer} 52%);
    }
  `,
}));

const TitleSection = memo(() => {
  const { t } = useTranslation('file');
  const { styles, cx } = useStyles();
  const locale = useGlobalStore(globalGeneralSelectors.currentLanguage);

  const [documentId, emoji, title, setEmoji, setTitle, handleTitleSubmit] = usePageEditorStore(
    (s) => [s.documentId, s.emoji, s.title, s.setEmoji, s.setTitle, s.handleTitleSubmit],
  );

  const [content, lastUpdatedTime, saveStatus] = useDocumentStore((s) => [
    documentId ? editorSelectors.content(documentId)(s) : '',
    documentId ? editorSelectors.lastUpdatedTime(documentId)(s) : undefined,
    documentId ? editorSelectors.saveStatus(documentId)(s) : 'idle',
  ]);

  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const wordCount = useMemo(() => countDocumentWords(content || ''), [content]);
  const outlineItems = useMemo(() => extractDocumentOutline(content || ''), [content]);

  const jumpToHeading = useCallback((headingText: string) => {
    const root = document.getElementById(PAGE_EDITOR_SCROLL_ROOT_ID);
    if (!root) return;

    const normalizedTarget = normalizeHeadingText(headingText);
    const headingTarget =
      Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).find(
        (node) => normalizeHeadingText(node.textContent || '') === normalizedTarget,
      ) ||
      Array.from(root.querySelectorAll('p, div, span')).find(
        (node) => normalizeHeadingText(node.textContent || '') === normalizedTarget,
      );

    if (!headingTarget) return;

    headingTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <Flexbox
      className={styles.root}
      style={{ cursor: 'default' }}
      onMouseEnter={() => setIsHoveringTitle(true)}
      onMouseLeave={() => setIsHoveringTitle(false)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {(emoji || showEmojiPicker) && (
        <EmojiPicker
          allowDelete
          locale={locale}
          open={showEmojiPicker}
          shape={'square'}
          size={72}
          title={t('pageEditor.chooseIcon')}
          value={emoji}
          onOpenChange={setShowEmojiPicker}
          onChange={(nextEmoji) => {
            setEmoji(nextEmoji);
            setShowEmojiPicker(false);
          }}
          onDelete={() => {
            setEmoji(undefined);
            setShowEmojiPicker(false);
          }}
        />
      )}

      {!emoji && !showEmojiPicker && (
        <Button
          className={cx(!isHoveringTitle && styles.chooseEmojiButton)}
          icon={<Icon icon={SmilePlus} />}
          size={'small'}
          type={'text'}
          onClick={() => {
            setEmoji('📄');
            setShowEmojiPicker(true);
          }}
        >
          {t('pageEditor.chooseIcon')}
        </Button>
      )}

      <TextArea
        autoSize={{ minRows: 1 }}
        className={styles.titleInput}
        placeholder={t('pageEditor.titlePlaceholder')}
        style={{ resize: 'none' }}
        value={title}
        variant={'borderless'}
        onChange={(e) => {
          const truncated = truncateByWeightedLength(e.target.value, 100);
          setTitle(truncated);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void handleTitleSubmit();
          }
        }}
      />

      <Flexbox gap={8}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.metaRow}
          gap={8}
          style={{ minWidth: 0 }}
        >
          {documentId && <AutoSaveHint documentId={documentId} />}
          {wordCount > 0 && (
            <Tag className={styles.metaPill} size={'small'} variant={'outlined'}>
              {t('pageEditor.wordCount', { wordCount })}
            </Tag>
          )}
          {outlineItems.length > 0 && (
            <Tag className={styles.metaPill} size={'small'} variant={'outlined'}>
              {`# ${outlineItems.length}`}
            </Tag>
          )}
        </Flexbox>
        {lastUpdatedTime && (
          <Text fontSize={13} style={{ color: cssVar.colorTextSecondary }}>
            <span style={{ visibility: saveStatus === 'saving' ? 'hidden' : 'visible' }}>
              {t('pageEditor.editedAt', {
                time: dayjs(lastUpdatedTime).format('MMM D, YYYY h:mm A'),
              })}
            </span>
          </Text>
        )}
        {outlineItems.length > 0 && (
          <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
            {outlineItems.map((item) => (
              <Button
                className={styles.headingChip}
                key={item.id}
                shape={'round'}
                size={'small'}
                variant={'outlined'}
                onClick={() => jumpToHeading(item.text)}
              >
                {item.text}
              </Button>
            ))}
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  );
});

export default TitleSection;
