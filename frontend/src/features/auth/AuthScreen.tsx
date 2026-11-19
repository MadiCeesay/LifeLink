import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";
import { send } from "../../services/client";
import type { Session } from "../../types/api";
import { BigButton, Body, H1, Notice, Page, TopBar, errorText, font } from "../../components/kit";
import { colors as c } from "../../theme";
import { fullPhone } from "../../utils/phone";
type Step = "phone" | "code" | "name";
type Options = { smsCodes: boolean; passwordSignIn: boolean };
function Input({
  label,
  value,
  onChange,
  error,
  prefix,
  secure,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  prefix?: string;
  secure?: boolean;
} & Omit<React.ComponentProps<typeof TextInput>, "onChange" | "value">) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 17, color: c.text }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {prefix && (
          <View style={{ height: 60, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "#DAD7D3", backgroundColor: c.surface, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 20, color: c.text }}>{prefix}</Text>
          </View>
        )}
        <TextInput
          {...rest}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure && !show}
          placeholderTextColor={c.muted}
          style={{
            flex: 1,
            minWidth: 0,
            height: 60,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: error ? c.danger : "#DAD7D3",
            backgroundColor: c.surface,
            fontFamily: font.semibold,
            fontSize: 20,
            color: c.text,
          }}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? "Hide password" : "Show password"}
            onPress={() => setShow(!show)}
            style={{ width: 52, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={24} color={c.muted} />
          </Pressable>
        )}
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: font.regular, fontSize: 14 }}>{error}</Text> : null}
    </View>
  );
}
export function AuthScreen({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const params = useLocalSearchParams<{ staff?: string }>();
  const options = useQuery({ queryKey: ["/auth/options"], queryFn: () => send<Options>("get", "/auth/options"), retry: 1 });
  const [usePassword, setUsePassword] = useState(params.staff === "1");
  const [useEmail, setUseEmail] = useState(params.staff === "1");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const sms = options.data?.smsCodes === true && !usePassword;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const phoneOk = phone.replace(/\D/g, "").length >= 7;
  const requestCode = () =>
    run(async () => {
      await send("post", "/auth/code/request", { phone: fullPhone(phone), purpose: "SIGN_IN" });
      setCode("");
      setStep("code");
      setInfo("We sent a 6-digit code by SMS.");
    });
  const verifyCode = () =>
    run(async () => {
      const r = await send<{ status: string; session?: Session; signupToken?: string }>("post", "/auth/code/verify", { phone: fullPhone(phone), code });
      if (r.status === "SIGNED_IN" && r.session) await auth.adopt(r.session);
      else if (r.signupToken) {
        setSignupToken(r.signupToken);
        setStep("name");
      }
    });
  const completeSignup = () =>
    run(async () => {
      const s = await send<Session>("post", "/auth/code/complete", { signupToken, name: name.trim() });
      await auth.adopt(s);
    });
  const passwordSubmit = () =>
    run(async () => {
      if (register) await auth.authenticate("register", { name: name.trim(), phone: fullPhone(phone), password });
      else if (useEmail) await auth.authenticate("login", { email: email.trim(), password });
      else await auth.authenticate("login", { phone: fullPhone(phone), password });
    });
  const title = params.staff === "1" ? "Staff sign in" : register ? "Become a donor" : "Welcome back";
  const subtitle =
    params.staff === "1"
      ? "For hospital staff and administrators."
      : sms
        ? "Enter your phone number. We'll text you a code — no password needed."
        : register
          ? "It takes less than a minute."
          : "Sign in with your phone number.";
  return (
    <Page>
      <TopBar
        onBack={step === "phone" ? undefined : () => setStep("phone")}
      />
      <View style={{ gap: 6 }}>
        <H1>{step === "code" ? "Enter your code" : step === "name" ? "What's your name?" : title}</H1>
        <Body muted>
          {step === "code"
            ? `Sent to ${fullPhone(phone)}. It expires in 5 minutes.`
            : step === "name"
              ? "This is how the hospital will know you."
              : subtitle}
        </Body>
      </View>
      {options.isPending && !usePassword ? (
        <Body muted>Loading…</Body>
      ) : sms ? (
        <>
          {step === "phone" && (
            <>
              <Input label="Your phone number" prefix="+220" value={phone} onChange={setPhone} placeholder="7XX XXXX" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
              <BigButton title="Send me a code" disabled={!phoneOk} loading={busy} onPress={() => void requestCode()} />
            </>
          )}
          {step === "code" && (
            <>
              <Input label="6-digit code" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} />
              <BigButton title="Continue" disabled={code.length !== 6} loading={busy} onPress={() => void verifyCode()} />
              <BigButton title="Send a new code" variant="ghost" size="medium" disabled={busy} onPress={() => void requestCode()} />
            </>
          )}
          {step === "name" && (
            <>
              <Input label="Full name" value={name} onChange={setName} placeholder="e.g. Awa Jallow" autoCapitalize="words" autoComplete="name" />
              <BigButton title="Create my account" disabled={name.trim().length < 2} loading={busy} onPress={() => void completeSignup()} />
            </>
          )}
        </>
      ) : (
        <>
          {register && <Input label="Full name" value={name} onChange={setName} placeholder="e.g. Awa Jallow" autoCapitalize="words" autoComplete="name" />}
          {useEmail ? (
            <Input label="Email address" value={email} onChange={setEmail} placeholder="name@hospital.gm" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          ) : (
            <Input label="Your phone number" prefix="+220" value={phone} onChange={setPhone} placeholder="7XX XXXX" keyboardType="phone-pad" autoComplete="tel" />
          )}
          <Input
            label={register ? "Choose a password" : "Password"}
            value={password}
            onChange={setPassword}
            secure
            placeholder={register ? "At least 8 characters" : ""}
            autoCapitalize="none"
            autoComplete={register ? "new-password" : "current-password"}
          />
          <BigButton
            title={register ? "Create my account" : "Sign in"}
            loading={busy}
            disabled={(useEmail ? !email.includes("@") : !phoneOk) || password.length < (register ? 8 : 1) || (register && name.trim().length < 2)}
            onPress={() => void passwordSubmit()}
          />
        </>
      )}
      {info && !error ? <Notice text={info} tone="success" /> : null}
      {error ? <Notice text={error} tone="error" /> : null}
      {step === "phone" && (
        <View style={{ gap: 4 }}>
          {options.data?.smsCodes && params.staff !== "1" && (
            <BigButton title={usePassword ? "Use an SMS code instead" : "Use a password instead"} variant="ghost" size="medium" onPress={() => { setUsePassword(!usePassword); setUseEmail(false); setError(undefined); }} />
          )}
          {!register && !sms && (
            <BigButton title={useEmail ? "Use phone number instead" : "Use email instead"} variant="ghost" size="medium" onPress={() => { setUseEmail(!useEmail); setError(undefined); }} />
          )}
          {params.staff !== "1" && (
            <BigButton
              title={register ? "Already have an account? Sign in" : "New here? Become a donor"}
              variant="ghost"
              size="medium"
              onPress={() => router.replace(register ? "/(auth)/login" : "/(auth)/register")}
            />
          )}
        </View>
      )}
    </Page>
  );
}
