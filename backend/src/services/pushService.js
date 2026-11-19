import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription.js';
let configured = null;
function ready(config) {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  if (configured !== config.VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
    configured = config.VAPID_PUBLIC_KEY;
  }
  return true;
}
export const pushEnabled = config => !!(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
export async function saveSubscription(userId, input, userAgent) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: input.endpoint },
    { $set: { user: userId, keys: input.keys, userAgent: userAgent?.slice(0, 300) } },
    { upsert: true, new: true, runValidators: true },
  );
  return { subscribed: true };
}
export async function removeSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ user: userId, endpoint });
  return { subscribed: false };
}
// Sends one payload per user. Never throws: push is best-effort on top of the in-app inbox.
export async function pushToUsers(config, messages) {
  if (!ready(config) || !messages.length) return { sent: 0 };
  const byUser = new Map(messages.map(m => [m.userId.toString(), m]));
  const subs = await PushSubscription.find({ user: { $in: [...byUser.keys()] } });
  let sent = 0;
  await Promise.all(subs.map(async sub => {
    const m = byUser.get(sub.user.toString());
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag, urgent: !!m.urgent });
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 6 * 3600, urgency: m.urgent ? 'high' : 'normal' });
      sent++;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
    }
  }));
  return { sent };
}
