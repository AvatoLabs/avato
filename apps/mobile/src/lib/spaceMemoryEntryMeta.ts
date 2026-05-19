import type { MobileSpaceMemoryEntryPreview } from '../types';
import { formatMobileDate, formatMobileDateTime } from './dateTime';
import type { I18nStore } from './i18n';

export interface MobileMetaTagDescriptor {
  label: string;
  tone?: 'accent' | 'neutral' | 'success';
}

interface BuildMobileSpaceMemoryEntryMetaOptions {
  detailedDate?: boolean;
}

export function getMobileSpaceMemoryIntakeLabel(
  t: I18nStore['t'],
  origin?: MobileSpaceMemoryEntryPreview['intake'] extends infer T
    ? T extends { origin?: infer O }
      ? O
      : never
    : never,
) {
  if (origin === 'automation') return t.memorySpaceIntakeAutomation;
  if (origin === 'harness') return t.memorySpaceIntakeHarness;
  if (origin === 'manual') return t.memorySpaceIntakeManual;

  return null;
}

export function getMobileSpaceMemoryRecallLabel(
  t: I18nStore['t'],
  recall?: MobileSpaceMemoryEntryPreview['recall'],
) {
  if (!recall) return null;

  if (recall.recallBlockedReason === 'expired') return t.memorySpaceRecallStateExpired;
  if (recall.recallBlockedReason === 'stale') return t.memorySpaceRecallStateStale;
  if (!recall.recallEnabled || recall.recallBlockedReason === 'disabled') {
    return t.memorySpaceRecallStateDisabled;
  }

  return t.memorySpaceRecallStateActive;
}

export function buildMobileSpaceMemoryEntryMeta(
  entry: MobileSpaceMemoryEntryPreview,
  t: I18nStore['t'],
  { detailedDate = false }: BuildMobileSpaceMemoryEntryMetaOptions = {},
): MobileMetaTagDescriptor[] {
  const tags: MobileMetaTagDescriptor[] = [
    {
      label: t.memorySpaceSourceCount.replace('{count}', String(entry.sourceCount)),
    },
  ];
  const intakeLabel = getMobileSpaceMemoryIntakeLabel(t, entry.intake?.origin);
  const recallLabel = getMobileSpaceMemoryRecallLabel(t, entry.recall);
  const actorName = entry.actor?.name || entry.actor?.username || '';
  const primaryDate = entry.publishedAt || entry.updatedAt;

  if (intakeLabel) {
    tags.push({ label: intakeLabel });
  }

  if (recallLabel) {
    tags.push({
      label: `${t.memorySpaceRecallLabel}: ${recallLabel}`,
      tone: recallLabel === t.memorySpaceRecallStateActive ? 'success' : 'neutral',
    });
  }

  if (actorName) {
    tags.push({
      label: t.memorySpaceActor.replace('{name}', actorName),
    });
  }

  if (primaryDate) {
    tags.push({
      label: (entry.publishedAt ? t.memorySpacePublishedAt : t.memorySpaceUpdatedAt).replace(
        '{date}',
        detailedDate ? formatMobileDateTime(primaryDate) : formatMobileDate(primaryDate),
      ),
    });
  }

  return tags;
}
