import React from "react";
import { Text } from "react-native";
import { useAuth } from "../../providers/AuthProvider";
import { StatusPanel } from "../../features/donor/StatusPanel";
import { Button, Card, Screen, styles } from "../../components/ui";
export default function Profile() {
  const a = useAuth();
  return (
    <Screen title="Your profile">
      <Card>
        <Text style={styles.h2}>{a.user?.name}</Text>
        <Text style={styles.body}>{a.user?.email}</Text>
        <Text style={styles.body}>{a.user?.phone}</Text>
        <Text selectable style={styles.muted}>
          Your donor ID: {a.user?.id}
        </Text>
        <Text style={styles.muted}>
          Show your donor ID to an authorized facility for verification.
        </Text>
      </Card>
      <StatusPanel />
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => void a.logout()}
      />
    </Screen>
  );
}
