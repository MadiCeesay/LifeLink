import * as Location from "expo-location";
import { toPoint } from "../utils/domain";
export async function devicePoint() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Location permission was not granted. You can enable it in device settings.",
    );
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled)
    throw new Error("Turn on device location services and try again.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Location took too long. Move to an open area and retry.",
              ),
            ),
          15000,
        );
      }),
    ]);
    return toPoint(result.coords);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
