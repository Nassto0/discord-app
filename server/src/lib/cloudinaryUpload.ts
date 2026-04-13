import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary is on if either `CLOUDINARY_URL` is set (Render/heroku-style) or all three
 * dashboard variables are set (matches common tutorials).
 */
export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL?.trim()) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

/** v2 reads `CLOUDINARY_URL` automatically; separate keys need an explicit `config` call. */
export function ensureCloudinaryConfig(): void {
  if (process.env.CLOUDINARY_URL?.trim()) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloud_name && api_key && api_secret) {
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  }
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: { folder: string; resourceType?: 'image' | 'video' | 'raw' | 'auto' }
): Promise<{ url: string; publicId: string }> {
  ensureCloudinaryConfig();
  const { folder, resourceType = 'auto' } = options;
  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, use_filename: false, unique_filename: true },
      (error, res) => {
        if (error) reject(error);
        else if (!res?.secure_url || !res.public_id) reject(new Error('Empty Cloudinary response'));
        else resolve({ secure_url: res.secure_url, public_id: res.public_id });
      }
    );
    stream.end(buffer);
  });
  return { url: result.secure_url, publicId: result.public_id };
}
