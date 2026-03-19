'use client';

import {
  ActionIcon,
  Block,
  Button,
  Flexbox,
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

import PublishedTime from '@/components/PublishedTime';
import { useToolStore } from '@/store/tool';
import { agentSkillsSelectors } from '@/store/tool/selectors';
import {
  isSkillAggregatorInstallable,
  SkillAggregatorInstallabilityLevel,
  type SkillAggregatorItem,
  type SkillAggregatorSource,
} from '@/types/skillAggregator';

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

const SkillAggregatorListItem = memo<SkillAggregatorItem>(
  ({
    category,
    description,
    downloadCount,
    homepage,
    identifier,
    importIdentifier,
    importUrl,
    installCount,
    installability,
    ownerName,
    sourceLinks,
    sources,
    starCount,
    tags,
    title,
    updatedAt,
    version,
  }) => {
    const { t } = useTranslation(['discover', 'setting']);
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const installed = useToolStore(agentSkillsSelectors.isAgentSkill(importIdentifier));
    const importAgentSkillFromUrl = useToolStore((s) => s.importAgentSkillFromUrl);
    const primaryLink = homepage || sourceLinks[0]?.url;
    const canImport = isSkillAggregatorInstallable(installability);

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
          typeof downloadCount === 'number'
            ? t('aggregator.skills.metrics.downloads').replace(
                '{{count}}',
                formatNumber(downloadCount),
              )
            : undefined,
          typeof installCount === 'number'
            ? t('aggregator.skills.metrics.installs').replace(
                '{{count}}',
                formatNumber(installCount),
              )
            : undefined,
          typeof starCount === 'number'
            ? t('aggregator.skills.metrics.stars').replace('{{count}}', formatNumber(starCount))
            : undefined,
        ].filter((value): value is string => Boolean(value)),
      [downloadCount, installCount, starCount, t],
    );

    const infoTags = useMemo(
      () =>
        [
          category,
          version ? t('aggregator.skills.meta.version', { version }) : undefined,
          ...tags.slice(0, 2),
        ].filter(Boolean),
      [category, tags, t, version],
    );

    const installabilityLabel = useMemo(
      () => t(`aggregator.skills.installability.${installability.level}`),
      [installability.level, t],
    );

    const installabilityDescription = useMemo(() => {
      if (!installability.reason) return installabilityLabel;

      return t(`aggregator.skills.installabilityReason.${installability.reason}`);
    }, [installability.reason, installabilityLabel, t]);

    const handleClick = useCallback(() => {
      if (!primaryLink) return;
      window.open(primaryLink, '_blank', 'noopener,noreferrer');
    }, [primaryLink]);

    const handleImport = useCallback(async () => {
      if (!importUrl || !canImport || loading) return;

      setLoading(true);
      try {
        await importAgentSkillFromUrl({
          identifier: importIdentifier,
          source: 'market',
          url: importUrl,
        });
        message.success(t('setting:agentSkillModal.importSuccess'));
      } catch (error) {
        message.error(
          t('setting:agentSkillModal.importError', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        setLoading(false);
      }
    }, [canImport, importAgentSkillFromUrl, importIdentifier, importUrl, loading, message, t]);

    const handleOpenSource = useCallback(() => {
      if (!primaryLink) return;
      window.open(primaryLink, '_blank', 'noopener,noreferrer');
    }, [primaryLink]);

    const renderSourceTag = (source: SkillAggregatorSource) => {
      const link = sourceLinkMap[source];
      const tag = (
        <Tag size={'small'} variant={source === sources[0] ? 'filled' : 'outlined'}>
          {t(`aggregator.skills.sources.${source}`)}
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
        data-testid="aggregator-skill-item"
        height={'100%'}
        padding={16}
        style={{ overflow: 'hidden', position: 'relative' }}
        variant={'outlined'}
        width={'100%'}
        onClick={handleClick}
      >
        <Flexbox horizontal align={'flex-start'} gap={16} justify={'space-between'} width={'100%'}>
          <Flexbox horizontal gap={12} style={{ overflow: 'hidden' }} title={identifier}>
            <Flexbox
              align={'center'}
              justify={'center'}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: cssVar.colorFillTertiary,
                color: cssVar.colorText,
                fontWeight: 600,
              }}
            >
              {title.charAt(0).toUpperCase()}
            </Flexbox>
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
              </Flexbox>
              <Text ellipsis className={styles.identifier}>
                {identifier}
              </Text>
            </Flexbox>
          </Flexbox>
          <Flexbox horizontal align={'center'} gap={8}>
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
            {canImport ? (
              <Button
                loading={loading}
                size={'small'}
                type={installed ? 'default' : 'primary'}
                onClick={(event) => {
                  stopPropagation(event);
                  void handleImport();
                }}
              >
                {installed
                  ? t('aggregator.skills.actions.installed')
                  : t('aggregator.skills.actions.import')}
              </Button>
            ) : (
              <Tooltip title={installabilityDescription}>
                <Button
                  disabled={!primaryLink}
                  size={'small'}
                  onClick={(event) => {
                    stopPropagation(event);
                    handleOpenSource();
                  }}
                >
                  {t('aggregator.skills.actions.viewSource')}
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
                  installability.level === SkillAggregatorInstallabilityLevel.Verified
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
            {description || t('aggregator.skills.descriptionFallback')}
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
            {updatedAt && (
              <>
                <Clock3Icon className={styles.secondary} size={14} />
                <PublishedTime className={styles.secondary} date={updatedAt} />
              </>
            )}
            {!updatedAt && ownerName && <span className={styles.secondary}>{ownerName}</span>}
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

SkillAggregatorListItem.displayName = 'SkillAggregatorListItem';

export default SkillAggregatorListItem;
