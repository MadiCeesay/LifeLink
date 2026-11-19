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
    { $set: { user: userId, kind: 'web', keys: input.keys, userAgent: userAgent?.slice(0, 300) } },
    { upsert: true, new: true, runValidators: true },
  );
  return { subscribed: true };
}
export async function saveExpoToken(userId, token, platform) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: token },
    { $set: { user: userId, kind: 'expo', userAgent: platform }, $unset: { keys: 1 } },
    { upsert: true, new: true, runValidators: true },
  );
  return { subscribed: true };
}
export async function removeSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ user: userId, endpoint });
  return { subscribed: false };
}
// Sends one payload per user to every device they registered. Never throws: push is best-effort on top of the in-app inbox.
export async function pushToUsers(config, messages) {
  if (!messages.length) return { sent: 0 };
  const byUser = new Map(messages.map(m => [m.userId.toString(), m]));
  const subs = await PushSubscription.find({ user: { $in: [...byUser.keys()] } });
  const webSubs = subs.filter(s => s.kind !== 'expo');
  const expoSubs = subs.filter(s => s.kind === 'expo');
  let sent = 0;
  if (ready(config)) {
    await Promise.all(webSubs.map(async sub => {
      const m = byUser.get(sub.user.toString());
      const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag, urgent: !!m.urgent });
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 6 * 3600, urgency: m.urgent ? 'high' : 'normal' });
        sent++;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      }
    }));
  }
  for (let i = 0; i < expoSubs.length; i += 100) {
    const batch = expoSubs.slice(i, i + 100);
    const body = batch.map(sub => {
      const m = byUser.get(sub.user.toString());
      return { to: sub.endpoint, title: m.title, body: m.body, sound: 'default', priority: m.urgent ? 'high' : 'default', channelId: m.urgent ? 'alerts' : 'default', ttl: 6 * 3600, data: { path: m.path, url: m.url } };
    });
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      const json = await res.json().catch(() => ({}));
      (json.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent++;
        else if (ticket.details?.error === 'DeviceNotRegistered') void PushSubscription.deleteOne({ _id: batch[idx]._id }).catch(() => {});
      });
    } catch { /* best effort */ }
  }
  return { sent };
}
