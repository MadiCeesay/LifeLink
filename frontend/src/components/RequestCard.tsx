import React from "react";
import { Text, View } from "react-native";
import { Badge, BloodTypeBadge, Card, LinkButton, styles } from "./ui";
import { dateText } from "../utils/domain";
type RequestSummary = {
  patientBloodType: string;
  urgency: string;
  status: string;
  unitsNeeded: number;
  remainingUnits: number;
  expiresAt: string;
  facility?: { name: string } | null;
};
export function RequestCard({
  request,
  onPress,
  responseStatus,
}: {
  request: RequestSummary;
  onPress: () => void;
  responseStatus?: string;
}) {
  return (
    <Card>
      <View style={styles.between}>
        <BloodTypeBadge value={request.patientBloodType} />
        <View style={{ gap: 8, alignItems: "flex-end" }}>
          <Badge value={request.urgency} />
          <Badge value={request.status} />
        </View>
      </View>
      <Text style={styles.h3}>{request.patientBloodType} blood needed</Text>
      <Text style={styles.muted}>
        {request.facility?.name ?? "Facility blood request"}
      </Text>
      <Text style={styles.body}>
        {request.remainingUnits} of {request.unitsNeeded} units remaining
      </Text>
      <Text style={styles.muted}>Expires {dateText(request.expiresAt)}</Text>
      <View style={styles.between}>
        {responseStatus ? <Badge value={responseStatus} /> : <View />}
        <LinkButton title="View request →" onPress={onPress} />
      </View>
    </Card>
  );
}
