import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const userRouter = Router();

const userSelect = { id: true, username: true, email: true, avatar: true, banner: true, bio: true, status: true, presence: true, customStatus: true, badges: true, links: true, lastSeen: true, createdAt: true };

userRouter.get('/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.userId } },
      select: userSelect,
      orderBy: { username: 'asc' },
    });
    res.json(users.map((u) => ({ ...u, lastSeen: u.lastSeen.toISOString(), createdAt: u.createdAt.toISOString() })));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) { res.status(400).json({ message: 'Search query required' }); return; }
    const users = await prisma.user.findMany({
      where: { AND: [{ id: { not: req.userId } }, { username: { contains: q } }] },
      select: userSelect,
      take: 20,
    });
    res.json(users.map((u) => ({ ...u, lastSeen: u.lastSeen.toISOString(), createdAt: u.createdAt.toISOString() })));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ ...user, lastSeen: user.lastSeen.toISOString(), createdAt: user.createdAt.toISOString() });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { username, avatar, banner, bio, status, presence, customStatus, badges, links } = req.body;
    const data: any = {};
    if (username) data.username = username;
    if (avatar !== undefined) data.avatar = avatar;
    if (banner !== undefined) data.banner = banner;
    if (bio !== undefined) data.bio = bio;
    if (status) data.status = status;
    if (presence) data.presence = presence;
    if (customStatus !== undefined) data.customStatus = customStatus;
    if (badges !== undefined) data.badges = typeof badges === 'string' ? badges : JSON.stringify(badges);
    if (links !== undefined) data.links = typeof links === 'string' ? links : JSON.stringify(links);

    const user = await prisma.user.update({ where: { id: req.userId }, data, select: userSelect });
    res.json({ ...user, lastSeen: user.lastSeen.toISOString(), createdAt: user.createdAt.toISOString() });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
