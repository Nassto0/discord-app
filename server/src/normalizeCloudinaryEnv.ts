/**
 * Cloudinary's Node SDK reads `CLOUDINARY_URL` when the package loads and throws if it is malformed.
 * Render users sometimes paste `CLOUDINARY_URL=cloudinary://...` into the *value* field; fix or drop
 * before any module imports `cloudinary`.
 */
function normalizeCloudinaryUrl(): void {
  const raw = process.env.CLOUDINARY_URL;
  if (raw == null || raw === '') return;

  let s = String(raw).trim().replace(/^\ufeff/, '');
  s = s.replace(/^CLOUDINARY_URL\s*=\s*/i, '').trim();

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  if (s.startsWith('cloudinary://')) {
    process.env.CLOUDINARY_URL = s;
    return;
  }

  delete process.env.CLOUDINARY_URL;
}

normalizeCloudinaryUrl();
