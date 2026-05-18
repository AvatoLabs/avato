/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@/types/files';

import Item from './Item';

vi.mock('@lobehub/ui', () => ({
  Block: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Center: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ alt }: any) => <img alt={alt} />,
  Tag: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'detail.asset.reviewStatus.archived': 'Archived',
        'detail.asset.reviewStatus.approved': 'Approved',
        'detail.asset.reviewStatus.draft': 'Draft',
        'detail.asset.reviewStatus.label': 'Review status',
        'detail.asset.usagePolicy.restricted': 'Restricted',
        'detail.asset.rendition.preview': 'Preview',
        'detail.asset.classification.brand': 'Brand',
        'detail.asset.audit.file_asset_approved': 'Approved',
        'detail.asset.none': 'None',
      })[key] || key,
  }),
}));

vi.mock('@/components/FileIcon', () => ({
  default: () => <div>file-icon</div>,
}));

vi.mock('@/routes/(main)/home/features/components/Time', () => ({
  default: () => <span>time</span>,
}));

describe('RecentResourceItem', () => {
  it('prioritizes restrictive governance badges over version labels on compact cards', () => {
    render(
      <Item
        file={{
          assetClassification: FileAssetClassification.Brand,
          assetLatestGovernanceAuditAction: 'file_asset_approved',
          assetLatestGovernanceAuditActorDisplayName: 'Ops Team',
          assetLatestGovernanceAuditAfter: { reviewStatus: FileAssetReviewStatus.Approved },
          assetLatestGovernanceAuditAt: new Date('2026-04-05T10:00:00.000Z'),
          assetLatestGovernanceAuditBefore: { reviewStatus: FileAssetReviewStatus.Draft },
          assetLatestGovernanceAuditChangedFields: ['reviewStatus'],
          assetReviewStatus: FileAssetReviewStatus.Archived,
          assetUsagePolicy: FileAssetUsagePolicy.Restricted,
          assetVersionLabel: 'v2',
          chunkCount: 3,
          chunkingError: null,
          chunkingStatus: null,
          createdAt: new Date('2026-04-05T00:00:00.000Z'),
          embeddingError: null,
          embeddingStatus: null,
          fileType: 'application/pdf',
          finishEmbedding: false,
          id: 'file-1',
          name: 'Brand Guide.pdf',
          size: 1024,
          sourceSetIds: [],
          sourceType: 'file',
          updatedAt: new Date('2026-04-05T00:00:00.000Z'),
          url: '/f/file-1',
        }}
      />,
    );

    expect(screen.getByText('Brand Guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('Brand Guide.pdf')).toHaveAttribute('title', 'Brand Guide.pdf');
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveAttribute('title', 'v2 · Brand');
    expect(screen.getByText('Approved · Review status: Approved')).toHaveAttribute(
      'title',
      'Approved · Ops Team · 2026-04-05 18:00 · Review status: Draft -> Approved',
    );
  });

  it('shows rendition summary when compact cards have room', () => {
    render(
      <Item
        file={{
          assetClassification: FileAssetClassification.General,
          assetPrimaryRenditionKind: FileAssetRenditionKind.Preview,
          assetPrimaryRenditionLabel: 'Homepage',
          assetReviewStatus: FileAssetReviewStatus.Approved,
          assetRenditionCount: 2,
          assetUsagePolicy: FileAssetUsagePolicy.Internal,
          chunkCount: 3,
          chunkingError: null,
          chunkingStatus: null,
          createdAt: new Date('2026-04-05T00:00:00.000Z'),
          embeddingError: null,
          embeddingStatus: null,
          fileType: 'application/pdf',
          finishEmbedding: false,
          id: 'file-2',
          name: 'Landing Preview.pdf',
          size: 1024,
          sourceSetIds: [],
          sourceType: 'file',
          updatedAt: new Date('2026-04-05T00:00:00.000Z'),
          url: '/f/file-2',
        }}
      />,
    );

    expect(screen.getByText('Preview · +1')).toHaveAttribute('title', 'Preview · Homepage · +1');
  });
});
