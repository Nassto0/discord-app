import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const userRouter = Router();

const userSelect = {
  id: true, username: true, avatar: true, banner: true, bio: true,
  status: true, presence: true, customStatus: true, badges: true, links: true,
  nassPoints: true, mutedUntil: true, muteReason: true, timeoutUntil: true, timeoutReason: true,
  lastSeen: true, createdAt: true,
};

userRouter.get('/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.userId } },
      select: userSelect,
      orderBy: { username: 'asc' },
    });
    res.json(users.map((u) => ({
      ...u,
      mutedUntil: u.mutedUntil ? u.mutedUntil.toISOString() : null,
      timeoutUntil: u.timeoutUntil ? u.timeoutUntil.toISOString() : null,
      lastSeen: u.lastSeen.toISOString(),
      createdAt: u.createdAt.toISOString(),
    })));
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
    res.json(users.map((u) => ({
      ...u,
      mutedUntil: u.mutedUntil ? u.mutedUntil.toISOString() : null,
      timeoutUntil: u.timeoutUntil ? u.timeoutUntil.toISOString() : null,
      lastSeen: u.lastSeen.toISOString(),
      createdAt: u.createdAt.toISOString(),
    })));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: userSelect });
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    const [follow, block] = await Promise.all([
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.userId!, followingId: targetId } },
      }),
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: targetId } },
      }),
    ]);
    res.json({
      ...user,
      isFollowing: !!follow,
      isBlockedByMe: !!block,
      mutedUntil: user.mutedUntil ? user.mutedUntil.toISOString() : null,
      timeoutUntil: user.timeoutUntil ? user.timeoutUntil.toISOString() : null,
      lastSeen: user.lastSeen.toISOString(),
      createdAt: user.createdAt.toISOString(),
    });
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
    res.json({
      ...user,
      mutedUntil: user.mutedUntil ? user.mutedUntil.toISOString() : null,
      timeoutUntil: user.timeoutUntil ? user.timeoutUntil.toISOString() : null,
      lastSeen: user.lastSeen.toISOString(),
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.post('/:id/follow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    if (targetId === req.userId) { res.status(400).json({ message: 'Cannot follow yourself' }); return; }
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.userId!, followingId: targetId } },
      create: { followerId: req.userId!, followingId: targetId },
      update: {},
    });
    await prisma.notification.create({
      data: {
        userId: targetId,
        type: 'follow',
        data: JSON.stringify({ fromUserId: req.userId }),
      },
    });
    res.json({ following: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.delete('/:id/follow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    await prisma.follow.deleteMany({
      where: { followerId: req.userId!, followingId: targetId },
    });
    res.json({ following: false });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.post('/:id/block', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    if (targetId === req.userId) { res.status(400).json({ message: 'Cannot block yourself' }); return; }
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: targetId } },
      create: { blockerId: req.userId!, blockedId: targetId },
      update: {},
    });
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: req.userId!, followingId: targetId },
          { followerId: targetId, followingId: req.userId! },
        ],
      },
    });
    res.json({ blocked: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.delete('/:id/block', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    await prisma.block.deleteMany({ where: { blockerId: req.userId!, blockedId: targetId } });
    res.json({ blocked: false });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.get('/notifications/list', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(items.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      data: (() => { try { return JSON.parse(n.data); } catch { return n.data; } })(),
    })));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.post('/notifications/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.notification.updateMany({
      where: { id, userId: req.userId! },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
