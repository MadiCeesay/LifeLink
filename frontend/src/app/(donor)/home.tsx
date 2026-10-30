import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { useResource } from "../../hooks/api";
import type { Notification, Pagination } from "../../types/api";
import { StatusPanel } from "../../features/donor/StatusPanel";
import { RequestCard } from "../../components/RequestCard";
import {
  Empty,
  ErrorState,
  LinkButton,
  Loading,
  Screen,
  Section,
  styles,
} from "../../components/ui";
import { colors } from "../../theme";
import { isActiveRequest } from "../../utils/domain";
export default function Home() {
  const { user } = useAuth();
  const q = useResource<{
    notifications: Notification[];
    pagination: Pagination;
  }>("/notifications", { page: 1, limit: 20 });
  const h = new Date().getHours();
  return (
    <Screen
      title="LifeLink"
      subtitle="Here for each other."
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          onPress={() => router.push("/donor/notifications")}
          style={{ padding: 12, minHeight: 48 }}
        >
          <Ionicons
            name="notifications-outline"
            color={colors.primary}
            size={26}
          />
        </Pressable>
      }
      refreshing={q.isFetching}
      onRefresh={() => void q.refetch()}
    >
      <View style={{ gap: 8 }}>
        <Text style={styles.h2}>
          Good {h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"},{" "}
          {user?.name.split(" ")[0]}
        </Text>
        <Text style={styles.muted}>Ready to make a difference?</Text>
      </View>
      <StatusPanel compact />
      <LinkButton
        title="Manage location & profile →"
        onPress={() => router.push("/(donor)/profile")}
      />
      <Section
        title="Your latest requests"
        action={
          <LinkButton
            title="See all"
            onPress={() => router.push("/(donor)/requests")}
          />
        }
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        q.data?.notifications
          .filter((n) => n.bloodRequest && isActiveRequest(n.bloodRequest))
          .slice(0, 3)
          .map((n) => (
            <RequestCard
              key={n.id}
              request={n.bloodRequest!}
              responseStatus={n.responseStatus}
              onPress={() =>
                router.push({
                  pathname: "/donor/notification/[id]",
                  params: { id: n.id },
                })
              }
            />
          ))
      )}
      {q.data &&
        !q.data.notifications.some(
          (n) => n.bloodRequest && isActiveRequest(n.bloodRequest),
        ) && (
          <Empty
            title="No active requests in your latest notifications"
            detail="Relevant requests will appear when a facility contacts you through LifeLink. View all requests to browse your inbox history."
          />
        )}
    </Screen>
  );
}
