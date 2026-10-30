import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  colors as c,
  space as s,
  radius as r,
  typography as t,
} from "../theme";
import { label, tone } from "../utils/domain";
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.background },
  content: { padding: s.page, gap: s.lg, paddingBottom: s.hero },
  row: { flexDirection: "row", alignItems: "center", gap: s.md },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: s.md,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: t.h1, color: c.text },
  h2: { fontFamily: "Inter_600SemiBold", fontSize: t.h2, color: c.text },
  h3: { fontFamily: "Inter_600SemiBold", fontSize: t.h3, color: c.text },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: t.bodyLarge,
    lineHeight: 24,
    color: c.text,
  },
  muted: {
    fontFamily: "Inter_400Regular",
    fontSize: t.body,
    lineHeight: 21,
    color: c.muted,
  },
  caption: {
    fontFamily: "Inter_600SemiBold",
    fontSize: t.caption,
    color: c.muted,
  },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.card,
    padding: s.lg,
    gap: s.md,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.input,
    paddingHorizontal: s.md,
    color: c.text,
    backgroundColor: c.surface,
    fontFamily: "Inter_400Regular",
    fontSize: t.bodyLarge,
  },
  error: { color: c.danger, fontFamily: "Inter_400Regular", fontSize: t.body },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: s.xs,
    paddingHorizontal: s.sm,
    borderRadius: r.small,
  },
  button: {
    minHeight: 50,
    borderRadius: r.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s.lg,
    flexDirection: "row",
    gap: s.sm,
    borderWidth: 1,
  },
  link: {
    color: c.primary,
    fontFamily: "Inter_600SemiBold",
    fontSize: t.bodyLarge,
  },
  divider: { height: 1, backgroundColor: c.border },
});
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  refreshing,
  onRefresh,
  action,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  back?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
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
          <View style={styles.between}>
            <View style={{ flex: 1, gap: s.sm }}>
              {back && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.replace("/")
                  }
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Ionicons name="arrow-back" size={24} color={c.text} />
                </Pressable>
              )}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
            </View>
            {action}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "text";
}) {
  const bg =
    variant === "primary"
      ? c.primary
      : variant === "danger"
        ? c.danger
        : variant === "secondary"
          ? c.surface
          : "transparent";
  const fg =
    variant === "primary" || variant === "danger" ? c.surface : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? c.disabled : bg,
          borderColor: variant === "secondary" ? c.border : "transparent",
          opacity: pressed || loading ? 0.7 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: t.button,
            color: disabled ? c.muted : fg,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({
  label: caption,
  error,
  secureTextEntry,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: s.sm }}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.row}>
        <TextInput
          {...props}
          accessibilityLabel={caption}
          secureTextEntry={secureTextEntry && !show}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={c.muted}
          style={[
            styles.input,
            {
              flex: 1,
              borderColor: error ? c.danger : focused ? c.primary : c.border,
            },
          ]}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setShow(!show)}
            accessibilityRole="button"
            accessibilityLabel={show ? "Hide password" : "Show password"}
            style={{
              minWidth: 44,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name={show ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={c.muted}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function Badge({ value }: { value: string }) {
  const kind = tone(value);
  const fg =
    kind === "success"
      ? c.success
      : kind === "warning"
        ? c.warning
        : kind === "danger"
          ? c.danger
          : c.muted;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:
            kind === "success"
              ? c.greenTint
              : kind === "warning"
                ? c.amberTint
                : kind === "danger"
                  ? c.tint
                  : c.background,
        },
      ]}
    >
      <Text
        style={{
          fontSize: t.caption,
          fontFamily: "Inter_600SemiBold",
          color: fg,
        }}
      >
        {label(value)}
      </Text>
    </View>
  );
}
export function BloodTypeBadge({ value }: { value: string }) {
  return (
    <View
      style={{
        backgroundColor: c.tint,
        borderRadius: r.input,
        padding: s.md,
        minWidth: 62,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: t.h2,
          color: c.primary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
export function Section({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.between}>
      <Text accessibilityRole="header" style={styles.h3}>
        {title}
      </Text>
      {action}
    </View>
  );
}
export function LinkButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card>
      <Ionicons name="heart-outline" size={28} color={c.muted} />
      <Text style={styles.h3}>{title}</Text>
      {detail && <Text style={styles.muted}>{detail}</Text>}
    </Card>
  );
}
export function Loading() {
  return (
    <View accessibilityLabel="Loading" style={{ padding: s.xxl, gap: s.md }}>
      <ActivityIndicator color={c.primary} />
      <Text style={[styles.muted, { textAlign: "center" }]}>
        Loading LifeLink…
      </Text>
    </View>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Card>
      <Text accessibilityRole="alert" style={styles.error}>
        {error instanceof Error
          ? error.message
          : "Unable to load this information. Please retry."}
      </Text>
      {retry && (
        <Button title="Try again" variant="secondary" onPress={retry} />
      )}
    </Card>
  );
}
export function ToggleRow({
  title,
  detail,
  value,
  onChange,
  disabled,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: s.xs }}>
        <Text style={styles.h3}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: c.primary, false: c.border }}
      />
    </View>
  );
}
export function ConfirmationModal({
  visible,
  title,
  detail,
  onConfirm,
  onCancel,
  busy = false,
}: {
  visible: boolean;
  title: string;
  detail: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          padding: s.xl,
        }}
      >
        <Card>
          <Text style={styles.h2}>{title}</Text>
          <Text style={styles.body}>{detail}</Text>
          <Button title="Confirm" onPress={onConfirm} loading={busy} />
          <Button
            title="Go back"
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
          />
        </Card>
      </View>
    </Modal>
  );
}
export function Choices({
  label: caption,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: s.sm }}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {options.map((o) => (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ selected: o === value }}
            onPress={() => onChange(o)}
            style={[
              styles.button,
              {
                minWidth: 54,
                backgroundColor: value === o ? c.primary : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Text
              style={{
                color: value === o ? c.surface : c.text,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {label(o)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
