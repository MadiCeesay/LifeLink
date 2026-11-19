import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { send } from "../../../services/client";
import type {
  BloodRequest,
  Donation,
  FacilityResponse,
  Pagination,
} from "../../../types/api";
import {
  BigButton,
  Body,
  Box,
  Choice,
  H3,
  Notice,
  Page,
  Stat,
  TopBar,
  displayType,
  errorText,
  font,
} from "../../../components/kit";
import { Loading } from "../../../components/ui";
import type { RequestSummary } from "../../../features/facility/RequestTile";
import { since } from "../../../features/facility/RequestTile";
import { colors as c } from "../../../theme";
import { isActiveRequest, label } from "../../../utils/domain";
const live = 15000;
const reasons = [
  "Need met another way",
  "Patient no longer needs blood",
  "Created by mistake",
];
const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export default function LiveStatus() {
  const { id, alert } = useLocalSearchParams<{ id: string; alert?: string }>();
  const client = useQueryClient();
  const request = useQuery({
    queryKey: ["/requests/" + id],
    queryFn: () => send<BloodRequest>("get", "/requests/" + id),
    refetchInterval: live,
  });
  const active = request.data ? isActiveRequest(request.data) : false;
  const summary = useQuery({
    queryKey: ["/requests/" + id + "/summary"],
    queryFn: () => send<RequestSummary>("get", `/requests/${id}/summary`),
    refetchInterval: active ? live : false,
  });
  const responses = useQuery({
    queryKey: ["/requests/" + id + "/responses"],
    queryFn: () =>
      send<{ responses: FacilityResponse[]; pagination: Pagination }>(
        "get",
        `/requests/${id}/responses`,
        undefined,
        { page: 1, limit: 50 },
      ),
    refetchInterval: active ? live : false,
  });
  const donations = useQuery({
    queryKey: ["/requests/" + id + "/donations"],
    queryFn: () =>
      send<{ donations: Donation[]; pagination: Pagination }>(
        "get",
        `/requests/${id}/donations`,
        undefined,
        { page: 1, limit: 50 },
      ),
    retry: false,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<FacilityResponse | null>(null);
  const [units, setUnits] = useState(1);
  const [cancelling, setCancelling] = useState(false);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(undefined);
    try {
      await fn();
      await client.invalidateQueries();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  if (request.isPending) return <Loading />;
  if (request.error || !request.data)
    return (
      <Page>
        <TopBar title="Request" />
        <Notice text={errorText(request.error)} tone="error" />
      </Page>
    );
  const r = request.data;
  const s = summary.data;
  const donatedBy = new Map(
    (donations.data?.donations ?? []).map((d) => [d.donorId, d]),
  );
  const coming = (responses.data?.responses ?? []).filter(
    (x) => x.status === "ACCEPTED",
  );
  const neverSent = s && !s.lastBroadcastAt;
  const atMax = s ? s.broadcastStage >= s.radiusStagesKm.length - 1 : false;
  // Measured against when the summary was fetched (refreshed every 15 s) to keep rendering pure.
  const minsToWiden = s?.nextWidenAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(s.nextWidenAt) - summary.dataUpdatedAt) / 60000),
      )
    : null;
  return (
    <Page
      refreshing={request.isFetching}
      onRefresh={() => void client.invalidateQueries()}
    >
      <TopBar onBack={() => router.replace("/(facility)/home")} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 17,
            backgroundColor: c.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 24, color: "#fff" }}>
            {displayType(r.patientBloodType)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: font.bold, fontSize: 22, color: c.text }}
          >
            {r.unitsNeeded} unit{r.unitsNeeded === 1 ? "" : "s"} ·{" "}
            {label(r.urgency)}
          </Text>
          <Text
            style={{
              fontFamily: font.semibold,
              fontSize: 14,
              color: active ? c.primary : c.muted,
            }}
          >
            {active ? `Open · posted ${since(r.createdAt)}` : label(r.status)}
          </Text>
        </View>
      </View>
      {s && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat value={s.alerted} label="Alerted" />
          <Stat value={s.accepted} label="Coming" tone="amber" />
          <Stat
            value={`${r.unitsReceived}/${r.unitsNeeded}`}
            label="Units in"
            tone="green"
          />
        </View>
      )}
      {active && s && (
        <Box>
          <Text
            style={{ fontFamily: font.semibold, fontSize: 14, color: c.muted }}
          >
            Search area
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {s.radiusStagesKm.map((km, i) => {
              const reached = s.lastBroadcastAt && i <= s.broadcastStage;
              return (
                <View
                  key={km}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: reached ? c.primary : "transparent",
                    borderWidth: reached ? 0 : 1,
                    borderStyle: "dashed",
                    borderColor: "#B9B5B0",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.bold,
                      fontSize: 14,
                      color: reached ? "#fff" : c.muted,
                    }}
                  >
                    {km} km
                  </Text>
                </View>
              );
            })}
          </View>
          <Body size={14} muted>
            {neverSent
              ? "Donors have not been alerted yet."
              : atMax
                ? "Searching the widest area."
                : minsToWiden !== null
                  ? minsToWiden === 0
                    ? "Widening the search now…"
                    : `Widens automatically in ${minsToWiden} min if still short.`
                  : "You can widen the search below."}
          </Body>
          {neverSent || alert === "retry" ? (
            <BigButton
              title="Alert donors now"
              icon="notifications"
              size="medium"
              loading={busy === "send"}
              onPress={() =>
                void run("send", () =>
                  send("post", `/requests/${id}/broadcast`, {
                    idempotencyKey: Crypto.randomUUID(),
                  }),
                )
              }
            />
          ) : !atMax ? (
            <BigButton
              title="Widen search now"
              variant="secondary"
              size="medium"
              loading={busy === "widen"}
              onPress={() =>
                void run("widen", () =>
                  send("post", `/requests/${id}/broadcast`, {
                    idempotencyKey: Crypto.randomUUID(),
                    expand: true,
                  }),
                )
              }
            />
          ) : null}
        </Box>
      )}
      {error ? <Notice text={error} tone="error" /> : null}
      {!active ? (
        <>
          <H3>Donations</H3>
          <Box>
            {(donations.data?.donations ?? []).length === 0 ? (
              <Body muted>No donations were confirmed for this request.</Body>
            ) : (
              (donations.data?.donations ?? []).map((d) => (
                <View
                  key={d.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#1F7A4D" />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: font.semibold,
                      fontSize: 15,
                      color: c.text,
                    }}
                  >
                    {d.units} unit{d.units === 1 ? "" : "s"} of{" "}
                    {displayType(d.bloodTypeSnapshot)} · {since(d.confirmedAt)}
                  </Text>
                </View>
              ))
            )}
            <Body muted size={13}>
              Donor contact details are hidden once a request is closed, to
              protect their privacy.
            </Body>
          </Box>
        </>
      ) : null}
      {active && <H3>Donors coming</H3>}
      {!active ? null : coming.length === 0 ? (
        <Box>
          <Body muted>
            {active
              ? "No one has said yes yet. You’ll get an alert the moment someone does."
              : "No donors responded to this request."}
          </Body>
        </Box>
      ) : (
        <Box style={{ paddingVertical: 4, gap: 0 }}>
          {coming.map((x, i) => {
            const donated = donatedBy.get(x.donor?.id ?? "");
            return (
              <View
                key={x.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  borderBottomWidth: i === coming.length - 1 ? 0 : 1,
                  borderBottomColor: "#F0EEEB",
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: donated ? "#E8F4EE" : "#FFF4E0",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.bold,
                      fontSize: 15,
                      color: donated ? "#145A38" : "#8A5300",
                    }}
                  >
                    {x.donor ? initials(x.donor.name) : "?"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: font.bold,
                      fontSize: 16,
                      color: c.text,
                    }}
                  >
                    {x.donor?.name ?? "Donor"}{" "}
                    {x.donor
                      ? `· ${displayType(x.donor.verifiedBloodType)}`
                      : ""}
                  </Text>
                  <Text
                    style={{
                      fontFamily: font.regular,
                      fontSize: 14,
                      color: donated ? "#1F7A4D" : c.muted,
                    }}
                  >
                    {donated
                      ? `Donated ${donated.units} unit${donated.units === 1 ? "" : "s"}`
                      : `Said yes ${since(x.respondedAt)}`}
                  </Text>
                </View>
                {x.donor && !donated && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${x.donor.name}`}
                      onPress={() =>
                        void Linking.openURL(
                          "tel:" + x.donor!.phone.replace(/\s/g, ""),
                        )
                      }
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: c.tint,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color={c.primary}
                      />
                    </Pressable>
                    {active && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Confirm donation from ${x.donor.name}`}
                        onPress={() => {
                          setUnits(1);
                          setConfirming(x);
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: "#E8F4EE",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="checkmark" size={22} color="#1F7A4D" />
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </Box>
      )}
      {confirming?.donor && (
        <Box highlight>
          <H3>Confirm donation from {confirming.donor.name}?</H3>
          <Body muted size={14}>
            Only confirm after the blood was actually collected.
          </Body>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[1, 2].map((u) => (
              <Choice
                key={u}
                label={`${u} unit${u === 1 ? "" : "s"}`}
                selected={units === u}
                onPress={() => setUnits(u)}
              />
            ))}
          </View>
          <BigButton
            title="Confirm donation"
            variant="success"
            size="medium"
            loading={busy === "confirm"}
            onPress={() =>
              void run("confirm", async () => {
                await send("post", `/requests/${id}/donations`, {
                  donorId: confirming.donor!.id,
                  units,
                });
                setConfirming(null);
              })
            }
          />
          <BigButton
            title="Not yet"
            variant="ghost"
            size="medium"
            onPress={() => setConfirming(null)}
          />
        </Box>
      )}
      {active && (
        <View style={{ gap: 8, marginTop: 8 }}>
          <BigButton
            title="Scan a donor’s card"
            icon="qr-code-outline"
            variant="secondary"
            size="medium"
            onPress={() => router.push("/(facility)/verify")}
          />
          {!cancelling ? (
            <BigButton
              title="Close this request"
              variant="ghost"
              size="medium"
              onPress={() => setCancelling(true)}
            />
          ) : (
            <Box>
              <H3>Why are you closing it?</H3>
              {reasons.map((reason) => (
                <BigButton
                  key={reason}
                  title={reason}
                  variant="secondary"
                  size="medium"
                  loading={busy === reason}
                  onPress={() =>
                    void run(reason, async () => {
                      await send("patch", `/requests/${id}/cancel`, { reason });
                      setCancelling(false);
                    })
                  }
                />
              ))}
              <BigButton
                title="Keep it open"
                variant="ghost"
                size="medium"
                onPress={() => setCancelling(false)}
              />
            </Box>
          )}
        </View>
      )}
    </Page>
  );
}
