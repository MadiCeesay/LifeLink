import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useResource } from "../../hooks/api";
import type { Stats, Facility } from "../../types/api";
import {
  Button,
  Card,
  ErrorState,
  Loading,
  Screen,
  Section,
  styles,
} from "../../components/ui";
import { PagedList } from "../../components/PagedList";
import { label } from "../../utils/domain";
export default function Overview() {
  const q = useResource<Stats>("/admin/stats");
  return (
    <Screen
      title="LifeLink Administration"
      subtitle="A clear view of coordination."
      onRefresh={() => void q.refetch()}
      refreshing={q.isFetching}
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {Object.entries(q.data!).map(([k, v]) => (
            <View key={k} style={{ width: "47%", flexGrow: 1 }}>
              <Card>
                <Text style={styles.title}>{v}</Text>
                <Text style={styles.muted}>
                  {label(k.replace(/([A-Z])/g, " $1"))}
                </Text>
              </Card>
            </View>
          ))}
        </View>
      )}
      <Section title="Pending facilities" />
      <PagedList<Facility>
        url="/admin/facilities"
        params={{ status: "PENDING" }}
        field="facilities"
        empty="No pending facilities."
        render={(f) => (
          <Card>
            <Text style={styles.h3}>{f.name}</Text>
            <Button
              title="Review facility"
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
