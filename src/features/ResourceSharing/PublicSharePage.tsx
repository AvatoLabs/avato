'use client';

import { Button, Center, Flexbox, Input, Markdown, Text } from '@lobehub/ui';
import { TRPCClientError } from '@trpc/client';
import { memo, useState } from 'react';
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
import { decodeBase64, downloadBlob, normalizeExportFileName, XLSX_MIME_TYPE } from '@/utils/documentExport';
import {
  normalizeTableDocument,
  tableDocumentToCsv,
  tableDocumentToSheetData,
  tableDocumentToXlsxBase64,
} from '@/utils/tableDocument';

const SharedTablePreview = memo<{ content?: string | null; metadata?: Record<string, unknown> | null }>(
  ({ content, metadata }) => {
    const sheet = tableDocumentToSheetData(
      normalizeTableDocument(content, metadata?.table, { preferMarkdownContent: true }),
      { activeViewOnly: true },
    );

    if (sheet.columns.length === 0) {
      return null;
    }

    return (
      <Flexbox
        padding={20}
        style={{
          border: '1px solid var(--ant-color-border-secondary)',
          borderRadius: 12,
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
                    borderBottom: '1px solid var(--ant-color-border-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '10px 12px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => (
              <tr key={row.id}>
                {sheet.columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
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
    );
  },
);
SharedTablePreview.displayName = 'SharedTablePreview';

const PublicSharePage = memo(() => {
  const { t } = useTranslation('file');
  const { token } = useParams<{ token: string }>();
  const [inputPassword, setInputPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>();

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
        <Flexbox gap={12} padding={24} style={{ maxWidth: 420, width: '100%' }}>
          <Center>
            <ProductLogo size={40} />
          </Center>
          <Text as={'h2'} style={{ textAlign: 'center' }}>
            {t('publicShare.passwordTitle')}
          </Text>
          <Text style={{ textAlign: 'center' }} type={'secondary'}>
            {t('publicShare.passwordSubtitle')}
          </Text>
          <Input
            autoFocus
            placeholder={t('publicShare.passwordPlaceholder')}
            type="password"
            value={inputPassword}
            onChange={(event) => setInputPassword(event.target.value)}
          />
          <Button type={'primary'} onClick={() => setSubmittedPassword(inputPassword)}>
            {t('publicShare.passwordConfirm')}
          </Button>
        </Flexbox>
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
  const handleDownloadCsv = () => {
    if (!isTableDocument || !('content' in data)) return;

    const table = normalizeTableDocument(
      data.content,
      'metadata' in data ? data.metadata?.table : undefined,
      { preferMarkdownContent: true },
    );
    const csv = `\uFEFF${tableDocumentToCsv(table, { activeViewOnly: true })}`;
    const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'csv');

    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
  };
  const handleDownloadXlsx = () => {
    if (!isTableDocument || !('content' in data)) return;

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
    <Flexbox gap={20} padding={24} style={{ margin: '0 auto', maxWidth: 920 }} width={'100%'}>
      <Flexbox horizontal align={'center'} gap={12}>
        <ProductLogo size={36} />
        <Flexbox gap={2}>
          <Text as={'h2'}>{title}</Text>
          <Text type={'secondary'}>{t(`shared.kind.${data.kind}`)}</Text>
        </Flexbox>
      </Flexbox>

      {description ? <Text type={'secondary'}>{description}</Text> : null}

      <Flexbox horizontal gap={8}>
        {downloadUrl && (
          <Button href={downloadUrl} target={'_blank'} type={'primary'}>
            {t('publicShare.download')}
          </Button>
        )}
        {openInDocsUrl && (
          <Button href={openInDocsUrl}>{t('portal.openInDocEditor')}</Button>
        )}
        {openInFilesUrl && (
          <Button href={openInFilesUrl}>{t('portal.openInFiles')}</Button>
        )}
        {isTableDocument && (
          <Button type={'primary'} onClick={handleDownloadCsv}>
            {t('publicShare.downloadCsv')}
          </Button>
        )}
        {isTableDocument && (
          <Button type={'primary'} onClick={handleDownloadXlsx}>
            {t('publicShare.downloadXlsx')}
          </Button>
        )}
        <Button disabled>
          {t('publicShare.expiresAt', { date: data.expiresAt.toLocaleString() })}
        </Button>
      </Flexbox>

      {isTableDocument ? (
        <SharedTablePreview
          content={'content' in data ? data.content : undefined}
          metadata={'metadata' in data ? data.metadata : undefined}
        />
      ) : 'content' in data && data.content ? (
        <Flexbox
          padding={20}
          style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 12 }}
        >
          <Markdown remarkPluginsAhead={[...documentMarkdownRemarkPlugins]}>
            {data.content}
          </Markdown>
        </Flexbox>
      ) : (
        <Flexbox
          padding={20}
          style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 12 }}
        >
          <Text type={'secondary'}>{t('publicShare.noPreview')}</Text>
        </Flexbox>
      )}
    </Flexbox>
  );
});

PublicSharePage.displayName = 'PublicSharePage';

export default PublicSharePage;
