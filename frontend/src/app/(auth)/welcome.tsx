import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { BigButton, font, type IconName } from "../../components/kit";
import { colors as c } from "../../theme";
const points: { icon: IconName; text: string }[] = [
  {
    icon: "notifications-outline",
    text: "Get an alert when someone near you needs your blood type",
  },
  { icon: "checkmark", text: "Say yes with one tap" },
  {
    icon: "lock-closed-outline",
    text: "Your number and location stay private",
  },
];
export default function Welcome() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View
        style={{
          backgroundColor: c.primary,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <SafeAreaView edges={["top", "left", "right"]}>
          <View
            style={{
              padding: 24,
              paddingTop: 16,
              gap: 24,
              maxWidth: 560,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="water" size={22} color={c.primary} />
              </View>
              <Text
                style={{ fontFamily: font.bold, fontSize: 20, color: "#fff" }}
              >
                LifeLink
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="heart" size={52} color={c.primary} />
                </View>
              </View>
            </View>
            <View style={{ gap: 8, paddingBottom: 12 }}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: font.bold,
                  fontSize: 32,
                  lineHeight: 38,
                  color: "#fff",
                }}
              >
                Give blood.{"\n"}Save a life.
              </Text>
              <Text
                style={{
                  fontFamily: font.regular,
                  fontSize: 17,
                  lineHeight: 24,
                  color: "#fff",
                }}
              >
                Connecting blood donors with hospitals across The Gambia.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
      <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            padding: 24,
            gap: 14,
            maxWidth: 560,
            width: "100%",
            alignSelf: "center",
          }}
        >
          {points.map((p) => (
            <View
              key={p.text}
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: c.tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={p.icon} size={22} color={c.primary} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: font.semibold,
                  fontSize: 16,
                  lineHeight: 22,
                  color: c.text,
                }}
              >
                {p.text}
              </Text>
            </View>
          ))}
          <View style={{ flex: 1, minHeight: 16 }} />
          <BigButton
            title="Become a donor"
            onPress={() => router.push("/(auth)/register")}
          />
          <BigButton
            title="I already have an account"
            variant="secondary"
            size="medium"
            onPress={() => router.push("/(auth)/login")}
          />
          <BigButton
            title="Hospital staff? Sign in here"
            variant="ghost"
            size="medium"
            onPress={() =>
              router.push({ pathname: "/(auth)/login", params: { staff: "1" } })
            }
          />
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}
