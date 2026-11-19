import React, { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { send } from "../../../services/client";
import { useAction, useResource } from "../../../hooks/api";
import type { LocationState, Notification, Pagination } from "../../../types/api";
import { submitResponse } from "../../../features/donor/respond";
import { devicePoint } from "../../../services/location";
import { useAuth } from "../../../providers/AuthProvider";
import { BigButton, Body, Box, Choice, H1, H3, InfoRow, Notice, Page, RoundIcon, TopBar, displayType, errorText, font } from "../../../components/kit";
import { Loading } from "../../../components/ui";
import { colors as c } from "../../../theme";
import { isActiveRequest } from "../../../utils/domain";
type Answer = "yes" | "no" | null;
const questions = [
  { key: "recent", text: "Have you given blood in the last 2 months?", ok: "no" },
  { key: "well", text: "Are you feeling well today?", ok: "yes" },
  { key: "weight", text: "Do you weigh more than 50 kg?", ok: "yes" },
] as const;
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "Just now" : m < 60 ? `Posted ${m} min ago` : `Posted ${Math.round(m / 60)} h ago`;
};
function directionsUrl(f: NonNullable<NonNullable<Notification["bloodRequest"]>["facility"]>) {
  if (f.coordinates?.length === 2) {
    const [lng, lat] = f.coordinates;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.name} ${f.address}`)}`;
}
export default function RequestAlert() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ["/notifications", "detail", id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      send<{ notifications: Notification[]; pagination: Pagination }>("get", "/notifications", undefined, { page: pageParam, limit: 100 }),
    getNextPageParam: (last) => (last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined),
  });
  const n = q.data?.pages.flatMap((p) => p.notifications).find((x) => x.id === id);
  const action = useAction();
  const mark = useAction();
  const marked = useRef(false);
  const loc = useResource<LocationState>("/donors/me/location");
  const [step, setStep] = useState<"alert" | "check">("alert");
  const [answers, setAnswers] = useState<Record<string, Answer>>({ recent: null, well: null, weight: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!n && q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage();
  }, [n, q]);
  useEffect(() => {
    if (n?.status === "DELIVERED" && !marked.current) {
      marked.current = true;
      mark.mutate({ method: "patch", url: "/notifications/" + id + "/read", body: {} });
    }
  }, [n, id, mark]);
  const respond = async (status: "ACCEPTED" | "DECLINED") => {
    setBusy(true);
    setError(undefined);
    try {
      await submitResponse(status, {
        refresh: async () => (await q.refetch()).data?.pages.flatMap((p) => p.notifications).find((x) => x.id === id),
        // Saying "I can come" is consent to share a fresh location once with LifeLink (never shown to the hospital).
        consent: async () => {
          const state = (await loc.refetch()).data;
          if (state?.locationSharingEnabled) return true;
          await action.mutateAsync({ method: "patch", url: "/donors/me/location-sharing", body: { locationSharingEnabled: true } });
          return true;
        },
        location: devicePoint,
        submit: (body) => action.mutateAsync({ method: "post", url: "/notifications/" + id + "/response", body }),
      });
      await q.refetch();
      if (status === "DECLINED") router.replace("/(donor)/home");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (q.isPending || (!n && q.hasNextPage)) return <Loading />;
  const r = n?.bloodRequest;
  if (q.error || !n || !r)
    return (
      <Page>
        <TopBar title="Blood request" />
        <Notice text={q.error ? errorText(q.error) : "This request is no longer available."} tone={q.error ? "error" : "info"} />
        <BigButton title="Back to home" variant="secondary" onPress={() => router.replace("/(donor)/home")} />
      </Page>
    );
  const open = r.actionable && isActiveRequest(r);
  const units = r.remainingUnits;
  const facility = r.facility;
  // ── After accepting: everything needed to get there ──
  if (n.responseStatus === "ACCEPTED")
    return (
      <Page
        footer={
          open ? (
            <>
              <BigButton title="I've arrived — show my card" icon="qr-code-outline" onPress={() => router.push("/donor/card")} />
              <Body center muted size={14}>Can’t make it? Please call the hospital so they can find someone else.</Body>
            </>
          ) : undefined
        }
      >
        <TopBar onBack={() => router.replace("/(donor)/home")} />
        <View style={{ backgroundColor: "#E8F4EE", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#1F7A4D", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 18, color: "#145A38" }}>Thank you, {user?.name.split(" ")[0]}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: "#1F5A3D" }}>
              {open ? `${facility?.name ?? "The hospital"} knows you're coming.` : "This request is now closed. Thank you for responding."}
            </Text>
          </View>
        </View>
        <Box>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 15, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: font.bold, fontSize: 20, color: "#fff" }}>{displayType(r.patientBloodType)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <H3>{facility?.name ?? "Hospital"}</H3>
              <Body muted size={14}>{facility?.address}</Body>
            </View>
          </View>
        </Box>
        {facility && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <BigButton title="Directions" icon="navigate-outline" variant="secondary" size="medium" onPress={() => void Linking.openURL(directionsUrl(facility))} />
            </View>
            {facility.phone ? (
              <View style={{ flex: 1 }}>
                <BigButton title="Call" icon="call-outline" variant="secondary" size="medium" onPress={() => void Linking.openURL("tel:" + facility.phone!.replace(/\s/g, ""))} />
              </View>
            ) : null}
          </View>
        )}
        <Box style={{ paddingVertical: 4 }}>
          <InfoRow icon="business-outline" title="Go to the blood bank or ask at reception" detail="Say you came through LifeLink" />
          <InfoRow icon="card-outline" title="Bring your ID card" />
          <InfoRow icon="water-outline" title="Eat something and drink water before you go" last />
        </Box>
      </Page>
    );
  // ── Quick eligibility check ──
  if (step === "check" && open && n.responseStatus === "PENDING") {
    const answered = Object.values(answers).every((a) => a !== null);
    const ok = questions.every((qq) => answers[qq.key] === qq.ok);
    return (
      <Page
        footer={
          answered && !ok ? (
            <BigButton title="Not this time" variant="secondary" loading={busy} onPress={() => void respond("DECLINED")} />
          ) : (
            <BigButton title="Confirm — I'm on my way" disabled={!answered} loading={busy} onPress={() => void respond("ACCEPTED")} />
          )
        }
      >
        <TopBar onBack={() => setStep("alert")} />
        <View style={{ gap: 6 }}>
          <H1>Quick check</H1>
          <Body muted>3 questions so you don’t make a wasted trip.</Body>
        </View>
        {questions.map((qq) => (
          <Box key={qq.key}>
            <H3 style={{ lineHeight: 24 }}>{qq.text}</H3>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Choice label="Yes" selected={answers[qq.key] === "yes"} onPress={() => setAnswers({ ...answers, [qq.key]: "yes" })} />
              <Choice label="No" selected={answers[qq.key] === "no"} onPress={() => setAnswers({ ...answers, [qq.key]: "no" })} />
            </View>
          </Box>
        ))}
        {answered && !ok ? (
          <Notice text="Thank you for wanting to help. Based on your answers, today may not be a good day to donate — please rest and we'll alert you next time." />
        ) : (
          <Body center muted size={14}>The hospital will still do a full health check before you donate. Your phone number is shared only with this hospital.</Body>
        )}
        {error ? <Notice text={error} tone="error" /> : null}
      </Page>
    );
  }
  // ── The alert itself ──
  const urgent = r.urgency !== "PLANNED";
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ backgroundColor: c.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <SafeAreaView edges={["top", "left", "right"]}>
          <View style={{ padding: 24, paddingTop: 12, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ backgroundColor: "#fff", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, letterSpacing: 1, color: c.primary }}>{urgent ? r.urgency : "PLANNED"}</Text>
              </View>
              <RoundIcon icon="close" label="Close" dark onPress={() => (router.canGoBack() ? router.back() : router.replace("/(donor)/home"))} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 8 }}>
              <View style={{ width: 92, height: 92, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: font.bold, fontSize: 38, color: c.primary }}>{displayType(r.patientBloodType)}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text accessibilityRole="header" style={{ fontFamily: font.bold, fontSize: 28, lineHeight: 32, color: "#fff" }}>
                  {urgent ? "Blood needed now" : "Blood needed"}
                </Text>
                <Text style={{ fontFamily: font.regular, fontSize: 17, color: "#fff" }}>
                  {units} unit{units === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
      <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 24, gap: 14, maxWidth: 560, width: "100%", alignSelf: "center" }}>
          <Box style={{ paddingVertical: 4 }}>
            <InfoRow icon="business-outline" title={facility?.name ?? "Healthcare facility"} detail={facility?.address} />
            <InfoRow icon="time-outline" title={ago(n.sentAt)} detail={`Open until ${new Date(r.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} last />
          </Box>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Ionicons name="lock-closed-outline" size={18} color={c.muted} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: c.muted }}>
              Your phone number is shared with this hospital only if you say yes.
            </Text>
          </View>
          {error ? <Notice text={error} tone="error" /> : null}
          <View style={{ flex: 1, minHeight: 12 }} />
          {open && n.responseStatus === "PENDING" ? (
            <>
              <BigButton title="I can come" icon="checkmark" onPress={() => setStep("check")} />
              <BigButton title="Not this time" variant="secondary" size="medium" loading={busy} onPress={() => void respond("DECLINED")} />
            </>
          ) : (
            <Notice text={n.responseStatus === "DECLINED" ? "You said not this time. Thank you for letting us know." : "This request is closed. Thank you."} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
