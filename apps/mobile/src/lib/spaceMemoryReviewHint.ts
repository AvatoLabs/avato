import type { MobileSpaceMemoryReviewHintPreview } from '../types';
import { formatMobileDateTime } from './dateTime';
import type { I18nStore } from './i18n';

export interface MobileSpaceMemoryReviewHintSummary {
  impact: string[];
  meta: string[];
  title: string;
}

export const buildMobileSpaceMemoryReviewHintSummary = (
  reviewHint: MobileSpaceMemoryReviewHintPreview | undefined,
  t: I18nStore['t'],
): MobileSpaceMemoryReviewHintSummary | null => {
  if (!reviewHint || reviewHint.kind !== 'duplicate_published') return null;

  const meta = [t.memorySpaceReviewHintDesc];
  const impact: string[] = [];

  meta.push(t.memorySpaceReviewHintMatchTitle.replace('{name}', reviewHint.match.title));
  if (reviewHint.match.publishedAt) {
    meta.push(
      t.memorySpaceReviewHintPublishedAt.replace(
        '{date}',
        formatMobileDateTime(reviewHint.match.publishedAt),
      ),
    );
  }

  if (reviewHint.mergePreview.updatesTitle) impact.push(t.memorySpaceReviewHintUpdatesTitle);
  if (reviewHint.mergePreview.updatesSummary) impact.push(t.memorySpaceReviewHintUpdatesSummary);
  if (reviewHint.mergePreview.updatesContent) impact.push(t.memorySpaceReviewHintUpdatesContent);
  if (reviewHint.mergePreview.addedSourceCount > 0) {
    impact.push(
      t.memorySpaceReviewHintAddsSources.replace(
        '{count}',
        String(reviewHint.mergePreview.addedSourceCount),
      ),
    );
  }

  return {
    impact,
    meta,
    title: t.memorySpaceReviewHintTitle,
  };
};
