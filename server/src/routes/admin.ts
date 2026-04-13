import { Router, Response, NextFunction } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';
import { forceLogoutUser } from '../socket';

export const adminRouter = Router();

// Middleware: require owner or admin role
async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
}

adminRouter.use(authenticateToken, requireAdmin);

// Dashboard stats
adminRouter.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [users, posts, messages, reports, pendingReports, flaggedMessages, flaggedPosts] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.message.count(),
      prisma.report.count(),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.message.count({ where: { flagged: true } }),
      prisma.post.count({ where: { flagged: true } }),
    ]);
    res.json({ users, posts, messages, reports, pendingReports, flaggedMessages, flaggedPosts });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reports list
adminRouter.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const status = (req.query.status as string) || undefined;
    const reports = await prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reporter: { select: { id: true, username: true, avatar: true } },
      },
    });
    res.json(reports.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update report status
adminRouter.put('/reports/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { status, reviewNote } = req.body;
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status, reviewNote, reviewedBy: req.userId },
    });
    res.json({ ...report, createdAt: report.createdAt.toISOString() });
  } catch (error) {
    console.error('Admin update report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Users list
adminRouter.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, avatar: true, role: true, status: true,
        createdAt: true, lastSeen: true, bio: true, nassPoints: true, mutedUntil: true, muteReason: true, timeoutUntil: true, timeoutReason: true, isBanned: true, banReason: true,
        _count: { select: { posts: true, sentMessages: true } },
      },
    });
    res.json(users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      lastSeen: u.lastSeen.toISOString(),
      postCount: u._count.posts,
      messageCount: u._count.sentMessages,
      mutedUntil: u.mutedUntil ? u.mutedUntil.toISOString() : null,
      timeoutUntil: u.timeoutUntil ? u.timeoutUntil.toISOString() : null,
    })));
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user role
adminRouter.put('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }
    // Only owner can change roles
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
    if (me?.role !== 'owner') {
      res.status(403).json({ message: 'Only owner can change roles' });
      return;
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json({ updated: true });
  } catch (error) {
    console.error('Admin update role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

adminRouter.post('/users/:id/moderate', async (req: AuthRequest, res: Response) => {
  try {
    const { action, reason, minutes } = req.body as { action: 'ban' | 'unban' | 'mute' | 'unmute' | 'timeout' | 'untimeout'; reason: string; minutes?: number };
    if (!action || !reason?.trim()) {
      res.status(400).json({ message: 'Action and reason are required' });
      return;
    }
    const targetId = req.params.id;
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
    if (!me) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!target) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (target.role === 'owner') {
      res.status(403).json({ message: 'Owner account cannot be moderated' });
      return;
    }
    if (target.role === 'admin' && me.role !== 'owner') {
      res.status(403).json({ message: 'Only owner can moderate admins' });
      return;
    }

    const now = Date.now();
    const until = (mins?: number) => new Date(now + Math.max(1, Number(mins || 60)) * 60000);
    const data: Record<string, any> = {};
    if (action === 'ban') {
      data.isBanned = true; data.banReason = reason.trim();
    } else if (action === 'unban') {
      data.isBanned = false; data.banReason = null;
    } else if (action === 'mute') {
      data.mutedUntil = until(minutes); data.muteReason = reason.trim();
    } else if (action === 'unmute') {
      data.mutedUntil = null; data.muteReason = null;
    } else if (action === 'timeout') {
      data.timeoutUntil = until(minutes); data.timeoutReason = reason.trim();
    } else if (action === 'untimeout') {
      data.timeoutUntil = null; data.timeoutReason = null;
    } else {
      res.status(400).json({ message: 'Invalid moderation action' });
      return;
    }

    await prisma.user.update({ where: { id: targetId }, data });
    await prisma.adminAction.create({
      data: { adminId: req.userId!, targetId, action, reason: reason.trim() },
    });
    if (action === 'ban' || action === 'timeout') {
      await forceLogoutUser(targetId, reason.trim());
    }
    res.json({ updated: true });
  } catch (error) {
    console.error('Admin moderate user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

adminRouter.get('/users/:id/actions', async (req: AuthRequest, res: Response) => {
  try {
    const actions = await prisma.adminAction.findMany({
      where: { targetId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { admin: { select: { id: true, username: true } } },
    });
    res.json(actions.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin delete any post
adminRouter.delete('/posts/:id', async (_req: AuthRequest, res: Response) => {
  try {
    await prisma.post.delete({ where: { id: _req.params.id } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin delete any message
adminRouter.delete('/messages/:id', async (_req: AuthRequest, res: Response) => {
  try {
    const msg = await prisma.message.findUnique({ where: { id: _req.params.id } });
    if (!msg) { res.status(404).json({ message: 'Not found' }); return; }
    await prisma.message.delete({ where: { id: _req.params.id } });
    res.json({ deleted: true, conversationId: msg.conversationId });
  } catch (error) {
    console.error('Admin delete message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Flagged content
adminRouter.get('/flagged', async (_req: AuthRequest, res: Response) => {
  try {
    const [messages, posts] = await Promise.all([
      prisma.message.findMany({
        where: { flagged: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { sender: { select: { id: true, username: true, avatar: true } } },
      }),
      prisma.post.findMany({
        where: { flagged: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { author: { select: { id: true, username: true, avatar: true } } },
      }),
    ]);
    res.json({
      messages: messages.map((m) => ({ ...m, readBy: undefined, reactions: undefined, createdAt: m.createdAt.toISOString() })),
      posts: posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error('Admin flagged error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get streaks for all DMs (admin view)
adminRouter.get('/streaks', async (_req: AuthRequest, res: Response) => {
  try {
    const streaks = await prisma.dmStreak.findMany({
      where: { currentStreak: { gt: 0 } },
      orderBy: { currentStreak: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        conversation: { select: { id: true, type: true, name: true } },
      },
    });
    res.json(streaks);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
