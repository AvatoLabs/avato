function pad(value: number) {
  return String(value).padStart(2, '0');
}

function resolveDate(value?: string | number | Date | null) {
  if (!value) return null;

  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function formatMobileDate(value?: string | number | Date | null): string {
  const date = resolveDate(value);
  if (!date) return '—';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatMobileDateTime(value?: string | number | Date | null): string {
  const date = resolveDate(value);
  if (!date) return '—';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
