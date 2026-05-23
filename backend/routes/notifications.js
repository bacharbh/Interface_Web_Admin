import express from 'express';
import Joi from 'joi';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// In-memory storage for notifications (in production, use MongoDB)
let notifications = [];

// Validation schema
const notificationSchema = Joi.object({
  title: Joi.string().required().min(1).max(200),
  message: Joi.string().required().min(1).max(1000),
  type: Joi.string().valid('info', 'warning', 'error', 'success', 'alert').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  category: Joi.string().valid('health', 'location', 'system', 'maintenance', 'security').default('system'),
  targetUsers: Joi.array().items(Joi.string()).optional(),
  targetRoles: Joi.array().items(Joi.string().valid('admin', 'operator', 'viewer')).optional(),
  isRead: Joi.boolean().default(false),
  expiresAt: Joi.date().optional(),
  metadata: Joi.object().optional()
});

// Get all notifications for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, type, category } = req.query;
    const skip = (page - 1) * limit;

    // Filter notifications based on user role and preferences
    let filteredNotifications = notifications.filter(n => {
      // Filter by read status if requested
      if (unreadOnly === 'true' && n.isRead) return false;
      
      // Filter by type if specified
      if (type && n.type !== type) return false;
      
      // Filter by category if specified
      if (category && n.category !== category) return false;
      
      // Check if notification is for this user's role
      if (n.targetRoles && !n.targetRoles.includes(req.user.role)) return false;
      
      // Check if notification is specifically for this user
      if (n.targetUsers && !n.targetUsers.includes(req.user.username)) return false;
      
      // Check if notification has expired
      if (n.expiresAt && new Date() > n.expiresAt) return false;
      
      return true;
    });

    // Sort by creation date (newest first)
    filteredNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paginatedNotifications = filteredNotifications.slice(skip, skip + parseInt(limit));

    res.json({
      notifications: paginatedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredNotifications.length,
        pages: Math.ceil(filteredNotifications.length / limit)
      },
      unreadCount: filteredNotifications.filter(n => !n.isRead).length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

// Get specific notification
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const notification = notifications.find(n => n.id === req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if user has permission to view this notification
    if (notification.targetRoles && !notification.targetRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (notification.targetUsers && !notification.targetUsers.includes(req.user.username)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching notification' });
  }
});

// Create new notification
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { error } = notificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const notification = {
      id: Date.now().toString(),
      ...req.body,
      createdBy: req.user.username,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    notifications.push(notification);

    // Emit real-time notification
    const io = req.app.get('io');
    io.emit('notification:new', notification);

    res.status(201).json({
      message: 'Notification created successfully',
      notification
    });
  } catch (error) {
    res.status(500).json({ error: 'Error creating notification' });
  }
});

// Mark notification as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notificationIndex = notifications.findIndex(n => n.id === req.params.id);
    
    if (notificationIndex === -1) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Mark as read
    notifications[notificationIndex].isRead = true;
    notifications[notificationIndex].readAt = new Date();
    notifications[notificationIndex].readBy = req.user.username;

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('notification:read', {
      id: req.params.id,
      readBy: req.user.username,
      readAt: new Date()
    });

    res.json({
      message: 'Notification marked as read',
      notification: notifications[notificationIndex]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error marking notification as read' });
  }
});

// Mark multiple notifications as read
router.patch('/mark-read', authMiddleware, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds must be an array' });
    }

    const updatedNotifications = [];
    
    notificationIds.forEach(id => {
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        notifications[index].isRead = true;
        notifications[index].readAt = new Date();
        notifications[index].readBy = req.user.username;
        updatedNotifications.push(notifications[index]);
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('notifications:bulk-read', {
      notificationIds,
      readBy: req.user.username,
      readAt: new Date()
    });

    res.json({
      message: `${updatedNotifications.length} notifications marked as read`,
      notifications: updatedNotifications
    });
  } catch (error) {
    res.status(500).json({ error: 'Error marking notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const index = notifications.findIndex(n => n.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const deletedNotification = notifications[index];
    notifications.splice(index, 1);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('notification:deleted', { id: req.params.id });

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting notification' });
  }
});

// Clear all read notifications for user
router.delete('/clear', authMiddleware, async (req, res) => {
  try {
    const initialCount = notifications.length;
    
    // Filter out read notifications for this user
    notifications = notifications.filter(n => {
      const isForUser = (!n.targetRoles || n.targetRoles.includes(req.user.role)) &&
                      (!n.targetUsers || n.targetUsers.includes(req.user.username));
      
      // Keep if not for this user or if unread
      return !isForUser || !n.isRead;
    });

    const deletedCount = initialCount - notifications.length;

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('notifications:cleared', {
      clearedBy: req.user.username,
      deletedCount,
      timestamp: new Date()
    });

    res.json({
      message: `${deletedCount} read notifications cleared`,
      deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing notifications' });
  }
});

// Get notification statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userNotifications = notifications.filter(n => {
      if (n.targetRoles && !n.targetRoles.includes(req.user.role)) return false;
      if (n.targetUsers && !n.targetUsers.includes(req.user.username)) return false;
      if (n.expiresAt && new Date() > n.expiresAt) return false;
      return true;
    });

    const stats = {
      total: userNotifications.length,
      unread: userNotifications.filter(n => !n.isRead).length,
      byType: {},
      byCategory: {},
      byPriority: {}
    };

    // Count by type
    userNotifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byCategory[n.category] = (stats.byCategory[n.category] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
    });

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching notification statistics' });
  }
});

export default router;
