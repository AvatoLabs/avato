'use client';

import { Github } from '@lobehub/icons';
import {
  ActionIcon,
  Avatar,
  Block,
  Button,
  Flexbox,
  Icon,
  stopPropagation,
  Tag,
  Text,
  Tooltip,
} from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { Clock3Icon, Network } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import OfficialIcon from '@/components/OfficialIcon';
import PublishedTime from '@/components/PublishedTime';
import { pluginSelectors } from '@/store/tool/selectors';
import { useToolStore } from '@/store/tool/store';
import {
  AggregatorInstallabilityLevel,
  type AggregatorItem,
  type AggregatorSource,
  isAggregatorInstallable,
} from '@/types/aggregator';

const styles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    flex: 1;
    margin: 0 !important;
    color: ${cssVar.colorTextSecondary};
  `,
  footer: css`
    margin-block-start: 16px;
    border-block-start: 1px dashed ${cssVar.colorBorder};
    background: ${cssVar.colorBgContainer};
  `,
  identifier: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  secondary: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  title: css`
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 500 !important;

    &:hover {
      color: ${cssVar.colorLink};
    }
  `,
}));

const formatNumber = (value: number) => value.toLocaleString();

const AggregatorListItem = memo<AggregatorItem>(
  ({
    badges,
    createdAt,
    description,
    homepage,
    icon,
    identifier,
    installCount,
    installability,
    isOfficial,
    isRemote,
    isVerified,
    repositoryUrl,
    sourceLinks,
    sources,
    starCount,
    title,
    toolCount,
    transportTypes,
    updatedAt,
  }) => {
    const { t } = useTranslation(['discover', 'plugin']);
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const primaryLink = homepage || sourceLinks[0]?.url || repositoryUrl;
    const publishedAt = updatedAt || createdAt;
    const installSchema = installability.installSchema;
    const installIdentifier = installSchema?.identifier || '';
    const installed = useToolStore(pluginSelectors.isPluginInstalled(installIdentifier));
    const installCustomPlugin = useToolStore((s) => s.installCustomPlugin);
    const testMcpConnection = useToolStore((s) => s.testMcpConnection);
    const canInstall = isAggregatorInstallable(installability) && Boolean(installSchema);

    const sourceLinkMap = useMemo(
      () =>
        sourceLinks.reduce<Record<string, string>>((acc, item) => {
          acc[item.source] = item.url;
          return acc;
        }, {}),
      [sourceLinks],
    );

    const metricItems = useMemo(
      () =>
        [
          typeof installCount === 'number'
            ? t('aggregator.metrics.usage').replace('{{count}}', formatNumber(installCount))
            : undefined,
          typeof starCount === 'number'
            ? t('aggregator.metrics.stars').replace('{{count}}', formatNumber(starCount))
            : undefined,
          typeof toolCount === 'number'
            ? t('aggregator.metrics.tools').replace('{{count}}', formatNumber(toolCount))
            : undefined,
        ].filter((value): value is string => Boolean(value)),
      [installCount, starCount, t, toolCount],
    );

    const installabilityLabel = useMemo(
      () => t(`aggregator.installability.${installability.level}`),
      [installability.level, t],
    );

    const installabilityDescription = useMemo(() => {
      if (!installability.reason) return installabilityLabel;

      return t(`aggregator.installabilityReason.${installability.reason}`);
    }, [installability.reason, installabilityLabel, t]);

    const infoTags = useMemo(
      () =>
        [
          isRemote ? t('aggregator.meta.remote') : undefined,
          isVerified && !isOfficial ? t('aggregator.meta.verified') : undefined,
          ...transportTypes.slice(0, 2),
          ...badges.slice(0, 2),
        ].filter(Boolean),
      [badges, isOfficial, isRemote, isVerified, t, transportTypes],
    );

    const handleClick = useCallback(() => {
      if (!primaryLink) return;
      window.open(primaryLink, '_blank', 'noopener,noreferrer');
    }, [primaryLink]);

    const handleInstall = useCallback(async () => {
      if (!installSchema || !canInstall || loading) return;

      setLoading(true);
      try {
        const testResult = await testMcpConnection({
          connection: installSchema.config,
          identifier: installSchema.identifier,
          metadata: {
            avatar: installSchema.icon,
            description: installSchema.description,
            name: installSchema.name,
          },
        });

        if (!testResult.success || !testResult.manifest) {
          throw new Error(
            testResult.error || t('aggregator.installabilityReason.verificationFailed'),
          );
        }

        await installCustomPlugin({
          customParams: {
            avatar: installSchema.icon,
            description: installSchema.description,
            mcp: {
              ...installSchema.config,
              headers:
                installSchema.config.type === 'http' ? installSchema.config.headers : undefined,
            },
          },
          identifier: installSchema.identifier,
          manifest: testResult.manifest,
          type: 'customPlugin',
        });

        message.success(
          t('plugin:protocolInstall.messages.installSuccess', { name: installSchema.name }),
        );
      } catch (error) {
        message.error(
          t('plugin:mcpInstall.installError', {
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        setLoading(false);
      }
    }, [canInstall, installCustomPlugin, installSchema, loading, message, t, testMcpConnection]);

    const renderSourceTag = (source: AggregatorSource) => {
      const link = sourceLinkMap[source];
      const tag = (
        <Tag size={'small'} variant={source === sources[0] ? 'filled' : 'outlined'}>
          {t(`aggregator.sources.${source}`)}
        </Tag>
      );

      if (!link) return <span key={source}>{tag}</span>;

      return (
        <a
          href={link}
          key={source}
          rel="noopener noreferrer"
          target={'_blank'}
          onClick={stopPropagation}
        >
          {tag}
        </a>
      );
    };

    return (
      <Block
        clickable={Boolean(primaryLink)}
        data-testid="aggregator-item"
        height={'100%'}
        padding={16}
        variant={'outlined'}
        width={'100%'}
        style={{
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={handleClick}
      >
        <Flexbox horizontal align={'flex-start'} gap={16} justify={'space-between'} width={'100%'}>
          <Flexbox horizontal gap={12} style={{ overflow: 'hidden' }} title={identifier}>
            <Avatar avatar={icon || title} shape={'square'} size={40} style={{ flex: 'none' }} />
            <Flexbox flex={1} gap={4} style={{ overflow: 'hidden' }}>
              <Flexbox horizontal align={'center'} gap={8} style={{ overflow: 'hidden' }}>
                {primaryLink ? (
                  <a
                    href={primaryLink}
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', overflow: 'hidden' }}
                    target={'_blank'}
                    onClick={stopPropagation}
                  >
                    <Text ellipsis as={'h2'} className={styles.title}>
                      {title}
                    </Text>
                  </a>
                ) : (
                  <Text ellipsis as={'h2'} className={styles.title}>
                    {title}
                  </Text>
                )}
                {isOfficial && (
                  <Tooltip title={t('isOfficial')}>
                    <OfficialIcon />
                  </Tooltip>
                )}
              </Flexbox>
              <Text ellipsis className={styles.identifier}>
                {identifier}
              </Text>
            </Flexbox>
          </Flexbox>
          <Flexbox horizontal align={'center'} gap={4}>
            {homepage && (
              <a
                href={homepage}
                rel="noopener noreferrer"
                target={'_blank'}
                onClick={stopPropagation}
              >
                <ActionIcon fill={cssVar.colorTextDescription} icon={Network} />
              </a>
            )}
            {repositoryUrl && (
              <a
                href={repositoryUrl}
                rel="noopener noreferrer"
                target={'_blank'}
                onClick={stopPropagation}
              >
                <ActionIcon fill={cssVar.colorTextDescription} icon={Github} />
              </a>
            )}
            {canInstall ? (
              <Button
                disabled={installed}
                loading={loading}
                size={'small'}
                type={installed ? 'default' : 'primary'}
                onClick={(event) => {
                  stopPropagation(event);
                  void handleInstall();
                }}
              >
                {installed ? t('aggregator.actions.installed') : t('aggregator.actions.install')}
              </Button>
            ) : (
              <Tooltip title={installabilityDescription}>
                <Button
                  disabled={!primaryLink}
                  size={'small'}
                  onClick={(event) => {
                    stopPropagation(event);
                    if (!primaryLink) return;
                    window.open(primaryLink, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {t('aggregator.actions.viewSource')}
                </Button>
              </Tooltip>
            )}
          </Flexbox>
        </Flexbox>
        <Flexbox flex={1} gap={12} style={{ marginTop: 16 }}>
          <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
            {sources.map(renderSourceTag)}
            <Tooltip title={installabilityDescription}>
              <Tag
                size={'small'}
                variant={
                  installability.level === AggregatorInstallabilityLevel.Verified
                    ? 'filled'
                    : 'outlined'
                }
              >
                {installabilityLabel}
              </Tag>
            </Tooltip>
            {infoTags.map((item) => (
              <Tag key={item} size={'small'} variant={'outlined'}>
                {item}
              </Tag>
            ))}
          </Flexbox>
          <Text
            as={'p'}
            className={styles.description}
            ellipsis={{
              rows: 3,
            }}
          >
            {description || t('aggregator.descriptionFallback')}
          </Text>
        </Flexbox>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.footer}
          justify={'space-between'}
          padding={16}
          style={{ marginBottom: -16, marginInline: -16 }}
        >
          <Flexbox horizontal align={'center'} gap={4}>
            {publishedAt && (
              <>
                <Icon className={styles.secondary} icon={Clock3Icon} size={14} />
                <PublishedTime className={styles.secondary} date={publishedAt} />
              </>
            )}
          </Flexbox>
          <Flexbox horizontal align={'center'} className={styles.secondary} gap={12}>
            {metricItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </Flexbox>
        </Flexbox>
      </Block>
    );
  },
);

AggregatorListItem.displayName = 'AggregatorListItem';

export default AggregatorListItem;
