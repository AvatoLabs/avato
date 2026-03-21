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
import { lambdaClient } from '@/libs/trpc/client';

const PublicSharePage = memo(() => {
  const { t } = useTranslation('file');
  const { token } = useParams<{ token: string }>();
  const [inputPassword, setInputPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>();

  const { data, error, isLoading } = useSWR(
    token ? ['public-resource-share', token, submittedPassword || ''] : null,
    () =>
      lambdaClient.resourceShare.getSharedResourceByToken.query({
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
        <Button disabled>
          {t('publicShare.expiresAt', { date: data.expiresAt.toLocaleString() })}
        </Button>
      </Flexbox>

      {'content' in data && data.content ? (
        <Flexbox
          padding={20}
          style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 12 }}
        >
          <Markdown>{data.content}</Markdown>
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
