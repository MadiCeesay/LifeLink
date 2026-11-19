// Simple, large-target building blocks for the redesigned screens.
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { colors as c } from "../theme";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export const font = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};
export const displayType = (t?: string | null) => (t ? t.replace("-", "−") : "");
export function Page({
  children,
  refreshing,
  onRefresh,
  footer,
  padded = true,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: padded ? 20 : 0,
            paddingBottom: 32,
            gap: 16,
            flexGrow: 1,
            maxWidth: 560,
            width: "100%",
            alignSelf: "center",
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={c.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer && (
          <View
            style={{
              padding: 20,
              paddingTop: 12,
              gap: 10,
              maxWidth: 560,
              width: "100%",
              alignSelf: "center",
            }}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function TopBar({
  title,
  back = true,
  onBack,
  right,
}: {
  title?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {back && (
        <RoundIcon
          icon="chevron-back"
          label="Go back"
          onPress={
            onBack ??
            (() => (router.canGoBack() ? router.back() : router.replace("/")))
          }
        />
      )}
      {title ? (
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontFamily: font.bold, fontSize: 24, color: c.text }}
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}
export function RoundIcon({
  icon,
  label,
  onPress,
  dark = false,
  dot = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  dark?: boolean;
  dot?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: dark ? "rgba(255,255,255,0.18)" : c.surface,
        borderWidth: dark ? 0 : 1,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={22} color={dark ? "#fff" : c.text} />
      {dot && (
        <View
          style={{
            position: "absolute",
            top: 9,
            right: 10,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.primary,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      )}
    </Pressable>
  );
}
export function BigButton({
  title,
  onPress,
  icon,
  variant = "primary",
  loading = false,
  disabled = false,
  size = "large",
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "success" | "ghost" | "white";
  loading?: boolean;
  disabled?: boolean;
  size?: "large" | "medium";
}) {
  const bg = {
    primary: c.primary,
    secondary: c.surface,
    success: "#1F7A4D",
    ghost: "transparent",
    white: "#fff",
  }[variant];
  const fg =
    variant === "primary" || variant === "success"
      ? "#fff"
      : variant === "white"
        ? c.primary
        : variant === "ghost"
          ? c.muted
          : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: size === "large" ? 62 : 54,
        borderRadius: 18,
        backgroundColor: disabled ? c.disabled : bg,
        borderWidth: variant === "secondary" ? 1 : 0,
        borderColor: "#DAD7D3",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 18,
        opacity: pressed || loading ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={22} color={disabled ? c.muted : fg} />}
          <Text
            style={{
              fontFamily: variant === "secondary" || variant === "ghost" ? font.semibold : font.bold,
              fontSize: size === "large" ? 19 : 17,
              color: disabled ? c.muted : fg,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function Box({
  children,
  style,
  onPress,
  label,
  highlight = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  label?: string;
  highlight?: boolean;
}) {
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderWidth: highlight ? 2 : 1,
    borderColor: highlight ? c.primary : c.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [base, style, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}
export function H1({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: font.bold, fontSize: 28, color: c.text }}>
      {children}
    </Text>
  );
}
export function H3({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[{ fontFamily: font.bold, fontSize: 17, color: c.text }, style]}>{children}</Text>;
}
export function Body({ children, muted = false, center = false, size = 16 }: { children: React.ReactNode; muted?: boolean; center?: boolean; size?: number }) {
  return (
    <Text style={{ fontFamily: font.regular, fontSize: size, lineHeight: size * 1.45, color: muted ? c.muted : c.text, textAlign: center ? "center" : "left" }}>
      {children}
    </Text>
  );
}
export function BloodChip({ type, size = 56, solid = false }: { type: string; size?: number; solid?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        backgroundColor: solid ? c.primary : c.tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.36, color: solid ? "#fff" : c.primaryDark }}>
        {displayType(type)}
      </Text>
    </View>
  );
}
export function UrgencyTag({ urgency }: { urgency: string }) {
  const critical = urgency === "CRITICAL";
  const planned = urgency === "PLANNED";
  return (
    <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, color: critical ? c.primary : planned ? c.muted : "#8A5300" }}>
      {urgency}
    </Text>
  );
}
export function Stat({ value, label, tone = "neutral" }: { value: string | number; label: string; tone?: "neutral" | "amber" | "green" }) {
  const bg = tone === "amber" ? "#FFF4E0" : tone === "green" ? "#E8F4EE" : "#F5F4F2";
  const fg = tone === "amber" ? "#8A5300" : tone === "green" ? "#145A38" : c.text;
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, padding: 12, gap: 2 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 24, color: fg }}>{value}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13, color: tone === "neutral" ? c.muted : fg }}>{label}</Text>
    </View>
  );
}
export function InfoRow({ icon, title, detail, last = false }: { icon: IconName; title: string; detail?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: "#F0EEEB" }}>
      <Ionicons name={icon} size={22} color={c.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 16, color: c.text }}>{title}</Text>
        {detail ? <Text style={{ fontFamily: font.regular, fontSize: 14, color: c.muted }}>{detail}</Text> : null}
      </View>
    </View>
  );
}
export function Notice({ text, tone = "info" }: { text: string; tone?: "info" | "error" | "success" }) {
  const bg = tone === "error" ? c.tint : tone === "success" ? "#E8F4EE" : "#F5F4F2";
  const fg = tone === "error" ? c.primaryDark : tone === "success" ? "#145A38" : c.text;
  return (
    <View accessibilityRole={tone === "error" ? "alert" : undefined} style={{ backgroundColor: bg, borderRadius: 14, padding: 14 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: fg }}>{text}</Text>
    </View>
  );
}
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export function Choice({ label, selected, onPress, sub, height = 56 }: { label: string; selected: boolean; onPress: () => void; sub?: string; height?: number }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: height,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.primary : "#DAD7D3",
        backgroundColor: selected ? c.tint : c.surface,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 17, color: selected ? c.primaryDark : c.text }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: font.regular, fontSize: 12, color: selected ? c.primaryDark : c.muted }}>{sub}</Text> : null}
    </Pressable>
  );
}
