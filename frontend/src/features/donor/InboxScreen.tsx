import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { PagedList } from "../../components/PagedList";
import { RequestCard } from "../../components/RequestCard";
import { Badge, Card, Screen, styles } from "../../components/ui";
import type { Notification } from "../../types/api";
export function InboxScreen({
  notifications = false,
}: {
  notifications?: boolean;
}) {
  return (
    <Screen
      title={notifications ? "Notifications" : "Your blood requests"}
      back={notifications}
      subtitle="Only requests sent privately to you. Pull up a request to respond."
    >
      <PagedList<Notification>
        url="/notifications"
        field="notifications"
        empty="No blood requests currently require your response."
        render={(n) => (
          <>
            {notifications && <Badge value={n.status} />}
            {n.bloodRequest ? (
              <RequestCard
                request={n.bloodRequest}
                responseStatus={n.responseStatus}
                onPress={() =>
                  router.push({
                    pathname: "/donor/notification/[id]",
                    params: { id: n.id },
                  })
                }
              />
            ) : (
              <Card>
                <Text style={styles.muted}>
                  This request is no longer available.
                </Text>
              </Card>
            )}
          </>
        )}
      />
    </Screen>
  );
}
