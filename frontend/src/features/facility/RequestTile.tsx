import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useResource } from "../../hooks/api";
import type { BloodRequest } from "../../types/api";
import { BloodChip, Box, Stat, UrgencyTag, font } from "../../components/kit";
import { colors as c } from "../../theme";
import { isActiveRequest, label } from "../../utils/domain";
export type RequestSummary = {
  alerted: number;
  accepted: number;
  declined: number;
  unitsNeeded: number;
  unitsReceived: number;
  radiusStagesKm: number[];
  broadcastRadiusKm: number;
  broadcastStage: number;
  lastBroadcastAt: string | null;
  nextWidenAt: string | null;
};
export const since = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString();
};
export function RequestTile({ request }: { request: BloodRequest }) {
  const active = isActiveRequest(request);
  const s = useResource<RequestSummary>(`/requests/${request.id}/summary`, undefined, active);
  return (
    <Box
      highlight={active && request.urgency === "CRITICAL"}
      label={`${request.patientBloodType} request, ${request.unitsNeeded} units`}
      onPress={() => router.push({ pathname: "/facility/request/[id]", params: { id: request.id } })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <BloodChip type={request.patientBloodType} />
        <View style={{ flex: 1, gap: 3 }}>
          {active ? <UrgencyTag urgency={request.urgency} /> : <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, color: c.muted }}>{label(request.status).toUpperCase()}</Text>}
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.text }}>
            {request.unitsReceived}/{request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} received
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 14, color: c.muted }}>Posted {since(request.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={c.muted} />
      </View>
      {active && s.data && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat value={s.data.alerted} label="Alerted" />
          <Stat value={s.data.accepted} label="Coming" tone="amber" />
          <Stat value={s.data.unitsReceived} label="Donated" tone="green" />
        </View>
      )}
    </Box>
  );
}
