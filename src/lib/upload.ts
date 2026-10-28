export const MAX_UPLOAD_MB = 5 * 1024;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const MAX_FORM_UPLOAD_MB = 300;
export const MAX_FORM_UPLOAD_BYTES = MAX_FORM_UPLOAD_MB * 1024 * 1024;

export const CHUNKED_FROM_BYTES = 8 * 1024 * 1024;

export const MIN_CHUNK_BYTES = 1 * 1024 * 1024;
export const MAX_CHUNK_BYTES = 32 * 1024 * 1024;

export function chunkSizeFor(size: number): number {
  if (size <= 64 * 1024 * 1024) return 4 * 1024 * 1024;
  if (size <= 512 * 1024 * 1024) return 8 * 1024 * 1024;
  return 16 * 1024 * 1024;
}

export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function formatUploadLimit(mb: number): string {
  return mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`;
}
