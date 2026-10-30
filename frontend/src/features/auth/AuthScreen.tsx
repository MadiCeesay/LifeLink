import React, { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../providers/AuthProvider";
import { loginSchema, registrationSchema } from "./schemas";
import {
  Button,
  Card,
  ErrorState,
  Field,
  Screen,
  styles,
} from "../../components/ui";
export function AuthScreen({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const [error, setError] = useState<unknown>();
  const schema = register ? registrationSchema : loginSchema;
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      ...(register ? { name: "", phone: "" } : {}),
    },
  });
  return (
    <Screen
      back
      title={register ? "Become a LifeLink donor" : "Welcome back"}
      subtitle={
        register
          ? "A small commitment. A meaningful connection."
          : "Sign in to your LifeLink account."
      }
    >
      <Card>
        {(register
          ? ["name", "email", "phone", "password"]
          : ["email", "password"]
        ).map((name) => (
          <Controller
            key={name}
            name={name as "email"}
            control={control}
            render={({ field }) => (
              <Field
                label={
                  name === "name"
                    ? "Full name"
                    : name === "email"
                      ? "Email address"
                      : name === "phone"
                        ? "Phone number"
                        : "Password"
                }
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry={name === "password"}
                autoCapitalize={name === "name" ? "words" : "none"}
                keyboardType={
                  name === "email"
                    ? "email-address"
                    : name === "phone"
                      ? "phone-pad"
                      : "default"
                }
                autoComplete={
                  name === "password"
                    ? register
                      ? "new-password"
                      : "current-password"
                    : name === "email"
                      ? "email"
                      : name === "phone"
                        ? "tel"
                        : "name"
                }
                error={
                  (errors as Record<string, { message?: string }>)[name]
                    ?.message
                }
              />
            )}
          />
        ))}
        {register && (
          <Text style={styles.muted}>
            New donors start unverified. An approved facility verifies your
            profile and blood group. Use a password of at least 12 characters.
          </Text>
        )}
        {error != null && <ErrorState error={error} />}
        <Button
          title={register ? "Create donor account" : "Sign in"}
          loading={isSubmitting}
          onPress={handleSubmit(async (body) => {
            setError(undefined);
            try {
              await auth.authenticate(register ? "register" : "login", body);
            } catch (e) {
              setError(e);
            }
          })}
        />
      </Card>
      <Button
        title={
          register
            ? "Already registered? Sign in"
            : "New here? Create donor account"
        }
        variant="text"
        onPress={() =>
          router.replace(register ? "/(auth)/login" : "/(auth)/register")
        }
      />
    </Screen>
  );
}
