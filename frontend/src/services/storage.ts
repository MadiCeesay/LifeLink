import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
const key = "lifelink.session";
let webToken: string | null = null;
export const tokenStorage = {
  read: async () =>
    Platform.OS === "web" ? webToken : SecureStore.getItemAsync(key),
  write: async (value: string) => {
    if (Platform.OS === "web") {
      webToken = value;
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  clear: async () => {
    webToken = null;
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(key);
  },
};
