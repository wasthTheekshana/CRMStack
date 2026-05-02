// backend/src/controllers/notificationController.ts
import { Request, Response } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  dismissNotification,
} from '../models/notificationModel';

export async function listNotifications(req: Request, res: Response) {
  try {
    const userId   = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(userId, tenantId, 20),
      getUnreadCount(userId, tenantId),
    ]);
    res.json({ unreadCount, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markAllReadHandler(req: Request, res: Response) {
  try {
    await markAllRead(req.user!.userId, req.user!.tenantId);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function dismissNotificationHandler(req: Request, res: Response) {
  try {
    const found = await dismissNotification(
      req.params.id,
      req.user!.userId,
      req.user!.tenantId
    );
    if (!found) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ message: 'Notification dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
