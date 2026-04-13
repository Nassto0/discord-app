import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getPublicApiOrigin } from '../lib/publicOrigin';
import { ensureCloudinaryConfig, isCloudinaryConfigured, uploadBufferToCloudinary } from '../lib/cloudinaryUpload';

const uploadsDir = path.resolve(__dirname, '../../uploads');

const useCloudinary = isCloudinaryConfigured();
if (useCloudinary) ensureCloudinaryConfig();

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || `.${file.mimetype.split('/')[1] || 'bin'}`;
        cb(null, `${uuid()}${ext}`);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function publicUploadUrl(filename: string): string {
  const base = getPublicApiOrigin();
  if (!base) return `/uploads/${filename}`;
  return `${base}/uploads/${filename}`;
}

export const uploadRouter = Router();

uploadRouter.post('/', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }
  const file = req.file as Express.Multer.File & { buffer?: Buffer };
  try {
    if (useCloudinary) {
      if (!Buffer.isBuffer(file.buffer)) {
        res.status(500).json({ message: 'Upload storage misconfigured (missing buffer)' });
        return;
      }
      const { url } = await uploadBufferToCloudinary(file.buffer, {
        folder: 'nasscord/uploads',
        resourceType: 'auto',
      });
      res.json({ url, filename: file.originalname || 'file', mimetype: file.mimetype });
      return;
    }
    if (!file.filename) {
      res.status(500).json({ message: 'Upload storage misconfigured' });
      return;
    }
    res.json({ url: publicUploadUrl(file.filename), filename: file.filename, mimetype: file.mimetype });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

uploadRouter.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }
  const file = req.file as Express.Multer.File & { buffer?: Buffer };
  try {
    if (useCloudinary) {
      if (!Buffer.isBuffer(file.buffer)) {
        res.status(500).json({ message: 'Upload storage misconfigured (missing buffer)' });
        return;
      }
      const { url } = await uploadBufferToCloudinary(file.buffer, {
        folder: 'nasscord/avatars',
        resourceType: 'image',
      });
      res.json({ url });
      return;
    }
    if (!file.filename) {
      res.status(500).json({ message: 'Upload storage misconfigured' });
      return;
    }
    res.json({ url: publicUploadUrl(file.filename) });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});
