export const defaultMaxBodyBytes = 10 * 1024 * 1024;

export function maxBodyBytes(): number {
  const configured = Number(process.env.MAX_BODY_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : defaultMaxBodyBytes;
}

export function isBodyTooLarge(request: Request): boolean {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(contentLength) && contentLength > maxBodyBytes();
}

export function isFileTooLarge(file: File): boolean {
  return file.size > maxBodyBytes();
}
