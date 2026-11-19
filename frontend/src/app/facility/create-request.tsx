import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { send } from "../../services/client";
import { useQueryClient } from "@tanstack/react-query";
import type { BloodRequest } from "../../types/api";
import { BigButton, Body, Choice, H3, Notice, Page, TopBar, displayType, errorText, font } from "../../components/kit";
import { colors as c } from "../../theme";
import { bloodTypes } from "../../utils/domain";
type Urgency = "CRITICAL" | "URGENT" | "PLANNED";
// How long each kind of request stays open (server maximum is 72 h).
const lifetimeHours: Record<Urgency, number> = { CRITICAL: 12, URGENT: 24, PLANNED: 71 };
export default function NewRequest() {
  const client = useQueryClient();
  const [type, setType] = useState<string | null>(null);
  const [units, setUnits] = useState(1);
  const [urgency, setUrgency] = useState<Urgency>("CRITICAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    if (!type) return;
    setBusy(true);
    setError(undefined);
    try {
      const expiresAt = new Date(Date.now() + lifetimeHours[urgency] * 3600000).toISOString();
      const request = await send<BloodRequest>("post", "/requests", { patientBloodType: type, unitsNeeded: units, urgency, expiresAt });
      let broadcastFailed = false;
      try {
        await send("post", `/requests/${request.id}/broadcast`, { idempotencyKey: Crypto.randomUUID() });
      } catch {
        broadcastFailed = true;
      }
      await client.invalidateQueries();
      router.replace({ pathname: "/facility/request/[id]", params: { id: request.id, ...(broadcastFailed ? { alert: "retry" } : {}) } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      footer={
        <>
          <Body muted size={14}>Donors within 5 km are alerted first. LifeLink widens the search by itself if not enough say yes.</Body>
          <BigButton title={type ? `Alert ${displayType(type)} donors now` : "Choose a blood type"} icon="notifications" disabled={!type} loading={busy} onPress={() => void submit()} />
        </>
      }
    >
      <TopBar title="New request" />
      <View style={{ gap: 10 }}>
        <H3>Blood type</H3>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {bloodTypes.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === t }}
              accessibilityLabel={t}
              onPress={() => setType(t)}
              style={{
                width: "23%",
                flexGrow: 1,
                height: 58,
                borderRadius: 14,
                borderWidth: type === t ? 0 : 1,
                borderColor: "#DAD7D3",
                backgroundColor: type === t ? c.primary : c.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 19, color: type === t ? "#fff" : c.text }}>{displayType(t)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <H3>Units needed</H3>
        <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fewer units" disabled={units <= 1} onPress={() => setUnits(Math.max(1, units - 1))} style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: "#F5F4F2", alignItems: "center", justifyContent: "center", opacity: units <= 1 ? 0.4 : 1 }}>
            <Ionicons name="remove" size={28} color={c.text} />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.bold, fontSize: 34, color: c.text }}>{units}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="More units" disabled={units >= 20} onPress={() => setUnits(Math.min(20, units + 1))} style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: "#F5F4F2", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="add" size={28} color={c.text} />
          </Pressable>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <H3>How urgent?</H3>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Choice label="Critical" sub="Now" height={66} selected={urgency === "CRITICAL"} onPress={() => setUrgency("CRITICAL")} />
          <Choice label="Urgent" sub="Today" height={66} selected={urgency === "URGENT"} onPress={() => setUrgency("URGENT")} />
          <Choice label="Planned" sub="This week" height={66} selected={urgency === "PLANNED"} onPress={() => setUrgency("PLANNED")} />
        </View>
      </View>
      <Body muted size={14}>Don’t include patient names or medical details. Donors only see the blood type, units and your hospital.</Body>
      {error ? <Notice text={error} tone="error" /> : null}
    </Page>
  );
}
