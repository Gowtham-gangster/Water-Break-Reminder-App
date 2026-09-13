import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const reminderRouter = Router();

// Get User-Specific Statistics & Analytics
reminderRouter.get('/stats', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const stats = db.getUserStatistics(userId);
  res.json(stats);
});

// Get Paginated & Filtered History for Authenticated User
reminderRouter.get('/history', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const range = req.query.range as 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom' | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  const result = db.getUserHistory(userId, { range, startDate, endDate, page, limit });
  res.json(result);
});

// Get Reminder History for Authenticated User (Simple list)
reminderRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const events = db.getReminderEvents(userId, limit);
  res.json({ events });
});

// Record a new reminder event (Strictly assigned to authenticated user)
reminderRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { type, scheduled_at, started_at, completed_at, status } = req.body;

  if (!type || !scheduled_at) {
    return res.status(400).json({ error: 'type and scheduled_at are required' });
  }

  const event = db.insertReminderEvent(userId, {
    type,
    scheduled_at,
    started_at: started_at || null,
    completed_at: completed_at || null,
    status: status || 'completed',
  });

  res.status(201).json({ event });
});

// Update an existing reminder event (Ownership verified)
reminderRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { started_at, completed_at, status } = req.body;

  const event = db.updateReminderEvent(id, userId, {
    ...(started_at !== undefined && { started_at }),
    ...(completed_at !== undefined && { completed_at }),
    ...(status !== undefined && { status }),
  });

  if (!event) {
    return res.status(404).json({ error: 'Reminder event not found or unauthorized' });
  }

  res.json({ event });
});

// Batch Log Synchronizer (For syncing offline completed reminder events)
reminderRouter.post('/batch', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { events } = req.body;

  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'events array required' });
  }

  const inserted = events.map((ev) => {
    return db.insertReminderEvent(userId, {
      type: ev.type,
      scheduled_at: ev.scheduled_at,
      started_at: ev.started_at || null,
      completed_at: ev.completed_at || null,
      status: ev.status || 'completed',
    });
  });

  res.status(201).json({ insertedCount: inserted.length, events: inserted });
});
