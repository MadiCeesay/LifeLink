// Store apps only: opens the right screen when someone taps a LifeLink alert.
// Not rendered on web, where expo-notifications' response APIs do not exist.
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
export function AlertTaps() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const path = last.notification.request.content.data?.path;
    if (typeof path === "string" && path.startsWith("/")) router.push(path as never);
    void Notifications.clearLastNotificationResponseAsync();
  }, [last]);
  return null;
}
