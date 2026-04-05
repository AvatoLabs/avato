'use client';

import { Block, Button, Center, Flexbox, Input, Markdown, Tag, Text } from '@lobehub/ui';
import { TRPCClientError } from '@trpc/client';
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
import {
  normalizeTableDocument,
  tableDocumentToCsv,
  tableDocumentToSheetData,
  tableDocumentToXlsxBase64,
} from '@/utils/tableDocument';

const PreviewPanel = memo<{
  children: ReactNode;
  summary?: string;
  title: string;
}>(({ children, summary, title }) => (
  <Block
    padding={20}
    style={{
      border: '1px solid var(--ant-color-border-secondary)',
      borderRadius: 16,
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.04)',
    }}
  >
    <Flexbox gap={16}>
      <Flexbox gap={4}>
        <Text as={'h2'} style={{ fontSize: 16, lineHeight: 1.3, margin: 0 }}>
          {title}
        </Text>
        {summary && (
          <Text fontSize={13} type={'secondary'}>
            {summary}
          </Text>
        )}
      </Flexbox>
      {children}
    </Flexbox>
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
      summary={t('publicShare.tableSummary', {
        columns: sheet.columns.length,
        rows: sheet.rows.length,
      })}
    >
      <Flexbox
        gap={12}
        style={{
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            minWidth: '100%',
          }}
        >
          <thead>
            <tr>
              {sheet.columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    background: 'var(--ant-color-bg-container)',
                    borderBottom: '1px solid var(--ant-color-border-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '10px 12px',
                    position: 'sticky',
                    textAlign: 'left',
                    top: 0,
                    whiteSpace: 'nowrap',
                    zIndex: 1,
                  }}
                >
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
                    key={column.key}
                    style={{
                      background:
                        rowIndex % 2 === 1 ? 'var(--ant-color-fill-quaternary)' : undefined,
                      borderBottom: '1px solid var(--ant-color-border-secondary)',
                      fontSize: 13,
                      padding: '10px 12px',
                      verticalAlign: 'top',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {row[column.key] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Flexbox>
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
      <Center height={'100%'} width={'100%'}>
        <Loading debugId="public-resource-share" />
      </Center>
    );
  }

  if (passwordRequired) {
    return (
      <Center height={'100%'} width={'100%'}>
        <Block
          padding={24}
          style={{
            border: '1px solid var(--ant-color-border-secondary)',
            borderRadius: 20,
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.08)',
            maxWidth: 440,
            width: '100%',
          }}
        >
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
    );
  }

  if (error || !data) {
    return (
      <Center height={'100%'} width={'100%'}>
        <NotFound desc={t('publicShare.notFoundDesc')} title={t('publicShare.notFoundTitle')} />
      </Center>
    );
  }

  const downloadUrl =
    data.kind === 'file' && token
      ? `/share/f/${encodeURIComponent(token)}${
          submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : ''
        }`
      : undefined;
  const title = 'title' in data && data.title ? data.title : data.name;
  const description = 'description' in data ? data.description : null;
  const isTableDocument =
    data.kind === 'document' &&
    getPageKind('metadata' in data ? data.metadata?.pageKind : undefined) === TABLE_PAGE_KIND;
  const openInDocsUrl =
    data.kind === 'document'
      ? getPageDetailPath(
          data.localId,
          getPageKind('metadata' in data ? data.metadata?.pageKind : undefined),
          data.spaceId,
        )
      : undefined;
  const openInSourceSetUrl =
    data.kind === 'source_set' ? buildSourceSetPath(data.spaceId, data.localId) : undefined;
  const openInFilesUrl =
    data.kind === 'file' ? buildFilesPreviewPath(data.spaceId, data.localId) : openInSourceSetUrl;
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

  return (
    <Flexbox
      as={'main'}
      gap={20}
      padding={24}
      style={{ margin: '0 auto', maxWidth: 960 }}
      width={'100%'}
    >
      <Block
        padding={24}
        style={{
          border: '1px solid var(--ant-color-border-secondary)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            background:
              'radial-gradient(circle at top right, var(--ant-color-fill-tertiary), transparent 48%)',
            inset: 0,
            pointerEvents: 'none',
            position: 'absolute',
          }}
        />
        <Flexbox gap={20} style={{ position: 'relative' }}>
          <Flexbox horizontal align={'center'} gap={12}>
            <ProductLogo size={36} />
            <Flexbox gap={2}>
              <Text
                as={'h1'}
                style={{ fontSize: 28, lineHeight: 1.2, margin: 0, textWrap: 'balance' }}
              >
                {title}
              </Text>
              <Flexbox horizontal gap={8} wrap={'wrap'}>
                <Tag variant={'outlined'}>{t(`shared.kind.${data.kind}`)}</Tag>
                <Text fontSize={13} type={'secondary'}>
                  {t('publicShare.expiresAt', { date: data.expiresAt.toLocaleString() })}
                </Text>
              </Flexbox>
            </Flexbox>
          </Flexbox>

          {description ? (
            <Text style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 720 }} type={'secondary'}>
              {description}
            </Text>
          ) : null}

          <Flexbox horizontal gap={8} style={{ alignItems: 'flex-start' }} wrap={'wrap'}>
            {downloadUrl && (
              <Button href={downloadUrl} target={'_blank'} type={'primary'}>
                {t('publicShare.download')}
              </Button>
            )}
            {openInDocsUrl && <Button href={openInDocsUrl}>{t('portal.openInDocEditor')}</Button>}
            {openInFilesUrl && <Button href={openInFilesUrl}>{t('portal.openInFiles')}</Button>}
            {isTableDocument && (
              <Button onClick={handleDownloadCsv}>{t('publicShare.downloadCsv')}</Button>
            )}
            {isTableDocument && (
              <Button onClick={handleDownloadXlsx}>{t('publicShare.downloadXlsx')}</Button>
            )}
          </Flexbox>
        </Flexbox>
      </Block>

      {isTableDocument ? (
        <SharedTablePreview
          content={'content' in data ? data.content : undefined}
          metadata={'metadata' in data ? data.metadata : undefined}
        />
      ) : 'content' in data && data.content ? (
        <PreviewPanel
          summary={t('publicShare.previewReadonly')}
          title={t('publicShare.previewTitle')}
        >
          <Markdown remarkPluginsAhead={[...documentMarkdownRemarkPlugins]}>
            {data.content}
          </Markdown>
        </PreviewPanel>
      ) : (
        <PreviewPanel
          summary={t('publicShare.previewUnavailable')}
          title={t('publicShare.previewTitle')}
        >
          <Text type={'secondary'}>{t('publicShare.noPreview')}</Text>
        </PreviewPanel>
      )}
    </Flexbox>
  );
});

PublicSharePage.displayName = 'PublicSharePage';

export default PublicSharePage;
