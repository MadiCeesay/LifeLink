import React from "react";
import { router } from "expo-router";
import { PagedList } from "../../components/PagedList";
import { RequestCard } from "../../components/RequestCard";
import { Button, Screen } from "../../components/ui";
import type { BloodRequest } from "../../types/api";
export function RequestsScreen() {
  return (
    <Screen
      title="Facility requests"
      subtitle="Your facility's requests, coordinated securely."
    >
      <Button
        title="Create blood request"
        onPress={() => router.push("/facility/create-request")}
      />
      <PagedList<BloodRequest>
        url="/requests"
        field="requests"
        empty="No facility requests yet."
        render={(r) => (
          <RequestCard
            request={r}
            onPress={() =>
              router.push({
                pathname: "/facility/request/[id]",
                params: { id: r.id },
              })
            }
          />
        )}
      />
    </Screen>
  );
}
