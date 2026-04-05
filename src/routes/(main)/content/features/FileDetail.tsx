'use client';

import {
  type FileAssetClassification,
  type FileAssetMetadata,
  type FileAssetRenditionInfo,
  FileAssetRenditionKind,
  type FileAssetUsagePolicy,
  pickLegacyFileAssetMetadata,
} from '@lobechat/types';
import { ActionIcon, Button, Flexbox, Icon, Tag } from '@lobehub/ui';
import { Descriptions, Divider, Input, Select } from 'antd';
import dayjs from 'dayjs';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useFileStore } from '@/store/file';
import { type FileListItem } from '@/types/files';
import { downloadFile } from '@/utils/client/downloadFile';
import { formatSize } from '@/utils/format';

interface FileDetailProps extends FileListItem {
  showDownloadButton?: boolean;
  showTitle?: boolean;
}

const normalizeRenditionLabel = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const getRenditionFingerprint = (renditions: FileAssetRenditionInfo[]) =>
  [...renditions]
    .map(({ kind, label }) => `${kind}:${normalizeRenditionLabel(label) ?? ''}`)
    .sort()
    .join(',');

const FileDetail = memo<FileDetailProps>((props) => {
  const {
    name,
    embeddingStatus,
    size,
    createdAt,
    updatedAt,
    chunkCount,
    url,
    showDownloadButton = true,
    showTitle = true,
  } = props || {};
  const { t } = useTranslation('file');
  const approveFileAsset = useFileStore((s) => s.approveFileAsset);
  const archiveFileAsset = useFileStore((s) => s.archiveFileAsset);
  const updateFileAssetGovernance = useFileStore((s) => s.updateFileAssetGovernance);
  const useFetchFileAsset = useFileStore((s) => s.useFetchFileAsset);
  const { data: fileAssetState, isLoading: isFileAssetLoading } = useFetchFileAsset(props.id);
  const fileAsset = fileAssetState?.item;
  const canApproveAsset = fileAssetState?.capabilities.canApprove ?? false;
  const canArchiveAsset = fileAssetState?.capabilities.canArchive ?? false;
  const canEditGovernanceAsset = fileAssetState?.capabilities.canEditGovernance ?? false;
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isApprovingAsset, setIsApprovingAsset] = useState(false);
  const [isArchivingAsset, setIsArchivingAsset] = useState(false);
  const [draftClassification, setDraftClassification] =
    useState<FileAssetClassification>('general');
  const [draftUsagePolicy, setDraftUsagePolicy] = useState<FileAssetUsagePolicy>('internal');
  const [draftRightsOwner, setDraftRightsOwner] = useState('');
  const [draftVersionLabel, setDraftVersionLabel] = useState('');
  const [draftVersionVariantOf, setDraftVersionVariantOf] = useState('');
  const [draftRenditions, setDraftRenditions] = useState<FileAssetRenditionInfo[]>([]);

  useEffect(() => {
    setDraftClassification(fileAsset?.classification ?? 'general');
    setDraftUsagePolicy(fileAsset?.usagePolicy ?? 'internal');
    setDraftRightsOwner(fileAsset?.rightsOwner ?? '');
    setDraftVersionLabel(fileAsset?.metadata?.version?.label ?? '');
    setDraftVersionVariantOf(fileAsset?.metadata?.version?.variantOf ?? '');
    setDraftRenditions(
      (fileAsset?.metadata?.renditions ?? []).map((item) => ({
        ...(normalizeRenditionLabel(item.label)
          ? { label: normalizeRenditionLabel(item.label) }
          : {}),
        kind: item.kind as FileAssetRenditionKind,
      })),
    );
  }, [
    fileAsset?.classification,
    fileAsset?.metadata?.renditions,
    fileAsset?.metadata?.version?.label,
    fileAsset?.metadata?.version?.variantOf,
    fileAsset?.rightsOwner,
    fileAsset?.usagePolicy,
    props.id,
  ]);

  const infoItems = [
    { children: name, key: 'name', label: t('detail.basic.filename') },
    { children: formatSize(size), key: 'size', label: t('detail.basic.size') },
    {
      children: name.split('.').pop()?.toUpperCase(),
      key: 'type',
      label: t('detail.basic.type'),
    },

    {
      children: dayjs(createdAt).format('YYYY-MM-DD HH:mm'),
      key: 'createdAt',
      label: t('detail.basic.createdAt'),
    },
    {
      children: dayjs(updatedAt).format('YYYY-MM-DD HH:mm'),
      key: 'updatedAt',
      label: t('detail.basic.updatedAt'),
    },
    {
      children: chunkCount ? (
        <Tag icon={<Icon icon={RESOURCE_ENTRY_ICONS.chunk} />} variant={'filled'}>
          {' '}
          {chunkCount}
        </Tag>
      ) : (
        t('detail.data.noChunk')
      ),
      key: 'chunkCount',
      label: t('detail.data.chunkCount'),
    },
    {
      children: (
        <Tag color={embeddingStatus || 'default'} variant={'filled'}>
          {t(`detail.data.embedding.${embeddingStatus || 'default'}`)}
        </Tag>
      ),
      key: 'embeddingStatus',
      label: t('detail.data.embeddingStatus'),
    },
  ];

  const isAssetDirty =
    draftClassification !== (fileAsset?.classification ?? 'general') ||
    draftUsagePolicy !== (fileAsset?.usagePolicy ?? 'internal') ||
    draftRightsOwner !== (fileAsset?.rightsOwner ?? '') ||
    draftVersionLabel !== (fileAsset?.metadata?.version?.label ?? '') ||
    draftVersionVariantOf !== (fileAsset?.metadata?.version?.variantOf ?? '') ||
    getRenditionFingerprint(draftRenditions) !==
      getRenditionFingerprint(
        (fileAsset?.metadata?.renditions ?? []).map((item) => ({
          ...(normalizeRenditionLabel(item.label)
            ? { label: normalizeRenditionLabel(item.label) }
            : {}),
          kind: item.kind as FileAssetRenditionKind,
        })),
      );

  const assetLabels = useMemo(
    () => ({
      classification: {
        brand: t('detail.asset.classification.brand'),
        finance: t('detail.asset.classification.finance'),
        general: t('detail.asset.classification.general'),
        hr: t('detail.asset.classification.hr'),
        legal: t('detail.asset.classification.legal'),
        product: t('detail.asset.classification.product'),
      },
      reviewStatus: {
        approved: t('detail.asset.reviewStatus.approved'),
        archived: t('detail.asset.reviewStatus.archived'),
        draft: t('detail.asset.reviewStatus.draft'),
      },
      rendition: {
        caption: t('detail.asset.rendition.caption'),
        embedding: t('detail.asset.rendition.embedding'),
        preview: t('detail.asset.rendition.preview'),
        print: t('detail.asset.rendition.print'),
        thumbnail: t('detail.asset.rendition.thumbnail'),
        transcript: t('detail.asset.rendition.transcript'),
        web: t('detail.asset.rendition.web'),
      },
      usagePolicy: {
        internal: t('detail.asset.usagePolicy.internal'),
        public: t('detail.asset.usagePolicy.public'),
        restricted: t('detail.asset.usagePolicy.restricted'),
      },
    }),
    [t],
  );

  const renderAssetValue = (value: string | null | undefined, fallback = t('detail.asset.none')) =>
    value || fallback;

  const renderRenditionTags = (renditions: FileAssetRenditionInfo[]) => {
    if (renditions.length === 0) return t('detail.asset.none');

    return (
      <Flexbox horizontal gap={8}>
        {renditions.map((item) => (
          <Tag key={`${item.kind}:${item.label ?? ''}`} variant={'filled'}>
            {item.label
              ? `${assetLabels.rendition[item.kind]} · ${item.label}`
              : assetLabels.rendition[item.kind]}
          </Tag>
        ))}
      </Flexbox>
    );
  };

  const handleRenditionKindsChange = (value: FileAssetRenditionKind[]) => {
    setDraftRenditions((current) =>
      value.map((kind) => current.find((item) => item.kind === kind) ?? { kind }),
    );
  };

  const handleRenditionLabelChange = (kind: FileAssetRenditionKind, label: string) => {
    setDraftRenditions((current) =>
      current.map((item) =>
        item.kind === kind
          ? {
              ...(normalizeRenditionLabel(label) ? { label: normalizeRenditionLabel(label) } : {}),
              kind: item.kind,
            }
          : item,
      ),
    );
  };

  const buildAssetMetadata = (): FileAssetMetadata | null => {
    const nextMetadata: FileAssetMetadata = {
      ...pickLegacyFileAssetMetadata(fileAsset?.metadata),
      ...(fileAsset?.metadata?.custom ? { custom: fileAsset.metadata.custom } : {}),
      ...(fileAsset?.metadata?.license ? { license: fileAsset.metadata.license } : {}),
      ...(fileAsset?.metadata?.tags ? { tags: fileAsset.metadata.tags } : {}),
    };

    if (draftVersionLabel || draftVersionVariantOf) {
      nextMetadata.version = {
        ...(draftVersionLabel ? { label: draftVersionLabel } : {}),
        ...(draftVersionVariantOf ? { variantOf: draftVersionVariantOf } : {}),
      };
    }

    if (draftRenditions.length > 0) {
      nextMetadata.renditions = draftRenditions.map((item) => ({
        ...(normalizeRenditionLabel(item.label)
          ? { label: normalizeRenditionLabel(item.label) }
          : {}),
        kind: item.kind,
      }));
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : null;
  };

  const assetStatusItems = [
    {
      children: (
        <Tag variant={'filled'}>{assetLabels.reviewStatus[fileAsset?.reviewStatus ?? 'draft']}</Tag>
      ),
      key: 'reviewStatus',
      label: t('detail.asset.reviewStatus.label'),
    },
    ...(fileAsset?.reviewedAt || fileAsset?.reviewedBy
      ? [
          {
            children: fileAsset?.reviewedAt
              ? dayjs(fileAsset.reviewedAt).format('YYYY-MM-DD HH:mm')
              : t('detail.asset.none'),
            key: 'reviewedAt',
            label: t('detail.asset.reviewedAt.label'),
          },
          {
            children: renderAssetValue(fileAsset?.reviewedBy),
            key: 'reviewedBy',
            label: t('detail.asset.reviewedBy.label'),
          },
        ]
      : []),
  ];

  const assetSettingsItems = [
    {
      children: canEditGovernanceAsset ? (
        <Select
          aria-label={t('detail.asset.classification.label')}
          value={draftClassification}
          options={[
            { label: assetLabels.classification.general, value: 'general' },
            { label: assetLabels.classification.brand, value: 'brand' },
            { label: assetLabels.classification.product, value: 'product' },
            { label: assetLabels.classification.legal, value: 'legal' },
            { label: assetLabels.classification.finance, value: 'finance' },
            { label: assetLabels.classification.hr, value: 'hr' },
          ]}
          onChange={(value) => setDraftClassification(value)}
        />
      ) : (
        <Tag variant={'filled'}>{assetLabels.classification[draftClassification]}</Tag>
      ),
      key: 'classification',
      label: t('detail.asset.classification.label'),
    },
    {
      children: canEditGovernanceAsset ? (
        <Select
          aria-label={t('detail.asset.usagePolicy.label')}
          value={draftUsagePolicy}
          options={[
            { label: assetLabels.usagePolicy.internal, value: 'internal' },
            { label: assetLabels.usagePolicy.public, value: 'public' },
            { label: assetLabels.usagePolicy.restricted, value: 'restricted' },
          ]}
          onChange={(value) => setDraftUsagePolicy(value)}
        />
      ) : (
        <Tag variant={'filled'}>{assetLabels.usagePolicy[draftUsagePolicy]}</Tag>
      ),
      key: 'usagePolicy',
      label: t('detail.asset.usagePolicy.label'),
    },
    {
      children: canEditGovernanceAsset ? (
        <Input
          allowClear
          aria-label={t('detail.asset.rightsOwner.label')}
          placeholder={t('detail.asset.rightsOwner.placeholder')}
          value={draftRightsOwner}
          onChange={(event) => setDraftRightsOwner(event.target.value)}
        />
      ) : (
        renderAssetValue(draftRightsOwner)
      ),
      key: 'rightsOwner',
      label: t('detail.asset.rightsOwner.label'),
    },
    {
      children: canEditGovernanceAsset ? (
        <Input
          aria-label={t('detail.asset.version.label')}
          placeholder={t('detail.asset.version.placeholder')}
          value={draftVersionLabel}
          onChange={(event) => setDraftVersionLabel(event.target.value)}
        />
      ) : (
        renderAssetValue(draftVersionLabel)
      ),
      key: 'version',
      label: t('detail.asset.version.label'),
    },
    {
      children: canEditGovernanceAsset ? (
        <Input
          allowClear
          aria-label={t('detail.asset.version.variantOfLabel')}
          placeholder={t('detail.asset.version.variantOfPlaceholder')}
          value={draftVersionVariantOf}
          onChange={(event) => setDraftVersionVariantOf(event.target.value)}
        />
      ) : (
        renderAssetValue(draftVersionVariantOf)
      ),
      key: 'variantOf',
      label: t('detail.asset.version.variantOfLabel'),
    },
    {
      children: canEditGovernanceAsset ? (
        <Flexbox gap={8}>
          <Select
            aria-label={t('detail.asset.rendition.label')}
            mode={'multiple'}
            placeholder={t('detail.asset.rendition.placeholder')}
            value={draftRenditions.map((item) => item.kind)}
            options={[
              { label: assetLabels.rendition.preview, value: FileAssetRenditionKind.Preview },
              { label: assetLabels.rendition.thumbnail, value: FileAssetRenditionKind.Thumbnail },
              { label: assetLabels.rendition.web, value: FileAssetRenditionKind.Web },
              { label: assetLabels.rendition.print, value: FileAssetRenditionKind.Print },
              { label: assetLabels.rendition.transcript, value: FileAssetRenditionKind.Transcript },
              { label: assetLabels.rendition.caption, value: FileAssetRenditionKind.Caption },
              { label: assetLabels.rendition.embedding, value: FileAssetRenditionKind.Embedding },
            ]}
            onChange={(value) => handleRenditionKindsChange(value as FileAssetRenditionKind[])}
          />
          {draftRenditions.map((item) => (
            <Input
              allowClear
              aria-label={`${t('detail.asset.rendition.label')}:${item.kind}`}
              key={item.kind}
              placeholder={t('detail.asset.rendition.labelPlaceholder')}
              value={item.label ?? ''}
              onChange={(event) => handleRenditionLabelChange(item.kind, event.target.value)}
            />
          ))}
        </Flexbox>
      ) : (
        renderRenditionTags(draftRenditions)
      ),
      key: 'renditions',
      label: t('detail.asset.rendition.label'),
    },
  ];

  const handleSaveAsset = async () => {
    try {
      setIsSavingAsset(true);
      await updateFileAssetGovernance(props.id, {
        classification: draftClassification,
        metadata: buildAssetMetadata(),
        rightsOwner: draftRightsOwner || null,
        usagePolicy: draftUsagePolicy,
      });
      message.success(t('detail.asset.saveSuccess'));
    } catch (error) {
      console.error('Failed to save file asset metadata:', error);
      message.error(t('detail.asset.saveFailed'));
    } finally {
      setIsSavingAsset(false);
    }
  };

  const handleApproveAsset = async () => {
    try {
      setIsApprovingAsset(true);
      await approveFileAsset(props.id);
      message.success(t('detail.asset.approveSuccess'));
    } catch (error) {
      console.error('Failed to approve file asset:', error);
      message.error(t('detail.asset.approveFailed'));
    } finally {
      setIsApprovingAsset(false);
    }
  };

  const handleArchiveAsset = async () => {
    try {
      setIsArchivingAsset(true);
      await archiveFileAsset(props.id);
      message.success(t('detail.asset.archiveSuccess'));
    } catch (error) {
      console.error('Failed to archive file asset:', error);
      message.error(t('detail.asset.archiveFailed'));
    } finally {
      setIsArchivingAsset(false);
    }
  };

  const assetActions =
    canEditGovernanceAsset || canApproveAsset || canArchiveAsset ? (
      <Flexbox gap={8}>
        <span>{t('detail.asset.actionsTitle')}</span>
        <Flexbox horizontal align={'center'} gap={8}>
          {canEditGovernanceAsset && (
            <Button
              disabled={!isAssetDirty || isFileAssetLoading}
              loading={isSavingAsset}
              size={'small'}
              onClick={handleSaveAsset}
            >
              {t('detail.asset.save')}
            </Button>
          )}
          {canApproveAsset && fileAsset?.reviewStatus !== 'approved' && (
            <Button
              loading={isApprovingAsset}
              size={'small'}
              type={'primary'}
              onClick={handleApproveAsset}
            >
              {t('detail.asset.approve')}
            </Button>
          )}
          {canArchiveAsset && fileAsset?.reviewStatus !== 'archived' && (
            <Button danger loading={isArchivingAsset} size={'small'} onClick={handleArchiveAsset}>
              {t('detail.asset.archive')}
            </Button>
          )}
        </Flexbox>
      </Flexbox>
    ) : null;

  return (
    <Flexbox>
      <Descriptions
        colon={false}
        column={1}
        items={infoItems}
        labelStyle={{ width: 120 }}
        size={'small'}
        title={showTitle ? t('detail.basic.title') : undefined}
        extra={
          showDownloadButton && url ? (
            <ActionIcon
              icon={RESOURCE_ENTRY_ICONS.download}
              title={t('download', { ns: 'common' })}
              onClick={() => {
                downloadFile(url, name);
              }}
            />
          ) : undefined
        }
      />
      <Divider />
      <Descriptions
        colon={false}
        column={1}
        items={assetStatusItems}
        labelStyle={{ width: 120 }}
        size={'small'}
        title={t('detail.asset.title')}
      />
      <Descriptions
        colon={false}
        column={1}
        items={assetSettingsItems}
        labelStyle={{ width: 120 }}
        size={'small'}
        title={t('detail.asset.settingsTitle')}
      />
      {assetActions && (
        <>
          <Divider />
          {assetActions}
        </>
      )}
    </Flexbox>
  );
});

export default FileDetail;
