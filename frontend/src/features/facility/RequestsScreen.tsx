import React from "react";
import { router } from "expo-router";
import { PagedList } from "../../components/PagedList";
import { BigButton, H1, Page } from "../../components/kit";
import { RequestTile } from "./RequestTile";
import type { BloodRequest } from "../../types/api";
export function RequestsScreen() {
  return (
    <Page>
      <H1>All requests</H1>
      <BigButton title="New blood request" icon="add" onPress={() => router.push("/facility/create-request")} />
      <PagedList<BloodRequest> url="/requests" field="requests" empty="No requests yet." render={(r) => <RequestTile request={r} />} />
    </Page>
  );
}
