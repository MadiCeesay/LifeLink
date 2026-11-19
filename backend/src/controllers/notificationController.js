import * as service from '../services/notificationService.js';
import { broadcastRequest } from '../services/broadcastService.js';
export const createNotificationController = config => ({
  list: async (req, res) => res.json({ success: true, data: await service.listNotifications(req.user._id, req.query) }),
  read: async (req, res) => res.json({ success: true, data: await service.markNotificationRead(req.user._id, req.params.notificationId) }),
  respond: async (req, res) => res.json({ success: true, data: await service.respondToNotification(req.user._id, req.params.notificationId, req.body, config) }),
  responses: async (req, res) => res.json({ success: true, data: await service.listRequestResponses(req.user._id, req.params.requestId, req.query) }),
  summary: async (req, res) => res.json({ success: true, data: await service.requestSummary(req.user._id, req.params.requestId, config) }),
  broadcast: async (req, res) => res.json({ success: true, data: await broadcastRequest(req.user._id, req.params.requestId, req.body, config) }),
});
