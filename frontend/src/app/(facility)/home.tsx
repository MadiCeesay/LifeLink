import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useResource } from "../../hooks/api";
import type { BloodRequest, Facility, Pagination } from "../../types/api";
import { BigButton, Body, Box, H3, Notice, Page, errorText, font } from "../../components/kit";
import { PushBanner } from "../../features/common/PushBanner";
import { RequestTile } from "../../features/facility/RequestTile";
import { colors as c } from "../../theme";
import { isActiveRequest } from "../../utils/domain";
export default function FacilityHome() {
  const facility = useResource<Facility>("/facilities/me");
  const list = useResource<{ requests: BloodRequest[]; pagination: Pagination }>("/requests", { page: 1, limit: 30 });
  const active = (list.data?.requests ?? []).filter(isActiveRequest);
  return (
    <Page
      refreshing={list.isFetching}
      onRefresh={() => {
        void list.refetch();
        void facility.refetch();
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: font.regular, fontSize: 15, color: c.muted }}>{facility.data?.name ?? "Your facility"}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: font.bold, fontSize: 26, color: c.text }}>Blood requests</Text>
      </View>
      <BigButton title="New blood request" icon="add" onPress={() => router.push("/facility/create-request")} />
      <PushBanner who="staff" />
      {list.error ? <Notice text={errorText(list.error)} tone="error" /> : null}
      <H3>Active now</H3>
      {list.isPending ? (
        <Body muted>Loading…</Body>
      ) : active.length === 0 ? (
        <Box>
          <Body muted>No active requests. Tap “New blood request” when a patient needs blood.</Body>
        </Box>
      ) : (
        active.map((r) => <RequestTile key={r.id} request={r} />)
      )}
      <BigButton title="See all requests" variant="ghost" size="medium" onPress={() => router.push("/(facility)/requests")} />
    </Page>
  );
}
