import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, generateToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { getPublicApiOrigin } from '../lib/publicOrigin';

export const authRouter = Router();

function assetBaseHint(): { assetBaseUrl: string } | Record<string, never> {
  const base = getPublicApiOrigin();
  return base ? { assetBaseUrl: base } : {};
}

const userFields = (u: any) => ({
  id: u.id, username: u.username, email: u.email, avatar: u.avatar, banner: u.banner, bio: u.bio,
  status: u.status, customStatus: u.customStatus, role: u.role || 'user',
  postStreak: u.postStreak || 0, postStreakBest: u.postStreakBest || 0,
  nassPoints: u.nassPoints || 0,
  mutedUntil: u.mutedUntil ? (u.mutedUntil instanceof Date ? u.mutedUntil.toISOString() : u.mutedUntil) : null,
  muteReason: u.muteReason || null,
  timeoutUntil: u.timeoutUntil ? (u.timeoutUntil instanceof Date ? u.timeoutUntil.toISOString() : u.timeoutUntil) : null,
  timeoutReason: u.timeoutReason || null,
  lastSeen: u.lastSeen instanceof Date ? u.lastSeen.toISOString() : u.lastSeen,
  createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
});

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) { res.status(400).json({ message: 'Username, email, and password are required' }); return; }
    if (password.length < 6) { res.status(400).json({ message: 'Password must be at least 6 characters' }); return; }
    if (username.length > 32) { res.status(400).json({ message: 'Username must be 32 characters or less' }); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) { res.status(400).json({ message: 'Username can only contain letters, numbers, dots, hyphens, and underscores' }); return; }

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) { res.status(409).json({ message: existing.email === email ? 'Email already in use' : 'Username already taken' }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { username, email, passwordHash } });
    res.status(201).json({ token: generateToken(user.id), user: userFields(user), ...assetBaseHint() });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ message: 'Email and password are required' }); return; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ message: 'Invalid email or password' }); return; }
    if (user.isBanned) {
      res.status(403).json({ code: 'banned', message: `Ban reason: ${user.banReason || 'Your account has been banned.'}` });
      return;
    }
    if (user.timeoutUntil && user.timeoutUntil > new Date()) {
      const until = user.timeoutUntil.toISOString();
      res.status(403).json({
        code: 'timeout',
        message: `Timeout reason: ${user.timeoutReason || 'You are timed out.'} (until ${until})`,
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ message: 'Invalid email or password' }); return; }

    await prisma.user.update({ where: { id: user.id }, data: { status: 'online', lastSeen: new Date() } });
    res.json({
      token: generateToken(user.id),
      user: { ...userFields(user), status: 'online', lastSeen: new Date().toISOString() },
      ...assetBaseHint(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ ...userFields(user), ...assetBaseHint() });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
