// Phone alerts. Store apps (Android/iOS) use Expo push notifications; the web version uses web push
// (on iPhone Safari that only works once LifeLink is added to the Home Screen).
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { send } from "./client";
const native = Platform.OS === "ios" || Platform.OS === "android";
if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}
async function nativeChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("alerts", {
    name: "Urgent blood requests",
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 300, 150, 300, 150, 300],
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("default", { name: "Updates", importance: AndroidImportance.DEFAULT });
}
async function registerNativeToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("This build is missing its Expo project ID.");
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await send("post", "/push/expo", { token: data, platform: Platform.OS });
}
async function nativeState(): Promise<PushState> {
  if (!Device.isDevice) return "unsupported";
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) {
    await nativeChannels();
    await registerNativeToken().catch(() => {});
    return "on";
  }
  return p.canAskAgain ? "off" : "denied";
}
async function enableNative(): Promise<PushState> {
  if (!Device.isDevice) return "unsupported";
  await nativeChannels();
  const p = await Notifications.requestPermissionsAsync();
  if (!p.granted) return p.canAskAgain ? "off" : "denied";
  await registerNativeToken();
  return "on";
}
export type PushState = "unsupported" | "needs-install" | "off" | "denied" | "on";
const w = globalThis as unknown as {
  navigator?: Navigator & { standalone?: boolean };
  Notification?: typeof Notification;
  PushManager?: unknown;
  matchMedia?: (q: string) => { matches: boolean };
};
const isIOS = () => /iPad|iPhone|iPod/.test(w.navigator?.userAgent ?? "");
const standalone = () => w.navigator?.standalone === true || w.matchMedia?.("(display-mode: standalone)").matches === true;
function supported() {
  return Platform.OS === "web" && !!w.navigator?.serviceWorker && !!w.PushManager && !!w.Notification;
}
async function registration() {
  return w.navigator!.serviceWorker.register("/sw.js");
}
export async function pushState(): Promise<PushState> {
  if (native) return nativeState().catch(() => "unsupported" as const);
  if (Platform.OS !== "web") return "unsupported";
  if (isIOS() && !standalone()) return "needs-install";
  if (!supported()) return "unsupported";
  if (w.Notification!.permission === "denied") return "denied";
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub && w.Notification!.permission === "granted") {
      // Re-send so the server always has the current subscription for this account.
      await send("post", "/push/subscribe", sub.toJSON()).catch(() => {});
      return "on";
    }
  } catch {
    return "unsupported";
  }
  return "off";
}
function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}
export async function enablePush(): Promise<PushState> {
  if (native) return enableNative();
  if (!supported()) return isIOS() && !standalone() ? "needs-install" : "unsupported";
  const config = await send<{ enabled: boolean; publicKey: string | null }>("get", "/push/config");
  if (!config.enabled || !config.publicKey) throw new Error("Phone alerts are not switched on for this server yet.");
  const permission = await w.Notification!.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  await w.navigator!.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) }));
  await send("post", "/push/subscribe", sub.toJSON());
  return "on";
}
export async function disablePush() {
  if (native) {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId || !Device.isDevice) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await send("post", "/push/unsubscribe", { endpoint: data }).catch(() => {});
    return;
  }
  if (!supported()) return;
  const reg = await w.navigator!.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await send("post", "/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
}
