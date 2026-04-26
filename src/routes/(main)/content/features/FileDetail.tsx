'use client';

import {
  FileAssetClassification,
  type FileAssetMetadata,
  type FileAssetRenditionInfo,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
  pickLegacyFileAssetMetadata,
} from '@lobechat/types';
import { ActionIcon, Block, Button, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { Descriptions, Input, Select } from 'antd';
import { createStyles } from 'antd-style';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import UnsavedChangesGuard from '@/features/EditorCanvas/UnsavedChangesGuard';
import { mutate, useClientDataSWR } from '@/libs/swr';
import { fileService } from '@/services/file';
import { useFileStore } from '@/store/file';
import { type FileListItem } from '@/types/files';
import { downloadFile } from '@/utils/client/downloadFile';
import { formatDateTime, formatSize } from '@/utils/format';

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

const INITIAL_GOVERNANCE_AUDIT_LIMIT = 5;

const useStyles = createStyles(({ css, token }) => ({
  actionBar: css`
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  actionBarActions: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  `,
  actionBarHeader: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  auditList: css`
    display: grid;
    gap: 8px;
  `,
  heroCard: css`
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  heroHeader: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  heroMeta: css`
    display: grid;
    gap: 6px;
    min-width: 0;
    flex: 1;
  `,
  heroStatsGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  `,
  heroStatCard: css`
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
  `,
  heroStatLabel: css`
    color: ${token.colorTextSecondary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  `,
  heroStatValue: css`
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
  `,
  sectionHeader: css`
    display: flex;
    gap: 10px;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  sectionHeaderMeta: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  `,
  sectionHeaderText: css`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${token.colorTextSecondary};
  `,
  section: css`
    display: grid;
    gap: 12px;
  `,
  shell: css`
    display: grid;
    gap: 16px;
    width: min(760px, 100%);
    margin: 0 auto;
    padding: 12px 8px 24px;
  `,
  summaryMeta: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
}));

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
  const { styles } = useStyles();
  const approveFileAsset = useFileStore((s) => s.approveFileAsset);
  const archiveFileAsset = useFileStore((s) => s.archiveFileAsset);
  const updateFileAssetGovernance = useFileStore((s) => s.updateFileAssetGovernance);
  const useFetchFileAsset = useFileStore((s) => s.useFetchFileAsset);
  const { data: fileAssetState, isLoading: isFileAssetLoading } = useFetchFileAsset(props.id);
  const fileAsset = fileAssetState?.item;
  const governanceAuditTrail = fileAssetState?.governanceAuditTrail ?? [];
  const governanceAuditTrailHasMore = fileAssetState?.governanceAuditTrailHasMore ?? false;
  const latestGovernanceAudit = fileAssetState?.latestGovernanceAudit;
  const canApproveAsset = fileAssetState?.capabilities.canApprove ?? false;
  const canArchiveAsset = fileAssetState?.capabilities.canArchive ?? false;
  const canEditGovernanceAsset = fileAssetState?.capabilities.canEditGovernance ?? false;
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isApprovingAsset, setIsApprovingAsset] = useState(false);
  const [isArchivingAsset, setIsArchivingAsset] = useState(false);
  const [draftClassification, setDraftClassification] =
    useState<FileAssetClassification>(FileAssetClassification.General);
  const [draftReviewStatus, setDraftReviewStatus] =
    useState<FileAssetReviewStatus>(FileAssetReviewStatus.Draft);
  const [draftUsagePolicy, setDraftUsagePolicy] =
    useState<FileAssetUsagePolicy>(FileAssetUsagePolicy.Internal);
  const [draftRightsOwner, setDraftRightsOwner] = useState('');
  const [draftVersionLabel, setDraftVersionLabel] = useState('');
  const [draftVersionVariantOf, setDraftVersionVariantOf] = useState('');
  const [draftRenditions, setDraftRenditions] = useState<FileAssetRenditionInfo[]>([]);
  const [governanceAuditLimit, setGovernanceAuditLimit] = useState(INITIAL_GOVERNANCE_AUDIT_LIMIT);
  const hasInitializedExtendedAuditTrail = useRef(false);
  const hasLocalDraftChanges = useRef(false);
  const lastHydratedFileId = useRef<string | null>(null);
  const shouldFetchExtendedGovernanceAuditTrail =
    governanceAuditLimit > INITIAL_GOVERNANCE_AUDIT_LIMIT;
  const {
    data: extendedGovernanceAuditTrail,
    isLoading: isExtendedGovernanceAuditTrailLoading,
    isValidating: isExtendedGovernanceAuditTrailValidating,
  } = useClientDataSWR(
    !props.id || !shouldFetchExtendedGovernanceAuditTrail
      ? null
      : ['fileAssetAuditTrail', props.id],
    () => fileService.getFileAssetAuditTrail(props.id, governanceAuditLimit),
  );

  const resetDraftGovernance = (asset?: typeof fileAsset) => {
    setDraftClassification(asset?.classification ?? FileAssetClassification.General);
    setDraftReviewStatus(asset?.reviewStatus ?? FileAssetReviewStatus.Draft);
    setDraftUsagePolicy(asset?.usagePolicy ?? FileAssetUsagePolicy.Internal);
    setDraftRightsOwner(asset?.rightsOwner ?? '');
    setDraftVersionLabel(asset?.metadata?.version?.label ?? '');
    setDraftVersionVariantOf(asset?.metadata?.version?.variantOf ?? '');
    setDraftRenditions(
      (asset?.metadata?.renditions ?? []).map((item) => ({
        ...(normalizeRenditionLabel(item.label)
          ? { label: normalizeRenditionLabel(item.label) }
          : {}),
        kind: item.kind as FileAssetRenditionKind,
      })),
    );
    hasLocalDraftChanges.current = false;
  };

  useEffect(() => {
    const isNextFile = lastHydratedFileId.current !== props.id;
    if (!isNextFile && hasLocalDraftChanges.current) return;

    resetDraftGovernance(fileAsset);
    lastHydratedFileId.current = props.id;
  }, [
    fileAsset?.classification,
    fileAsset?.metadata?.renditions,
    fileAsset?.metadata?.version?.label,
    fileAsset?.metadata?.version?.variantOf,
    fileAsset?.reviewStatus,
    fileAsset?.rightsOwner,
    fileAsset?.usagePolicy,
    props.id,
  ]);

  useEffect(() => {
    setGovernanceAuditLimit(INITIAL_GOVERNANCE_AUDIT_LIMIT);
    hasInitializedExtendedAuditTrail.current = false;
  }, [props.id]);

  useEffect(() => {
    if (!props.id || !shouldFetchExtendedGovernanceAuditTrail) return;
    if (!hasInitializedExtendedAuditTrail.current) {
      hasInitializedExtendedAuditTrail.current = true;
      return;
    }

    void mutate(['fileAssetAuditTrail', props.id]);
  }, [governanceAuditLimit, props.id, shouldFetchExtendedGovernanceAuditTrail]);

  const infoItems = [
    { children: name, key: 'name', label: t('detail.basic.filename') },
    {
      children: formatDateTime(createdAt),
      key: 'createdAt',
      label: t('detail.basic.createdAt'),
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
    draftReviewStatus !== (fileAsset?.reviewStatus ?? 'draft') ||
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
      auditAction: {
        file_asset_approved: t('detail.asset.audit.file_asset_approved'),
        file_asset_archived: t('detail.asset.audit.file_asset_archived'),
        file_asset_governance_updated: t('detail.asset.audit.file_asset_governance_updated'),
      },
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

  const displayedGovernanceAuditItems = useMemo(
    () =>
      extendedGovernanceAuditTrail?.items ??
      (governanceAuditTrail.length > 0
        ? governanceAuditTrail
        : latestGovernanceAudit
          ? [latestGovernanceAudit]
          : []),
    [extendedGovernanceAuditTrail?.items, governanceAuditTrail, latestGovernanceAudit],
  );
  const displayedGovernanceAuditHasMore =
    extendedGovernanceAuditTrail?.hasMore ?? governanceAuditTrailHasMore;
  const isLoadingMoreGovernanceAuditTrail =
    shouldFetchExtendedGovernanceAuditTrail &&
    (isExtendedGovernanceAuditTrailLoading || isExtendedGovernanceAuditTrailValidating);

  const renderGovernanceAuditFieldValue = (
    field: string,
    value:
      | FileAssetClassification
      | FileAssetReviewStatus
      | FileAssetUsagePolicy
      | string
      | null
      | undefined,
  ) => {
    switch (field) {
      case 'classification':
        return value
          ? assetLabels.classification[value as FileAssetClassification]
          : t('detail.asset.none');
      case 'reviewStatus':
        return value
          ? assetLabels.reviewStatus[value as FileAssetReviewStatus]
          : t('detail.asset.none');
      case 'usagePolicy':
        return value
          ? assetLabels.usagePolicy[value as FileAssetUsagePolicy]
          : t('detail.asset.none');
      case 'rightsOwner':
        return value || t('detail.asset.none');
      default:
        return value === null || value === undefined || value === ''
          ? t('detail.asset.none')
          : String(value);
    }
  };

  const renderGovernanceAuditLine = (item: (typeof displayedGovernanceAuditItems)[number]) => {
    const fieldLabels: Record<string, string> = {
      classification: t('detail.asset.classification.label'),
      metadata: t('detail.asset.audit.fields.metadata'),
      reviewStatus: t('detail.asset.reviewStatus.label'),
      rightsOwner: t('detail.asset.rightsOwner.label'),
      usagePolicy: t('detail.asset.usagePolicy.label'),
    };

    const changedFieldLabels = item.changedFields.map((field) => fieldLabels[field] ?? field);
    const changedValueLinesByField = new Map<string, string>();
    item.changedFields.forEach((field) => {
      if (field === 'metadata') return;

      const beforeValue = item.before?.[field as keyof typeof item.before];
      const afterValue = item.after?.[field as keyof typeof item.after];
      if (beforeValue === undefined && afterValue === undefined) return;

      changedValueLinesByField.set(
        field,
        `${fieldLabels[field] ?? field}: ${renderGovernanceAuditFieldValue(field, beforeValue as any)} -> ${renderGovernanceAuditFieldValue(field, afterValue as any)}`,
      );
    });
    const changedValueLines = [...changedValueLinesByField.values()];
    const remainingFieldLabels = item.changedFields
      .filter((field) => field === 'metadata' || !changedValueLinesByField.has(field))
      .map((field) => fieldLabels[field] ?? field);

    return (
      <Flexbox
        gap={6}
        key={`${item.action}:${item.createdAt.toISOString()}:${item.actorId ?? 'unknown'}`}
        role={'listitem'}
        style={{
          border: '1px solid rgba(0, 0, 0, 0.06)',
          borderRadius: 8,
          padding: 12,
          position: 'relative',
        }}
      >
        <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
          {item === displayedGovernanceAuditItems[0] && (
            <Tag color={'gold'} variant={'filled'}>
              {t('detail.asset.audit.latestBadge')}
            </Tag>
          )}
          <strong>
            {(assetLabels.auditAction as Record<string, string>)[item.action] ?? item.action}
          </strong>
        </Flexbox>
        <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
          {item.actorDisplayName || item.actorId || t('detail.asset.none')} ·{' '}
          {formatDateTime(item.createdAt)}
        </span>
        {changedValueLines.length > 0 && (
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {changedValueLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {remainingFieldLabels.length > 0 && (
          <span>
            {t('detail.asset.audit.changedFields')}: {remainingFieldLabels.join(', ')}
          </span>
        )}
      </Flexbox>
    );
  };

  const reviewStatusOptions = useMemo(() => {
    const options: Array<{
      disabled?: boolean;
      label: string;
      value: FileAssetReviewStatus;
    }> = [
      {
        label: assetLabels.reviewStatus.draft,
        value: FileAssetReviewStatus.Draft,
      },
    ];

    if (canApproveAsset || fileAsset?.reviewStatus === FileAssetReviewStatus.Approved) {
      options.push({
        disabled: !canApproveAsset,
        label: assetLabels.reviewStatus.approved,
        value: FileAssetReviewStatus.Approved,
      });
    }

    if (canArchiveAsset || fileAsset?.reviewStatus === FileAssetReviewStatus.Archived) {
      options.push({
        disabled: !canArchiveAsset,
        label: assetLabels.reviewStatus.archived,
        value: FileAssetReviewStatus.Archived,
      });
    }

    return options;
  }, [
    assetLabels.reviewStatus.approved,
    assetLabels.reviewStatus.archived,
    assetLabels.reviewStatus.draft,
    canApproveAsset,
    canArchiveAsset,
    fileAsset?.reviewStatus,
  ]);

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
    hasLocalDraftChanges.current = true;
    setDraftRenditions((current) =>
      value.map((kind) => current.find((item) => item.kind === kind) ?? { kind }),
    );
  };

  const handleRenditionLabelChange = (kind: FileAssetRenditionKind, label: string) => {
    hasLocalDraftChanges.current = true;
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
      children: canEditGovernanceAsset ? (
        <Select
          aria-label={t('detail.asset.reviewStatus.label')}
          options={reviewStatusOptions}
          value={draftReviewStatus}
          onChange={(value) => {
            hasLocalDraftChanges.current = true;
            setDraftReviewStatus(value);
          }}
        />
      ) : (
        <Tag variant={'filled'}>{assetLabels.reviewStatus[fileAsset?.reviewStatus ?? 'draft']}</Tag>
      ),
      key: 'reviewStatus',
      label: t('detail.asset.reviewStatus.label'),
    },
    ...(fileAsset?.reviewedAt || fileAsset?.reviewedBy
      ? [
          {
            children: fileAsset?.reviewedAt
              ? formatDateTime(fileAsset.reviewedAt)
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
    ...(displayedGovernanceAuditItems.length > 0
      ? [
          {
            children: (
              <Flexbox gap={8}>
                <div
                  aria-label={t(
                    displayedGovernanceAuditItems.length > 1
                      ? 'detail.asset.audit.recent'
                      : 'detail.asset.audit.latest',
                  )}
                  role={'list'}
                >
                  <Flexbox gap={8}>
                    {displayedGovernanceAuditItems.map(renderGovernanceAuditLine)}
                  </Flexbox>
                </div>
                {displayedGovernanceAuditHasMore && (
                  <Button
                    loading={isLoadingMoreGovernanceAuditTrail}
                    size={'small'}
                    onClick={() => setGovernanceAuditLimit((current) => current + 5)}
                  >
                    {t('loadMore')}
                  </Button>
                )}
              </Flexbox>
            ),
            key: 'governanceAuditTrail',
            label: t(
              displayedGovernanceAuditItems.length > 1
                ? 'detail.asset.audit.recent'
                : 'detail.asset.audit.latest',
            ),
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
          onChange={(value) => {
            hasLocalDraftChanges.current = true;
            setDraftClassification(value);
          }}
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
          onChange={(value) => {
            hasLocalDraftChanges.current = true;
            setDraftUsagePolicy(value);
          }}
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
          onChange={(event) => {
            hasLocalDraftChanges.current = true;
            setDraftRightsOwner(event.target.value);
          }}
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
          onChange={(event) => {
            hasLocalDraftChanges.current = true;
            setDraftVersionLabel(event.target.value);
          }}
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
          onChange={(event) => {
            hasLocalDraftChanges.current = true;
            setDraftVersionVariantOf(event.target.value);
          }}
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
        reviewStatus: draftReviewStatus,
        rightsOwner: draftRightsOwner || null,
        usagePolicy: draftUsagePolicy,
      });
      hasLocalDraftChanges.current = false;
      if (shouldFetchExtendedGovernanceAuditTrail) {
        await mutate(['fileAssetAuditTrail', props.id]);
      }
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
      if (shouldFetchExtendedGovernanceAuditTrail) {
        await mutate(['fileAssetAuditTrail', props.id]);
      }
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
      if (shouldFetchExtendedGovernanceAuditTrail) {
        await mutate(['fileAssetAuditTrail', props.id]);
      }
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
      <div className={styles.actionBar}>
        <div className={styles.actionBarHeader}>
          <Text strong>{t('detail.asset.actionsTitle')}</Text>
          {canEditGovernanceAsset && (
            <Tag
              color={isAssetDirty ? 'gold' : 'success'}
              title={
                isSavingAsset
                  ? t('detail.asset.status.saving')
                  : isAssetDirty
                    ? t('detail.asset.status.unsaved')
                    : t('detail.asset.status.saved')
              }
              variant={'outlined'}
            >
              {isSavingAsset
                ? t('detail.asset.status.saving')
                : isAssetDirty
                  ? t('detail.asset.status.unsaved')
                  : t('detail.asset.status.saved')}
            </Tag>
          )}
        </div>
        <div className={styles.actionBarActions}>
          {canEditGovernanceAsset && (
            <>
              <Button
                disabled={!isAssetDirty || isSavingAsset || isFileAssetLoading}
                size={'small'}
                onClick={() => resetDraftGovernance(fileAsset)}
              >
                {t('detail.asset.reset')}
              </Button>
              <Button
                disabled={!isAssetDirty || isFileAssetLoading}
                loading={isSavingAsset}
                size={'small'}
                onClick={handleSaveAsset}
              >
                {t('detail.asset.save')}
              </Button>
            </>
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
        </div>
      </div>
    ) : null;

  const extensionLabel = name.split('.').pop()?.toUpperCase();
  const basicSectionMeta = [
    extensionLabel && (
      <Tag key={'type'} variant={'outlined'}>
        {extensionLabel}
      </Tag>
    ),
    chunkCount ? (
      <Tag key={'chunks'} icon={<Icon icon={RESOURCE_ENTRY_ICONS.chunk} />} variant={'outlined'}>
        {chunkCount}
      </Tag>
    ) : null,
    <Tag key={'embedding'} variant={'outlined'}>
      {t(`detail.data.embedding.${embeddingStatus || 'default'}`)}
    </Tag>,
  ].filter(Boolean);
  const assetSectionMeta = [
    <Tag key={'review'} variant={'filled'}>
      {assetLabels.reviewStatus[fileAsset?.reviewStatus ?? draftReviewStatus]}
    </Tag>,
    <Tag key={'classification'} variant={'outlined'}>
      {assetLabels.classification[draftClassification]}
    </Tag>,
    <Tag key={'usage'} variant={'outlined'}>
      {assetLabels.usagePolicy[draftUsagePolicy]}
    </Tag>,
    draftRightsOwner ? (
      <Tag key={'owner'} variant={'outlined'}>
        {draftRightsOwner}
      </Tag>
    ) : null,
  ].filter(Boolean);
  const settingsSectionMeta = [
    draftRenditions.length > 0 ? (
      <Tag key={'renditions'} variant={'outlined'}>
        {`${t('detail.asset.rendition.label')} · ${draftRenditions.length}`}
      </Tag>
    ) : null,
  ].filter(Boolean);

  return (
    <Flexbox className={styles.shell}>
      <UnsavedChangesGuard
        isDirty={canEditGovernanceAsset && isAssetDirty}
        message={t('form.unsavedWarning', { ns: 'ui' })}
        title={t('form.unsavedChanges', { ns: 'ui' })}
      />

      <div className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div className={styles.heroMeta}>
            {showTitle && (
              <Text type={'secondary'}>
                {t('detail.basic.title')}
              </Text>
            )}
            <Text as={'h3'} fontSize={18} style={{ margin: 0 }} weight={700}>
              {name}
            </Text>
            <div className={styles.summaryMeta}>
              <Tag variant={'filled'}>
                {assetLabels.reviewStatus[fileAsset?.reviewStatus ?? draftReviewStatus]}
              </Tag>
              <Tag variant={'outlined'}>{assetLabels.classification[draftClassification]}</Tag>
              <Tag variant={'outlined'}>{assetLabels.usagePolicy[draftUsagePolicy]}</Tag>
              {draftRightsOwner && <Tag variant={'outlined'}>{draftRightsOwner}</Tag>}
            </div>
          </div>
          {showDownloadButton && url && (
            <ActionIcon
              aria-label={t('download', { ns: 'common' })}
              icon={RESOURCE_ENTRY_ICONS.download}
              title={t('download', { ns: 'common' })}
              onClick={() => {
                downloadFile(url, name);
              }}
            />
          )}
        </div>

        <div className={styles.heroStatsGrid}>
          <div className={styles.heroStatCard}>
            <Text className={styles.heroStatLabel}>{t('detail.basic.size')}</Text>
            <Text className={styles.heroStatValue}>{formatSize(size)}</Text>
          </div>
          <div className={styles.heroStatCard}>
            <Text className={styles.heroStatLabel}>{t('detail.basic.updatedAt')}</Text>
            <Text className={styles.heroStatValue}>{formatDateTime(updatedAt)}</Text>
          </div>
          <div className={styles.heroStatCard}>
            <Text className={styles.heroStatLabel}>{t('detail.basic.type')}</Text>
            <Text className={styles.heroStatValue}>{name.split('.').pop()?.toUpperCase()}</Text>
          </div>
        </div>
      </div>

      <Block padding={18} variant={'outlined'}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <Text className={styles.sectionHeaderText}>{t('detail.basic.title')}</Text>
            </div>
            <div className={styles.sectionHeaderMeta}>{basicSectionMeta}</div>
          </div>
          <Descriptions
            colon={false}
            column={1}
            items={infoItems}
            labelStyle={{ width: 120 }}
            size={'small'}
          />
        </div>
      </Block>

      <Block padding={18} variant={'outlined'}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <Text className={styles.sectionHeaderText}>{t('detail.asset.title')}</Text>
            </div>
            <div className={styles.sectionHeaderMeta}>{assetSectionMeta}</div>
          </div>
          {assetActions}
          <Descriptions
            colon={false}
            column={1}
            items={[
              ...assetStatusItems.slice(0, 1),
              ...assetStatusItems.slice(1).map((item) =>
                item.key === 'governanceAuditTrail'
                  ? {
                      ...item,
                      children: <div className={styles.auditList}>{item.children}</div>,
                    }
                  : item,
              ),
            ]}
            labelStyle={{ width: 120 }}
            size={'small'}
          />
        </div>
      </Block>

      <Block padding={18} variant={'outlined'}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <Text className={styles.sectionHeaderText}>{t('detail.asset.settingsTitle')}</Text>
            </div>
            <div className={styles.sectionHeaderMeta}>{settingsSectionMeta}</div>
          </div>
          <Descriptions
            colon={false}
            column={1}
            items={assetSettingsItems}
            labelStyle={{ width: 120 }}
            size={'small'}
          />
        </div>
      </Block>
    </Flexbox>
  );
});

export default FileDetail;
