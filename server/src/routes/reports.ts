import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const reportRouter = Router();

// Create a report
reportRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason, details } = req.body;

    if (!targetType || !targetId || !reason) {
      res.status(400).json({ message: 'targetType, targetId, and reason are required' });
      return;
    }

    if (!['message', 'post', 'user'].includes(targetType)) {
      res.status(400).json({ message: 'Invalid target type' });
      return;
    }

    // Prevent duplicate reports from same user on same target
    const existing = await prisma.report.findFirst({
      where: { reporterId: req.userId!, targetType, targetId, status: 'pending' },
    });
    if (existing) {
      res.status(400).json({ message: 'You already reported this' });
      return;
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.userId!,
        targetType,
        targetId,
        reason,
        details: details || null,
      },
    });

    res.status(201).json({ ...report, createdAt: report.createdAt.toISOString() });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's own reports
reportRouter.get('/mine', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      where: { reporterId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
