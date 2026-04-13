import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const uploadsDir = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
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

export const uploadRouter = Router();

uploadRouter.post('/', authenticateToken, upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename, mimetype: req.file.mimetype });
});

uploadRouter.post('/avatar', authenticateToken, upload.single('avatar'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});
