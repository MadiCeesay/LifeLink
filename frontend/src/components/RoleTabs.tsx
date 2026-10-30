import React from "react";
import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../providers/AuthProvider";
import { roleHome, type Role } from "../utils/domain";
import { colors } from "../theme";
import { Loading } from "./ui";
export function RoleTabs({
  role,
  items,
}: {
  role: Role;
  items: {
    name: string;
    title: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
  }[];
}) {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  if (!auth.user) return <Redirect href="/(auth)/welcome" />;
  if (auth.user.role !== role)
    return <Redirect href={roleHome(auth.user.role)} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
      }}
    >
      {items.map((i) => (
        <Tabs.Screen
          key={i.name}
          name={i.name}
          options={{
            title: i.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={i.icon}
                color={typeof color === "string" ? color : colors.muted}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
