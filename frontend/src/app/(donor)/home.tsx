import React, { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { useAction, useResource } from "../../hooks/api";
import type { LocationState, Notification, Pagination, Verification } from "../../types/api";
import { devicePoint } from "../../services/location";
import { BloodChip, Body, Box, H3, Notice, Page, RoundIcon, UrgencyTag, displayType, errorText, font } from "../../components/kit";
import { PushBanner } from "../../features/common/PushBanner";
import { colors as c } from "../../theme";
import { isActiveRequest } from "../../utils/domain";
const minutesAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
export default function Home() {
  const { user } = useAuth();
  const inbox = useResource<{ notifications: Notification[]; pagination: Pagination }>("/notifications", { page: 1, limit: 20 });
  const loc = useResource<LocationState>("/donors/me/location");
  const ver = useResource<Verification>("/donors/me/verification");
  const donations = useResource<{ pagination: Pagination }>("/donors/me/donations", { page: 1, limit: 1 });
  const action = useAction();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const available = loc.data?.availabilityStatus === "AVAILABLE";
  const verified = ver.data?.verificationStatus === "VERIFIED";
  const active = (inbox.data?.notifications ?? []).filter((n) => n.bloodRequest && isActiveRequest(n.bloodRequest) && n.responseStatus !== "DECLINED");
  const unread = (inbox.data?.notifications ?? []).some((n) => n.status === "DELIVERED");
  // One switch does everything a donor needs: share a fresh location once and become available.
  const setAvailable = async (on: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      if (on) {
        const point = await devicePoint();
        if (!loc.data?.locationSharingEnabled)
          await action.mutateAsync({ method: "patch", url: "/donors/me/location-sharing", body: { locationSharingEnabled: true } });
        await action.mutateAsync({ method: "put", url: "/donors/me/location", body: point });
      }
      await action.mutateAsync({ method: "patch", url: "/donors/me/availability", body: { availabilityStatus: on ? "AVAILABLE" : "UNAVAILABLE" } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const h = new Date().getHours();
  return (
    <Page
      refreshing={inbox.isFetching}
      onRefresh={() => {
        void inbox.refetch();
        void loc.refetch();
        void ver.refetch();
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: font.regular, fontSize: 15, color: c.muted }}>
            Good {h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"}
          </Text>
          <Text accessibilityRole="header" style={{ fontFamily: font.bold, fontSize: 26, color: c.text }}>
            {user?.name.split(" ")[0]}
          </Text>
        </View>
        <RoundIcon icon="notifications-outline" label={unread ? "Alerts, new" : "Alerts"} dot={unread} onPress={() => router.push("/(donor)/requests")} />
      </View>
      <View style={{ backgroundColor: c.primary, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ gap: 6, flex: 1 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 14, color: "#fff", opacity: 0.9 }}>Your blood type</Text>
          <Text style={{ fontFamily: font.bold, fontSize: verified ? 52 : 22, lineHeight: verified ? 56 : 28, color: "#fff" }}>
            {verified ? displayType(ver.data?.verifiedBloodType) : "Not confirmed yet"}
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 14, color: "#fff" }}>
            {verified ? `✓ Verified at ${ver.data?.verifiedByFacility?.name ?? "a hospital"}` : "Show your card at any partner hospital to confirm it."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show my donor card"
          onPress={() => router.push("/donor/card")}
          style={{ backgroundColor: "#fff", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", gap: 6 }}
        >
          <Ionicons name="qr-code-outline" size={28} color={c.primary} />
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.primary }}>My card</Text>
        </Pressable>
      </View>
      <Box style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <H3 style={{ fontSize: 18 }}>I’m available to help</H3>
          <Body muted size={14}>
            {available
              ? verified
                ? `You'll get alerts for ${displayType(ver.data?.verifiedBloodType)} requests near you.`
                : "You'll get alerts once a hospital confirms your blood type."
              : "Turn on to receive blood requests near you."}
          </Body>
        </View>
        <Switch
          accessibilityLabel="I'm available to help"
          value={available}
          disabled={busy || loc.isPending}
          onValueChange={(v) => void setAvailable(v)}
          trackColor={{ true: "#1F7A4D", false: "#D4D1CC" }}
          thumbColor="#fff"
          style={{ transform: [{ scale: 1.2 }] }}
        />
      </Box>
      {available && loc.data && !loc.data.isLocationFresh && (
        <Box onPress={() => void setAvailable(true)} label="Update my location" style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="location-outline" size={22} color={c.primary} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: c.text }}>Update my location so nearby hospitals can find you</Text>
          <Ionicons name="refresh" size={20} color={c.primary} />
        </Box>
      )}
      {error ? <Notice text={error} tone="error" /> : null}
      <PushBanner />
      <View style={{ gap: 10 }}>
        <H3>{active.length ? "Needed now" : "Requests"}</H3>
        {active.length === 0 ? (
          <Box>
            <Body muted>No one needs your help right now. We’ll alert you when a hospital near you does.</Body>
          </Box>
        ) : (
          active.slice(0, 3).map((n) => (
            <Box
              key={n.id}
              highlight={n.responseStatus === "PENDING"}
              label={`${n.bloodRequest!.patientBloodType} needed at ${n.bloodRequest!.facility?.name ?? "a hospital"}`}
              onPress={() => router.push({ pathname: "/donor/notification/[id]", params: { id: n.id } })}
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <BloodChip type={n.bloodRequest!.patientBloodType} />
              <View style={{ flex: 1, gap: 3 }}>
                {n.responseStatus === "ACCEPTED" ? (
                  <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, color: "#1F7A4D" }}>YOU’RE GOING</Text>
                ) : (
                  <UrgencyTag urgency={n.bloodRequest!.urgency} />
                )}
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.text }}>{n.bloodRequest!.facility?.name ?? "Hospital"}</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 14, color: c.muted }}>
                  {n.bloodRequest!.remainingUnits} unit{n.bloodRequest!.remainingUnits === 1 ? "" : "s"} · {minutesAgo(n.sentAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={c.primary} />
            </Box>
          ))
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Box style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 26, color: c.text }}>{donations.data?.pagination.total ?? "–"}</Text>
          <Body muted size={14}>Lives helped</Body>
        </Box>
        <Box style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 32, color: available ? "#1F7A4D" : c.muted }}>{available ? "Available" : "Resting"}</Text>
          <Body muted size={14}>Your status</Body>
        </Box>
      </View>
    </Page>
  );
}
