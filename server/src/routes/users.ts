import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const userRouter = Router();
const db = prisma as any;

const userSelect = {
  id: true, username: true, avatar: true, banner: true, bio: true,
  status: true, presence: true, customStatus: true, badges: true, links: true,
  nassPoints: true, mutedUntil: true, muteReason: true, timeoutUntil: true, timeoutReason: true,
  lastSeen: true, createdAt: true,
};

userRouter.get('/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // Only return accepted friends
    const friendships = await db.friendRequest.findMany({
      where: { status: 'accepted', OR: [{ senderId: userId }, { receiverId: userId }] },
    });
    const friendIds = friendships.map((fr: any) => fr.senderId === userId ? fr.receiverId : fr.senderId);
    if (friendIds.length === 0) { res.json([]); return; }
    const users = await prisma.user.findMany({
      where: { id: { in: friendIds } },
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
    if (!q || q.trim().length < 2) { res.status(400).json({ message: 'Search query must be at least 2 characters' }); return; }

    // Get IDs of users who have blocked the requester or whom the requester blocked
    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = new Set<string>();
    for (const b of blocks) {
      if (b.blockerId === req.userId) blockedIds.add(b.blockedId);
      else blockedIds.add(b.blockerId);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.userId } },
          { username: { contains: q } },
          { isBanned: false },
          blockedIds.size > 0 ? { id: { notIn: [...blockedIds] } } : {},
        ],
      },
      select: { id: true, username: true, avatar: true, status: true, customStatus: true, lastSeen: true },
      take: 20,
    });
    res.json(users.map((u) => ({
      ...u,
      lastSeen: u.lastSeen.toISOString(),
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
    const [follow, block, followersCount, followingCount] = await Promise.all([
      db.follow.findUnique({
        where: { followerId_followingId: { followerId: req.userId!, followingId: targetId } },
      }),
      db.block.findUnique({
        where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: targetId } },
      }),
      db.follow.count({ where: { followingId: targetId } }),
      db.follow.count({ where: { followerId: targetId } }),
    ]);
    res.json({
      ...user,
      isFollowing: !!follow,
      isBlockedByMe: !!block,
      followersCount,
      followingCount,
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
    await db.follow.upsert({
      where: { followerId_followingId: { followerId: req.userId!, followingId: targetId } },
      create: { followerId: req.userId!, followingId: targetId },
      update: {},
    });
    await db.notification.create({
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
    await db.follow.deleteMany({
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
    await db.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: targetId } },
      create: { blockerId: req.userId!, blockedId: targetId },
      update: {},
    });
    await db.follow.deleteMany({
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
    await db.block.deleteMany({ where: { blockerId: req.userId!, blockedId: targetId } });
    res.json({ blocked: false });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

userRouter.get('/notifications/list', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const items = await db.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(items.map((n: any) => ({
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
    await db.notification.updateMany({
      where: { id, userId: req.userId! },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
