/** Public https origin of this API (no path, no trailing slash). Render sets RENDER_EXTERNAL_URL. */
export function getPublicApiOrigin(): string {
  return (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
}
