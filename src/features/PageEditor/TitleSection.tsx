'use client';

import { Button, Flexbox, Icon, Tag, Text, TextArea } from '@lobehub/ui';
import { createStyles, cssVar } from 'antd-style';
import { FolderOpen, LibraryBig, ListTree, SmilePlus } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import EmojiPicker from '@/components/EmojiPicker';
import { buildPageScopeSearch, createSourceSetPageScope } from '@/features/Pages/usePageScope';
import { useSpaceName } from '@/features/ResourceSpaces';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useDocumentStore } from '@/store/document';
import { editorSelectors } from '@/store/document/slices/editor';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { themedSelectionCss } from '@/styles';
import { getPageKindFromDocument, getPageRootPath } from '@/utils/docs';
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
    cursor: pointer;

    position: relative;

    justify-content: flex-start;

    width: 100%;
    height: auto;
    padding-block: 9px !important;
    padding-inline: 22px 12px !important;
    border: 0;
    border-radius: 12px;

    font: inherit;
    color: inherit;
    text-align: start;

    appearance: none;
    background: transparent;

    &::before {
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0;
      transform: translateY(-50%);

      width: 12px;
      border-block-start: 1px solid
        color-mix(in srgb, ${cssVar.colorTextQuaternary} 44%, ${cssVar.colorBorderSecondary} 56%);
    }

    &:hover,
    &:focus-visible {
      background: color-mix(
        in srgb,
        ${cssVar.colorFillQuaternary} 34%,
        ${cssVar.colorBgContainer} 66%
      );
    }

    html[data-theme='dark'] &:hover,
    html[data-theme='dark'] &:focus-visible {
      background: color-mix(
        in srgb,
        ${cssVar.colorFillSecondary} 42%,
        ${cssVar.colorBgContainer} 58%
      );
    }
  `,
  headingBranch: css`
    position: relative;

    &::before {
      content: '';

      position: absolute;
      inset-block: -4px;
      inset-inline-start: 0;

      width: 1px;

      background: color-mix(in srgb, ${cssVar.colorTextQuaternary} 24%, ${cssVar.colorBorder} 76%);
    }
  `,
  headingText: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    line-height: 1.45;
    color: ${cssVar.colorTextSecondary};
    word-break: break-word;
  `,
  headingTextStrong: css`
    font-weight: 600;
    color: ${cssVar.colorText};
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
  ownershipChip: css`
    cursor: pointer;

    display: inline-flex;
    gap: 8px;
    align-items: center;

    padding-block: 7px;
    padding-inline: 12px;
    border: 1px solid
      color-mix(in srgb, ${cssVar.colorPrimaryBorder} 22%, ${cssVar.colorBorderSecondary} 78%);
    border-radius: 999px;

    color: ${cssVar.colorTextSecondary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 14%, ${cssVar.colorBgContainer} 86%);

    transition:
      transform ${token.motionDurationMid} ${token.motionEaseInOut},
      border-color ${token.motionDurationMid} ${token.motionEaseInOut},
      background ${token.motionDurationMid} ${token.motionEaseInOut},
      color ${token.motionDurationMid} ${token.motionEaseInOut};

    &:hover,
    &:focus-visible {
      transform: translateY(-1px);
      border-color: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBorder} 58%,
        ${cssVar.colorBorderSecondary} 42%
      );
      color: ${cssVar.colorText};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 28%, ${cssVar.colorBgContainer} 72%);
    }
  `,
  ownershipChipAccent: css`
    border-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBorder} 48%,
      ${cssVar.colorBorderSecondary} 52%
    );
    color: ${cssVar.colorPrimary};
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 40%, ${cssVar.colorBgContainer} 60%);
  `,
  ownershipRow: css`
    flex-wrap: wrap;
  `,
  outlineCard: css`
    overflow: hidden;
    gap: 12px;

    min-height: 0;
    padding-block: 14px;
    padding-inline: 16px;
    border: 1px solid
      color-mix(in srgb, ${cssVar.colorTextQuaternary} 10%, ${cssVar.colorBorderSecondary} 90%);
    border-radius: 18px;

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 30%, ${cssVar.colorBgContainer} 70%) 0%,
      ${cssVar.colorBgContainer} 100%
    );
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 55%),
      0 14px 32px rgb(15 23 42 / 4%);

    html[data-theme='dark'] & {
      border-color: rgb(255 255 255 / 6%);
      background: linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorFillSecondary} 32%, ${cssVar.colorBgContainer} 68%) 0%,
        ${cssVar.colorBgContainer} 100%
      );
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 4%),
        0 18px 36px rgb(0 0 0 / 20%);
    }
  `,
  outlineHeader: css`
    flex: none;
    flex-wrap: wrap;
  `,
  outlineList: css`
    scrollbar-gutter: stable;

    overflow: hidden auto;
    display: flex;
    flex-direction: column;
    gap: 4px;

    min-height: 0;
    max-block-size: min(56dvh, 560px);
    padding-inline-end: 4px;

    -webkit-overflow-scrolling: touch;
  `,
  outlineSubtitle: css`
    color: ${cssVar.colorTextDescription};
    text-transform: uppercase;
    letter-spacing: 0.06em;
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

    ${themedSelectionCss()}
  `,
}));

const formatUpdatedAt = (value: Date | string, locale?: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale || undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const TitleSection = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const { styles, cx } = useStyles();
  const navigate = useNavigate();
  const locale = useGlobalStore(globalGeneralSelectors.currentLanguage);

  const [documentId, emoji, title, setEmoji, setTitle, handleTitleSubmit] = usePageEditorStore(
    (s) => [s.documentId, s.emoji, s.title, s.setEmoji, s.setTitle, s.handleTitleSubmit],
  );

  const [content, lastUpdatedTime] = useDocumentStore((s) => [
    documentId ? editorSelectors.content(documentId)(s) : '',
    documentId ? editorSelectors.lastUpdatedTime(documentId)(s) : undefined,
  ]);
  const pageDocument = usePageStore(pageSelectors.getDocumentById(documentId));

  const spaceId = pageDocument?.spaceId ?? undefined;
  const sourceSetId = pageDocument?.sourceSetId ?? undefined;
  const spaceName = useSpaceName(spaceId);
  const sourceSetName = useSourceSetStore(
    sourceSetSelectors.getSourceSetNameById(sourceSetId || ''),
  );

  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const wordCount = useMemo(() => countDocumentWords(content || ''), [content]);
  const outlineItems = useMemo(() => extractDocumentOutline(content || ''), [content]);
  const formattedUpdatedAt = useMemo(
    () => (lastUpdatedTime ? formatUpdatedAt(lastUpdatedTime, locale) : ''),
    [lastUpdatedTime, locale],
  );
  const pageKind = getPageKindFromDocument(pageDocument);
  const docsRootPath = getPageRootPath(pageKind, spaceId);
  const sourceSetDocsPath =
    sourceSetId && spaceId
      ? `${docsRootPath}${buildPageScopeSearch(createSourceSetPageScope(sourceSetId))}`
      : docsRootPath;
  const resolvedSpaceLabel = spaceName || spaceId;
  const resolvedSourceSetLabel = sourceSetName || sourceSetId;

  const jumpToHeading = useCallback((headingText: string, matchIndex: number = 0) => {
    const root = globalThis.document.getElementById(PAGE_EDITOR_SCROLL_ROOT_ID);
    if (!root) return;

    const normalizedTarget = normalizeHeadingText(headingText);
    const headingMatches = Array.from(
      root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'),
    ).filter((node) => normalizeHeadingText(node.textContent || '') === normalizedTarget);
    const headingTarget =
      headingMatches[matchIndex] ||
      headingMatches[0] ||
      Array.from(root.querySelectorAll('p, div, span')).find(
        (node) => normalizeHeadingText(node.textContent || '') === normalizedTarget,
      );

    if (!headingTarget) return;

    headingTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const stopTitleEventPropagation = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
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
          title={t('docEditor.chooseIcon', { ns: 'file' })}
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
          {t('docEditor.chooseIcon', { ns: 'file' })}
        </Button>
      )}

      <TextArea
        autoSize={{ minRows: 1 }}
        className={styles.titleInput}
        placeholder={t('docEditor.titlePlaceholder', { ns: 'file' })}
        style={{ resize: 'none' }}
        value={title}
        variant={'borderless'}
        onBeforeInput={stopTitleEventPropagation as any}
        onChange={(e) => {
          const truncated = truncateByWeightedLength(e.target.value, 100);
          setTitle(truncated);
        }}
        onClick={stopTitleEventPropagation as any}
        onCompositionEnd={stopTitleEventPropagation as any}
        onCompositionStart={stopTitleEventPropagation as any}
        onFocus={stopTitleEventPropagation as any}
        onInput={stopTitleEventPropagation as any}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            void handleTitleSubmit();
          }
        }}
        onKeyUp={stopTitleEventPropagation as any}
        onMouseDown={stopTitleEventPropagation as any}
        onPaste={stopTitleEventPropagation as any}
      />

      <Flexbox gap={8}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.metaRow}
          gap={8}
          style={{ minWidth: 0 }}
        >
          {formattedUpdatedAt && (
            <Tag className={styles.metaPill} size={'small'} variant={'outlined'}>
              {t('docEditor.updatedAt', {
                ns: 'file',
                time: formattedUpdatedAt,
              })}
            </Tag>
          )}
          {spaceName && (
            <Tag className={styles.metaPill} size={'small'} variant={'outlined'}>
              {spaceName}
            </Tag>
          )}
          {wordCount > 0 && (
            <Tag className={styles.metaPill} size={'small'} variant={'outlined'}>
              {t('docEditor.wordCount', { ns: 'file', wordCount })}
            </Tag>
          )}
        </Flexbox>
        {(resolvedSpaceLabel || resolvedSourceSetLabel) && (
          <Flexbox
            horizontal
            align={'center'}
            className={cx(styles.metaRow, styles.ownershipRow)}
            gap={8}
          >
            {resolvedSpaceLabel && (
              <button
                className={styles.ownershipChip}
                type={'button'}
                onClick={() => navigate(docsRootPath)}
              >
                <Icon icon={FolderOpen} size={15} />
                <span>{resolvedSpaceLabel}</span>
              </button>
            )}
            {resolvedSourceSetLabel && sourceSetId && (
              <button
                className={cx(styles.ownershipChip, styles.ownershipChipAccent)}
                type={'button'}
                onClick={() => navigate(sourceSetDocsPath)}
              >
                <Icon icon={LibraryBig} size={15} />
                <span>{resolvedSourceSetLabel}</span>
              </button>
            )}
          </Flexbox>
        )}
        {outlineItems.length > 0 && (
          <Flexbox className={styles.outlineCard}>
            <Flexbox
              horizontal
              align={'center'}
              className={styles.outlineHeader}
              justify={'space-between'}
            >
              <Flexbox gap={2}>
                <Text className={styles.outlineSubtitle} fontSize={11}>
                  {t('docEditor.outline', { ns: 'file' })}
                </Text>
                <Flexbox horizontal align={'center'} gap={8}>
                  <Icon icon={ListTree} size={15} />
                  <Text fontSize={15} style={{ color: cssVar.colorText }}>
                    {t('docEditor.outline', { ns: 'file' })}
                  </Text>
                </Flexbox>
              </Flexbox>
              <Text fontSize={12} style={{ color: cssVar.colorTextDescription }}>
                {`${outlineItems.length}`}
              </Text>
            </Flexbox>
            <div
              aria-label={t('docEditor.outline', { ns: 'file' })}
              className={styles.outlineList}
              role="tree"
              tabIndex={0}
            >
              {outlineItems.map((item, index) => {
                const normalizedText = normalizeHeadingText(item.text);
                const duplicateIndex = outlineItems
                  .slice(0, index)
                  .filter(
                    (outlineItem) => normalizeHeadingText(outlineItem.text) === normalizedText,
                  ).length;
                const levelIndent = Math.max(0, Math.min(item.level, 5) - 2) * 18;

                return (
                  <div
                    aria-level={item.level}
                    className={styles.headingBranch}
                    key={item.id}
                    role="treeitem"
                    style={{ marginInlineStart: levelIndent }}
                  >
                    <button
                      className={styles.headingChip}
                      type={'button'}
                      onClick={() => jumpToHeading(item.text, duplicateIndex)}
                    >
                      <span
                        className={cx(
                          styles.headingText,
                          item.level <= 2 && styles.headingTextStrong,
                        )}
                      >
                        {item.text}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  );
});

export default TitleSection;
