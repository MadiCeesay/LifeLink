import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { StatusPanel } from "../../features/donor/StatusPanel";
import { PushBanner } from "../../features/common/PushBanner";
import { BigButton, Box, H1, Page, font } from "../../components/kit";
import { colors as c } from "../../theme";
export default function Profile() {
  const a = useAuth();
  return (
    <Page>
      <H1>Profile</H1>
      <Box>
        <Text style={{ fontFamily: font.bold, fontSize: 22, color: c.text }}>{a.user?.name}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 16, color: c.muted }}>{a.user?.phone}</Text>
        {a.user?.email ? <Text style={{ fontFamily: font.regular, fontSize: 16, color: c.muted }}>{a.user.email}</Text> : null}
      </Box>
      <BigButton title="Show my donor card" icon="qr-code-outline" variant="secondary" onPress={() => router.push("/donor/card")} />
      <PushBanner />
      <StatusPanel />
      <View style={{ height: 8 }} />
      <BigButton title="Sign out" variant="ghost" size="medium" onPress={() => void a.logout()} />
    </Page>
  );
}
