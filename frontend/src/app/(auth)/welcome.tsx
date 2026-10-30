import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Button, Screen, styles, Card } from "../../components/ui";
import { colors as c, space as s } from "../../theme";
export default function Welcome() {
  return (
    <Screen title="LifeLink" subtitle="Here for each other.">
      <View
        style={{
          backgroundColor: c.tint,
          borderRadius: 24,
          padding: s.xxl,
          minHeight: 210,
          justifyContent: "center",
          gap: s.lg,
        }}
      >
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 24,
            backgroundColor: c.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="heart" size={40} color={c.surface} />
        </View>
        <Text style={[styles.title, { color: c.primaryDark, fontSize: 32 }]}>
          A connection that could change a life.
        </Text>
      </View>
      <Text style={styles.h2}>
        Connecting donors when every minute matters.
      </Text>
      <Text style={styles.body}>
        Join a community ready to respond to blood requests from verified
        healthcare facilities in The Gambia.
      </Text>
      <Card>
        <Text style={styles.h3}>Your choice. Your privacy.</Text>
        <Text style={styles.muted}>
          Choose when you are available. Your exact location stays private.
          Every donation follows facility screening.
        </Text>
      </Card>
      <Button
        title="Create donor account"
        onPress={() => router.push("/(auth)/register")}
      />
      <Button
        title="Sign in"
        variant="secondary"
        onPress={() => router.push("/(auth)/login")}
      />
      <Text style={[styles.muted, { textAlign: "center" }]}>
        Facility staff and administrators use the same sign-in.
      </Text>
    </Screen>
  );
}
