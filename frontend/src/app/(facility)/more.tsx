import React from "react";
import { Text } from "react-native";
import { useAuth } from "../../providers/AuthProvider";
import { Button, Card, Screen, styles } from "../../components/ui";
export default function More() {
  const a = useAuth();
  return (
    <Screen title="Your staff account">
      <Card>
        <Text style={styles.h2}>{a.user?.name}</Text>
        <Text style={styles.body}>{a.user?.email}</Text>
        <Text selectable style={styles.muted}>
          Staff ID: {a.user?.id}
        </Text>
        <Text style={styles.muted}>
          Permissions are administered by LifeLink. The current API does not
          return your permission list. Each restricted action is checked by the
          server.
        </Text>
      </Card>
      <Button
        title="Refresh account"
        variant="secondary"
        onPress={() => void a.restore()}
      />
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => void a.logout()}
      />
    </Screen>
  );
}
