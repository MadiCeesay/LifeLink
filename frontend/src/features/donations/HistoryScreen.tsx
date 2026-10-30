import React from "react";
import { Text } from "react-native";
import { PagedList } from "../../components/PagedList";
import {
  Badge,
  BloodTypeBadge,
  Card,
  Screen,
  styles,
} from "../../components/ui";
import type { Donation } from "../../types/api";
import { dateText } from "../../utils/domain";
export function DonationCard({ donation: d }: { donation: Donation }) {
  return (
    <Card>
      <BloodTypeBadge value={d.bloodTypeSnapshot} />
      <Text style={styles.h3}>
        {d.units} unit{d.units === 1 ? "" : "s"} confirmed
      </Text>
      <Badge value="FULFILLED" />
      <Text style={styles.body}>{dateText(d.confirmedAt)}</Text>
      <Text selectable style={styles.muted}>
        Facility ID: {d.facilityId}
      </Text>
      <Text selectable style={styles.muted}>
        Request ID: {d.bloodRequest}
      </Text>
    </Card>
  );
}
export function HistoryScreen({ admin = false }: { admin?: boolean }) {
  return (
    <Screen
      title="Donation history"
      back={admin}
      subtitle="Actual donations confirmed by authorized healthcare staff."
    >
      <PagedList<Donation>
        url={admin ? "/admin/donations" : "/donors/me/donations"}
        field="donations"
        empty="No confirmed donations yet."
        render={(d) => <DonationCard donation={d} />}
      />
    </Screen>
  );
}
