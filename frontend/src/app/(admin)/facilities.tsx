import React, { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { PagedList } from "../../components/PagedList";
import {
  Badge,
  Button,
  Card,
  Choices,
  Screen,
  styles,
} from "../../components/ui";
import type { Facility } from "../../types/api";
export default function Facilities() {
  const [status, setStatus] = useState("ALL");
  return (
    <Screen
      title="Facilities"
      subtitle="Review and manage official facilities."
    >
      <Button
        title="Create pending facility"
        onPress={() => router.push("/admin/create-facility")}
      />
      <Choices
        label="Filter by status"
        options={["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"]}
        value={status}
        onChange={setStatus}
      />
      <PagedList<Facility>
        key={status}
        url="/admin/facilities"
        params={status === "ALL" ? undefined : { status }}
        field="facilities"
        empty="No facilities match this view."
        render={(f) => (
          <Card>
            <Text style={styles.h3}>{f.name}</Text>
            <Badge value={f.verificationStatus} />
            <Text style={styles.body}>{f.address}</Text>
            <Button
              title="Manage facility"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/admin/facility/[id]",
                  params: { id: f.id },
                })
              }
            />
          </Card>
        )}
      />
    </Screen>
  );
}
