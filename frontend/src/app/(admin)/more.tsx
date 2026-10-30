import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { Button, Card, Screen, styles } from "../../components/ui";
export default function More() {
  const a = useAuth();
  return (
    <Screen title="Administration">
      <Button
        title="Account controls"
        variant="secondary"
        onPress={() => router.push("/admin/accounts")}
      />
      <Button
        title="Confirmed donations"
        variant="secondary"
        onPress={() => router.push("/admin/donations")}
      />
      <Button
        title="Donor verification oversight"
        variant="secondary"
        onPress={() => router.push("/admin/donor-oversight")}
      />
      <Card>
        <Text style={styles.h3}>{a.user?.name}</Text>
        <Text style={styles.body}>{a.user?.email}</Text>
      </Card>
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => void a.logout()}
      />
    </Screen>
  );
}
