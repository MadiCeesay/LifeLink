import { Notification } from '../models/Notification.js';
import { AppError } from '../utils/errors.js';
const inApp = {
  async publish({ recipient, bloodRequest, radiusKm }, session) {
    const [notification] = await Notification.create([{ recipient, bloodRequest, radiusKm, channel: 'IN_APP', status: 'DELIVERED', sentAt: new Date() }], { session });
    return notification;
  },
};
export function notificationProvider(channel) {
  if (channel !== 'IN_APP') throw new AppError(503, 'CHANNEL_NOT_CONFIGURED', 'External notification channel is not configured');
  return inApp;
}
