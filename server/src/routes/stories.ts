import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const storyRouter = Router();

const userSelect = {
  id: true,
  username: true,
  avatar: true,
  status: true,
};

storyRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    await prisma.story.deleteMany({ where: { expiresAt: { lte: now } } });
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const grouped = new Map<string, any>();
    for (const story of stories) {
      if (!grouped.has(story.userId)) {
        grouped.set(story.userId, {
          user: story.user,
          stories: [],
        });
      }
      const views = JSON.parse(story.views || '[]') as string[];
      grouped.get(story.userId).stories.push({
        id: story.id,
        mediaUrl: story.mediaUrl,
        caption: story.caption,
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
        seen: views.includes(req.userId!),
      });
    }
    res.json([...grouped.values()]);
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

storyRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { mediaUrl, caption } = req.body;
    if (!mediaUrl) {
      res.status(400).json({ message: 'mediaUrl is required' });
      return;
    }
    const story = await prisma.story.create({
      data: {
        userId: req.userId!,
        mediaUrl,
        caption: (caption || '').toString().slice(0, 200),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      include: { user: { select: userSelect } },
    });
    res.status(201).json({
      id: story.id,
      mediaUrl: story.mediaUrl,
      caption: story.caption,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
      user: story.user,
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

storyRouter.post('/:id/view', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const storyId = String(req.params.id);
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      res.status(404).json({ message: 'Story not found' });
      return;
    }
    const views = new Set<string>(JSON.parse(story.views || '[]'));
    views.add(req.userId!);
    await prisma.story.update({
      where: { id: story.id },
      data: { views: JSON.stringify([...views]) },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

storyRouter.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const storyId = String(req.params.id);
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      res.status(404).json({ message: 'Story not found' });
      return;
    }
    if (story.userId !== req.userId) {
      res.status(403).json({ message: 'Not allowed' });
      return;
    }
    await prisma.story.delete({ where: { id: storyId } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

