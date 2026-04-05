export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const normalizeExportFileName = (title: string | undefined, extension: string) =>
  `${
    (title || 'Untitled')
      .trim()
      .replaceAll(/[\\/:*?"<>|]+/g, '-')
      .replaceAll(/\s+/g, ' ') || 'Untitled'
  }.${extension}`;

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (const [index, char] of [...binary].entries()) {
    bytes[index] = char.charCodeAt(0);
  }

  return bytes;
};
