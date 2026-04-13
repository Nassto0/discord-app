import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'discord-app-secret-key-change-in-production';

if (JWT_SECRET === 'discord-app-secret-key-change-in-production' && process.env.NODE_ENV === 'production') {
  console.error('WARNING: Using default JWT secret in production! Set JWT_SECRET env variable.');
}

export interface AuthRequest extends Request {
  userId?: string;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isBanned: true, banReason: true, timeoutUntil: true, timeoutReason: true },
    });
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ code: 'banned', message: `Ban reason: ${user.banReason || 'Your account is banned.'}` });
      return;
    }
    if (user.timeoutUntil && user.timeoutUntil > new Date()) {
      res.status(403).json({
        code: 'timeout',
        message: `Timeout reason: ${user.timeoutReason || 'You are timed out.'} (until ${user.timeoutUntil.toISOString()})`,
      });
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
}

export async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isBanned: true, banReason: true, timeoutUntil: true, timeoutReason: true },
    });
    if (!user) {
      return next(new Error('User not found'));
    }
    if (user.isBanned) {
      return next(new Error(`Ban reason: ${user.banReason || 'Account banned'}`));
    }
    if (user.timeoutUntil && user.timeoutUntil > new Date()) {
      return next(new Error(`Timeout reason: ${user.timeoutReason || 'You are timed out.'}`));
    }
    (socket as any).userId = decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export { prisma, JWT_SECRET };
