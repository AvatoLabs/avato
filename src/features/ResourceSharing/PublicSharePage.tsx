'use client';

import { getCanonicalSharedContentKind } from '@lobechat/types';
import {
  Block,
  Button,
  Center,
  DropdownMenu,
  Flexbox,
  Input,
  Markdown,
  Tag,
  Text,
} from '@lobehub/ui';
import { TRPCClientError } from '@trpc/client';
import { createStaticStyles } from 'antd-style';
import { type FormEvent, memo, type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';

import NotFound from '@/components/404';
import { ProductLogo } from '@/components/Branding';
import Loading from '@/components/Loading/BrandTextLoading';
import { buildFilesPreviewPath, buildSourceSetPath } from '@/features/ResourceSpaces/paths';
import { documentMarkdownRemarkPlugins } from '@/libs/markdown/remarkEncodedBreakTag';
import { lambdaClient } from '@/libs/trpc/client';
import { getPageDetailPath, getPageKind, TABLE_PAGE_KIND } from '@/utils/docs';
import {
  decodeBase64,
  downloadBlob,
  normalizeExportFileName,
  XLSX_MIME_TYPE,
} from '@/utils/documentExport';
import { formatDateTime } from '@/utils/format';
import {
  normalizeTableDocument,
  tableDocumentToCsv,
  tableDocumentToSheetData,
  tableDocumentToXlsxBase64,
} from '@/utils/tableDocument';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionBar: css`
    gap: 8px;
    align-items: flex-start;
  `,
  actionGroup: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
  actionWorkbenchBody: css`
    display: grid;
    gap: 12px;
  `,
  actionWorkbenchHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  `,
  actionWorkbenchMeta: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
  actionWorkbenchSummary: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${cssVar.colorTextSecondary};
  `,
  actionWorkbenchTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  `,
  actionWorkbench: css`
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;
    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 72%, transparent);
  `,
  authCard: css`
    width: min(100%, 460px);
    padding: 28px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 94%, ${cssVar.colorBgLayout});
    box-shadow: 0 28px 72px -44px color-mix(in srgb, ${cssVar.colorText} 28%, transparent);
  `,
  authShell: css`
    position: relative;

    overflow: hidden;

    min-height: 100%;
    padding: clamp(20px, 4vw, 40px);

    background:
      radial-gradient(circle at top, rgb(82 149 255 / 9%), transparent 32%),
      linear-gradient(180deg, ${cssVar.colorBgLayout} 0%, ${cssVar.colorBgContainer} 100%);
  `,
  heroCard: css`
    position: relative;

    overflow: hidden;

    padding: clamp(22px, 3vw, 32px);
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 92%, transparent);
    border-radius: 24px;

    background:
      radial-gradient(circle at top right, rgb(82 149 255 / 10%), transparent 36%),
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorBgElevated}) 0%,
        color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorBgLayout}) 100%
      );
    backdrop-filter: blur(16px);
    box-shadow:
      0 28px 72px -48px color-mix(in srgb, ${cssVar.colorText} 26%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
  `,
  heroContent: css`
    position: relative;
    z-index: 1;
    gap: 22px;
  `,
  heroDescription: css`
    max-width: 760px;
    font-size: 15px;
    line-height: 1.7;
  `,
  heroGlow: css`
    pointer-events: none;

    position: absolute;
    inset-block: auto -34%;
    inset-inline: auto -8%;

    aspect-ratio: 1;
    width: min(38vw, 360px);
    border-radius: 999px;

    opacity: 0.78;
    background: color-mix(in srgb, ${cssVar.colorPrimary} 14%, transparent);
    filter: blur(72px);
  `,
  heroMeta: css`
    gap: 8px;
    align-items: center;
  `,
  heroMetaText: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  heroStats: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  `,
  heroStatCard: css`
    padding-block: 14px;
    padding-inline: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 18px;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 76%, transparent);
  `,
  heroStatLabel: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  `,
  heroStatValue: css`
    margin-block-start: 4px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
  `,
  main: css`
    min-height: 100%;
    padding: clamp(20px, 4vw, 40px);
    background:
      radial-gradient(circle at top left, rgb(82 149 255 / 8%), transparent 30%),
      linear-gradient(180deg, ${cssVar.colorBgLayout} 0%, ${cssVar.colorBgContainer} 100%);
  `,
  pageShell: css`
    width: min(100%, 1120px);
    margin-inline: auto;
  `,
  previewBody: css`
    min-height: 0;
  `,
  previewBody_document: css`
    padding: clamp(18px, 2.4vw, 28px);
    background: ${cssVar.colorBgLayout};

    > div {
      width: min(100%, 900px);
      margin-inline: auto;
    }
  `,
  previewBody_empty: css`
    padding: 24px;
  `,
  previewBody_table: css`
    padding: 0;
    background: color-mix(in srgb, ${cssVar.colorBgContainer} 94%, ${cssVar.colorBgLayout});
  `,
  previewPanel: css`
    overflow: hidden;

    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 92%, transparent);
    border-radius: 24px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorBgElevated});
    box-shadow:
      0 24px 64px -44px color-mix(in srgb, ${cssVar.colorText} 22%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
  `,
  previewPanelHeader: css`
    gap: 6px;

    padding-block: 18px;
    padding-inline: 22px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 74%, transparent);
  `,
  previewPanelMeta: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
  previewPanelSummary: css`
    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  previewPanelTitle: css`
    margin: 0;
    font-size: 16px;
    line-height: 1.3;
  `,
  previewPanelVariant: css`
    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  `,
  tableHeaderCell: css`
    position: sticky;
    z-index: 1;
    inset-block-start: 0;

    padding-block: 12px;
    padding-inline: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 13px;
    font-weight: 600;
    text-align: start;
    white-space: nowrap;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorBgElevated});
  `,
  tableShell: css`
    overflow: auto;
    max-height: min(72dvh, 820px);
    padding: 12px;
  `,
  tableWrapper: css`
    border-spacing: 0;
    border-collapse: separate;
    min-width: 100%;
  `,
  tableCell: css`
    padding-block: 12px;
    padding-inline: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 13px;
    white-space: pre-wrap;
    vertical-align: top;
  `,
  tableCell_alt: css`
    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 68%, transparent);
  `,
  title: css`
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.08;
    text-wrap: balance;
  `,
}));

type PreviewPanelVariant = 'document' | 'empty' | 'table';

const PreviewPanel = memo<{
  children: ReactNode;
  meta?: ReactNode;
  summary?: string;
  title: string;
  variant?: PreviewPanelVariant;
}>(({ children, meta, summary, title, variant = 'document' }) => (
  <Block className={styles.previewPanel}>
    <Flexbox className={styles.previewPanelHeader}>
      {meta && <div className={styles.previewPanelMeta}>{meta}</div>}
      <Text as={'h2'} className={styles.previewPanelTitle}>
        {title}
      </Text>
      {summary && <Text className={styles.previewPanelSummary}>{summary}</Text>}
    </Flexbox>
    <div
      className={
        variant === 'table'
          ? styles.previewBody_table
          : variant === 'empty'
            ? styles.previewBody_empty
            : styles.previewBody_document
      }
    >
      {children}
    </div>
  </Block>
));
PreviewPanel.displayName = 'PreviewPanel';

const SharedTablePreview = memo<{
  content?: string | null;
  metadata?: Record<string, unknown> | null;
}>(({ content, metadata }) => {
  const { t } = useTranslation('file');
  const sheet = tableDocumentToSheetData(
    normalizeTableDocument(content, metadata?.table, { preferMarkdownContent: true }),
    { activeViewOnly: true },
  );

  if (sheet.columns.length === 0) {
    return null;
  }

  return (
    <PreviewPanel
      title={t('publicShare.previewTitle')}
      variant={'table'}
      meta={
        <>
          <Tag variant={'outlined'}>{t('shared.kind.document')}</Tag>
          <Text className={styles.previewPanelVariant}>{t('publicShare.previewReadonly')}</Text>
        </>
      }
      summary={t('publicShare.tableSummary', {
        columns: sheet.columns.length,
        rows: sheet.rows.length,
      })}
    >
      <div className={styles.tableShell}>
        <table className={styles.tableWrapper}>
          <thead>
            <tr>
              {sheet.columns.map((column) => (
                <th className={styles.tableHeaderCell} key={column.key}>
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {sheet.columns.map((column) => (
                  <td
                    className={`${styles.tableCell} ${rowIndex % 2 === 1 ? styles.tableCell_alt : ''}`}
                    key={column.key}
                  >
                    {row[column.key] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PreviewPanel>
  );
});
SharedTablePreview.displayName = 'SharedTablePreview';

const PublicSharePage = memo(() => {
  const { t } = useTranslation('file');
  const { token } = useParams<{ token: string }>();
  const [inputPassword, setInputPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>();
  const [passwordValidation, setPasswordValidation] = useState<'required' | null>(null);
  const passwordFeedbackId = useId();

  const { data, error, isLoading } = useSWR(
    token ? ['public-resource-share', token, submittedPassword || ''] : null,
    () =>
      lambdaClient.contentShare.getSharedContentByToken.query({
        password: submittedPassword,
        token: token!,
      }),
    { revalidateOnFocus: false },
  );

  const trpcError = error instanceof TRPCClientError ? error : null;
  const passwordRequired =
    trpcError?.data?.code === 'UNAUTHORIZED' && trpcError.message === 'SHARE_PASSWORD_REQUIRED';
  const trimmedInputPassword = inputPassword.trim();
  const showInvalidPassword =
    passwordRequired &&
    !!submittedPassword &&
    trimmedInputPassword.length > 0 &&
    trimmedInputPassword === submittedPassword;
  const passwordFeedback = showInvalidPassword
    ? t('publicShare.passwordError.invalid')
    : passwordValidation === 'required'
      ? t('publicShare.passwordError.required')
      : undefined;
  const handlePasswordSubmit = () => {
    if (!trimmedInputPassword) {
      setPasswordValidation('required');
      return;
    }

    setPasswordValidation(null);
    setSubmittedPassword(trimmedInputPassword);
  };

  if (isLoading) {
    return (
      <div className={styles.authShell}>
        <Center height={'100%'} width={'100%'}>
          <Loading debugId="public-resource-share" />
        </Center>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className={styles.authShell}>
        <Center height={'100%'} width={'100%'}>
          <Block className={styles.authCard}>
            <Flexbox
              as={'form'}
              gap={14}
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                handlePasswordSubmit();
              }}
            >
              <Center>
                <ProductLogo size={40} />
              </Center>
              <Text as={'h1'} style={{ margin: 0, textAlign: 'center', textWrap: 'balance' }}>
                {t('publicShare.passwordTitle')}
              </Text>
              <Text style={{ textAlign: 'center' }} type={'secondary'}>
                {t('publicShare.passwordSubtitle')}
              </Text>
              <Text as={'label'} htmlFor={'public-share-password'} size={'small'} weight={500}>
                {t('publicShare.passwordLabel')}
              </Text>
              <Input
                autoFocus
                aria-describedby={passwordFeedback ? passwordFeedbackId : undefined}
                aria-invalid={!!passwordFeedback}
                autoComplete={'off'}
                id={'public-share-password'}
                name={'sharePassword'}
                placeholder={t('publicShare.passwordPlaceholder')}
                spellCheck={false}
                type="password"
                value={inputPassword}
                onChange={(event) => {
                  setInputPassword(event.target.value);
                  if (passwordValidation) setPasswordValidation(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handlePasswordSubmit();
                  }
                }}
              />
              {passwordFeedback && (
                <Text
                  as={'p'}
                  id={passwordFeedbackId}
                  role={showInvalidPassword ? 'alert' : 'status'}
                  size={'small'}
                  style={{ margin: 0 }}
                  type={'danger'}
                >
                  {passwordFeedback}
                </Text>
              )}
              <Button type={'primary'} onClick={handlePasswordSubmit}>
                {t('publicShare.passwordConfirm')}
              </Button>
            </Flexbox>
          </Block>
        </Center>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.authShell}>
        <Center height={'100%'} width={'100%'}>
          <NotFound desc={t('publicShare.notFoundDesc')} title={t('publicShare.notFoundTitle')} />
        </Center>
      </div>
    );
  }

  const canonicalKind = getCanonicalSharedContentKind({
    kind: data.kind,
    localId: data.localId,
  });

  const downloadUrl =
    canonicalKind === 'file' && token
      ? `/share/f/${encodeURIComponent(token)}${
          submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : ''
        }`
      : undefined;
  const title = 'title' in data && data.title ? data.title : data.name;
  const description = 'description' in data ? data.description : null;
  const isTableDocument =
    canonicalKind === 'document' &&
    getPageKind('metadata' in data ? data.metadata?.pageKind : undefined) === TABLE_PAGE_KIND;
  const sharedTableSheet = isTableDocument
    ? tableDocumentToSheetData(
        normalizeTableDocument(
          'content' in data ? data.content : undefined,
          'metadata' in data ? data.metadata?.table : undefined,
          { preferMarkdownContent: true },
        ),
        { activeViewOnly: true },
      )
    : null;
  const openInDocsUrl =
    canonicalKind === 'document'
      ? getPageDetailPath(
          data.localId,
          getPageKind('metadata' in data ? data.metadata?.pageKind : undefined),
          data.spaceId,
        )
      : undefined;
  const openInSourceSetUrl =
    canonicalKind === 'source_set' ? buildSourceSetPath(data.spaceId, data.localId) : undefined;
  const openInFilesUrl =
    canonicalKind === 'file'
      ? buildFilesPreviewPath(data.spaceId, data.localId)
      : openInSourceSetUrl;
  const recordSharedExport = async (format: 'csv' | 'xlsx') => {
    if (!token) return;

    try {
      await lambdaClient.contentShare.recordSharedContentExport.mutate({
        format,
        password: submittedPassword,
        token,
      });
    } catch (error) {
      console.error('Failed to record shared content export', error);
    }
  };
  const handleDownloadCsv = async () => {
    if (!isTableDocument || !('content' in data)) return;

    await recordSharedExport('csv');

    const table = normalizeTableDocument(
      data.content,
      'metadata' in data ? data.metadata?.table : undefined,
      { preferMarkdownContent: true },
    );
    const csv = `\uFEFF${tableDocumentToCsv(table, { activeViewOnly: true })}`;
    const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'csv');

    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
  };
  const handleDownloadXlsx = async () => {
    if (!isTableDocument || !('content' in data)) return;

    await recordSharedExport('xlsx');

    const table = normalizeTableDocument(
      data.content,
      'metadata' in data ? data.metadata?.table : undefined,
      { preferMarkdownContent: true },
    );
    const base64Content = tableDocumentToXlsxBase64(table, title, { activeViewOnly: true });
    const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'xlsx');

    downloadBlob(new Blob([decodeBase64(base64Content)], { type: XLSX_MIME_TYPE }), fileName);
  };
  const openActionItems = [
    ...(openInDocsUrl
      ? [
          {
            href: openInDocsUrl,
            key: 'open-in-docs',
            label: t('portal.openInDocEditor'),
            onClick: () => {
              window.open(openInDocsUrl, '_blank', 'noopener,noreferrer');
            },
          },
        ]
      : []),
    ...(openInFilesUrl
      ? [
          {
            href: openInFilesUrl,
            key: 'open-in-files',
            label: t('portal.openInFiles'),
            onClick: () => {
              window.open(openInFilesUrl, '_blank', 'noopener,noreferrer');
            },
          },
        ]
      : []),
  ];
  const exportActionItems = [
    ...(isTableDocument
      ? [
          {
            key: 'download-csv',
            label: t('publicShare.downloadCsv'),
            onClick: handleDownloadCsv,
          },
          {
            key: 'download-xlsx',
            label: t('publicShare.downloadXlsx'),
            onClick: handleDownloadXlsx,
          },
        ]
      : []),
  ];
  const previewSummary = isTableDocument
    ? t('publicShare.tableSummary', {
        columns: sharedTableSheet?.columns.length ?? 0,
        rows: sharedTableSheet?.rows.length ?? 0,
      })
    : 'content' in data && data.content
      ? t('publicShare.previewReadonly')
      : t('publicShare.previewUnavailable');

  return (
    <div className={styles.main}>
      <Flexbox as={'main'} className={styles.pageShell} gap={20} width={'100%'}>
        <Block className={styles.heroCard}>
          <div className={styles.heroGlow} />
          <Flexbox className={styles.heroContent}>
            <Flexbox horizontal align={'flex-start'} gap={14}>
              <ProductLogo size={40} />
              <Flexbox gap={10} style={{ minWidth: 0 }}>
                <Text as={'h1'} className={styles.title}>
                  {title}
                </Text>
                <Flexbox horizontal className={styles.heroMeta} wrap={'wrap'}>
                  <Tag variant={'outlined'}>{t(`shared.kind.${canonicalKind}`)}</Tag>
                  <Text className={styles.heroMetaText}>
                    {t('publicShare.expiresAt', { date: formatDateTime(data.expiresAt) })}
                  </Text>
                </Flexbox>
              </Flexbox>
            </Flexbox>

            <div className={styles.heroStats}>
              <div className={styles.heroStatCard}>
                <div className={styles.heroStatLabel}>{t(`shared.kind.${canonicalKind}`)}</div>
                <div className={styles.heroStatValue}>{previewSummary}</div>
              </div>
            </div>

            {description ? (
              <Text className={styles.heroDescription} type={'secondary'}>
                {description}
              </Text>
            ) : null}

            <Block className={styles.actionWorkbench}>
              <div className={styles.actionWorkbenchBody}>
                <div className={styles.actionWorkbenchHeader}>
                  <Text className={styles.actionWorkbenchTitle}>
                    {t('publicShare.moreActions')}
                  </Text>
                  <div className={styles.actionWorkbenchMeta}>
                    <Text className={styles.actionWorkbenchSummary}>{previewSummary}</Text>
                  </div>
                </div>
                <Flexbox horizontal className={styles.actionBar} wrap={'wrap'}>
                  <div className={styles.actionGroup}>
                    {downloadUrl && (
                      <Button href={downloadUrl} target={'_blank'} type={'primary'}>
                        {t('publicShare.download')}
                      </Button>
                    )}
                    {openActionItems.length === 1 ? (
                      <Button
                        href={openActionItems[0].href}
                        onClick={() => void openActionItems[0].onClick?.()}
                      >
                        {openActionItems[0].label}
                      </Button>
                    ) : openActionItems.length > 1 ? (
                      <DropdownMenu nativeButton items={openActionItems} placement="bottomRight">
                        <Button>{t('publicShare.moreActions')}</Button>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  {exportActionItems.length > 0 && (
                    <div className={styles.actionGroup}>
                      <DropdownMenu nativeButton items={exportActionItems} placement="bottomRight">
                        <Button>{t('publicShare.exportActions')}</Button>
                      </DropdownMenu>
                    </div>
                  )}
                </Flexbox>
              </div>
            </Block>
          </Flexbox>
        </Block>

        {isTableDocument ? (
          <SharedTablePreview
            content={'content' in data ? data.content : undefined}
            metadata={'metadata' in data ? data.metadata : undefined}
          />
        ) : 'content' in data && data.content ? (
          <PreviewPanel
            summary={previewSummary}
            title={t('publicShare.previewTitle')}
            meta={
              <>
                <Tag variant={'outlined'}>{t(`shared.kind.${canonicalKind}`)}</Tag>
                <Text className={styles.previewPanelVariant}>
                  {t('publicShare.previewReadonly')}
                </Text>
              </>
            }
          >
            <div className={styles.previewBody}>
              <Markdown remarkPluginsAhead={[...documentMarkdownRemarkPlugins]}>
                {data.content}
              </Markdown>
            </div>
          </PreviewPanel>
        ) : (
          <PreviewPanel
            summary={previewSummary}
            title={t('publicShare.previewTitle')}
            variant={'empty'}
            meta={
              <>
                <Tag variant={'outlined'}>{t(`shared.kind.${canonicalKind}`)}</Tag>
                <Text className={styles.previewPanelVariant}>
                  {t('publicShare.previewUnavailable')}
                </Text>
              </>
            }
          >
            <Text type={'secondary'}>{t('publicShare.noPreview')}</Text>
          </PreviewPanel>
        )}
      </Flexbox>
    </div>
  );
});

PublicSharePage.displayName = 'PublicSharePage';

export default PublicSharePage;
