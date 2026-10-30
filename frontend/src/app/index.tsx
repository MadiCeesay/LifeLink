import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../providers/AuthProvider";
import { roleHome } from "../utils/domain";
import { Loading } from "../components/ui";
export default function Index() {
  const a = useAuth();
  if (a.loading) return <Loading />;
  return <Redirect href={a.user ? roleHome(a.user.role) : "/(auth)/welcome"} />;
}
