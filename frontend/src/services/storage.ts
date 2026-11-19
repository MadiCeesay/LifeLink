import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
const key = "lifelink.session";
// Web (installed PWA): persist in localStorage so the session survives reopening the app.
// The token is short-lived (JWT_EXPIRES_IN) and the server re-validates it on every launch.
let webToken: string | null = null;
const web = {
  read(): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? webToken;
    } catch {
      return webToken;
    }
  },
  write(value: string) {
    webToken = value;
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage unavailable (private mode): keep the in-memory copy only.
    }
  },
  clear() {
    webToken = null;
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
export const tokenStorage = {
  read: async () =>
    Platform.OS === "web" ? web.read() : SecureStore.getItemAsync(key),
  write: async (value: string) => {
    if (Platform.OS === "web") {
      web.write(value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  clear: async () => {
    if (Platform.OS === "web") web.clear();
    else await SecureStore.deleteItemAsync(key);
  },
};
