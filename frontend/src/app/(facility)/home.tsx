import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { useResource } from "../../hooks/api";
import type { Facility } from "../../types/api";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Loading,
  Screen,
  styles,
} from "../../components/ui";
export default function Home() {
  const q = useResource<Facility>("/facilities/me");
  return (
    <Screen
      title="LifeLink Facility"
      onRefresh={() => void q.refetch()}
      refreshing={q.isFetching}
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Card>
          <Text style={styles.h2}>{q.data?.name}</Text>
          <Badge value={q.data!.verificationStatus} />
          <Text style={styles.body}>{q.data?.address}</Text>
          <Text style={styles.muted}>{q.data?.phone}</Text>
        </Card>
      )}
      <Button
        title="View facility requests"
        onPress={() => router.push("/(facility)/requests")}
      />
      <Button
        title="Create blood request"
        variant="secondary"
        onPress={() => router.push("/facility/create-request")}
      />
      <Button
        title="Verify a donor"
        variant="secondary"
        onPress={() => router.push("/(facility)/verify")}
      />
      <Card>
        <Text style={styles.h3}>Controlled coordination</Text>
        <Text style={styles.muted}>
          Requests use your facility’s official stored location. Donor matching
          stays private. Actions require the corresponding staff permission; the
          server checks each operation.
        </Text>
      </Card>
    </Screen>
  );
}
