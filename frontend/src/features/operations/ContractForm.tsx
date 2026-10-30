import { ExpiryInput } from "./ExpiryInput";
import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import contracts from "../../constants/contracts.json";
import { contractSchema, type Contract } from "./schema";
import { useAction } from "../../hooks/api";
import {
  Button,
  Card,
  Choices,
  ConfirmationModal,
  ErrorState,
  Field,
  ToggleRow,
  styles,
} from "../../components/ui";
import { label } from "../../utils/domain";
const fieldLabels: Record<string, string> = {
  donorId: "Accepted donor ID",
  units: "Units confirmed",
  patientBloodType: "Patient blood group",
  unitsNeeded: "Units required",
  expiresAt: "Expires at (ISO date/time with timezone)",
  verifiedBloodType: "Professionally verified blood group",
  referenceNumber: "Facility reference (optional)",
  reasonCode: "Reason category",
  isActive: "Account active",
  facilityType: "Facility type",
  notes: "Administrative context only (optional)",
  name: "Full name",
  email: "Email address",
  phone: "Phone number",
  password: "Initial password",
  reason: "Administrative reason",
  address: "Official address",
  permissions: "Staff permissions",
  status: "Status",
};
export function ContractForm({
  schema,
  method,
  url,
  title,
  detail,
  onSuccess,
  initial = {},
  confirmation = true,
}: {
  schema: keyof typeof contracts;
  method: string;
  url: string;
  title: string;
  detail?: string;
  onSuccess?: (data: unknown) => void;
  initial?: Record<string, unknown>;
  confirmation?: boolean;
}) {
  const contract = contracts[schema] as Contract;
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(contract.properties).map(([n, p]) => [
          n,
          initial[n] ??
            (p.type === "boolean" ? false : p.type === "array" ? [] : ""),
        ]),
      ),
    [contract, initial],
  );
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(contractSchema(contract)),
    defaultValues: defaults,
  });
  const action = useAction();
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [success, setSuccess] = useState(false);
  const submit = async (body: Record<string, unknown>) => {
    try {
      const data = await action.mutateAsync({ method, url, body });
      setPending(null);
      setSuccess(true);
      reset();
      onSuccess?.(data);
    } catch {
      setPending(null);
    }
  };
  return (
    <Card>
      <Text style={styles.h3}>{title}</Text>
      {detail && <Text style={styles.muted}>{detail}</Text>}
      {Object.entries(contract.properties).map(([name, p]) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <View style={{ gap: 8 }}>
              {name === "expiresAt" ? (
                <ExpiryInput
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                />
              ) : p.type === "boolean" ? (
                <ToggleRow
                  title={fieldLabels[name] ?? label(name)}
                  detail="The server checks this change."
                  value={field.value === true}
                  onChange={field.onChange}
                />
              ) : p.type === "array" ? (
                <View style={{ gap: 12 }}>
                  <Text style={styles.caption}>
                    {fieldLabels[name] ?? label(name)}
                  </Text>
                  {(p.items?.enum ?? []).map((v) => (
                    <ToggleRow
                      key={String(v)}
                      title={label(String(v))}
                      detail={permissionCopy[String(v)] ?? ""}
                      value={(field.value as string[]).includes(String(v))}
                      onChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...(field.value as string[]), v]
                            : (field.value as string[]).filter((x) => x !== v),
                        )
                      }
                    />
                  ))}
                </View>
              ) : p.enum ? (
                <Choices
                  label={fieldLabels[name] ?? label(name)}
                  options={p.enum.map(String)}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                />
              ) : (
                <Field
                  label={fieldLabels[name] ?? label(name)}
                  value={String(field.value ?? "")}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry={name === "password"}
                  autoCapitalize={
                    ["email", "password", "expiresAt"].includes(name)
                      ? "none"
                      : "sentences"
                  }
                  keyboardType={
                    p.type === "integer" || p.type === "number"
                      ? "number-pad"
                      : name === "email"
                        ? "email-address"
                        : name === "phone"
                          ? "phone-pad"
                          : "default"
                  }
                  multiline={["reason", "notes", "address"].includes(name)}
                  editable={!action.isPending}
                />
              )}
              {errors[name]?.message && (
                <Text style={styles.error}>
                  {String(errors[name]?.message)}
                </Text>
              )}
            </View>
          )}
        />
      ))}
      {action.error && <ErrorState error={action.error} />}
      {success && (
        <Text accessibilityRole="alert" style={styles.body}>
          Saved successfully.
        </Text>
      )}
      <Button
        title={title}
        loading={action.isPending}
        onPress={handleSubmit((body) => {
          setSuccess(false);
          if (confirmation) setPending(body);
          else void submit(body);
        })}
      />
      <ConfirmationModal
        visible={pending !== null}
        title={title + "?"}
        detail="Confirm that the information is accurate. This change will be recorded by the server."
        busy={action.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void submit(pending)}
      />
    </Card>
  );
}
export const permissionCopy: Record<string, string> = {
  VERIFY_DONORS: "Verify donor profiles and trusted blood groups.",
  CREATE_BLOOD_REQUESTS: "Create facility blood requests.",
  MANAGE_BLOOD_REQUESTS: "Cancel, broadcast and coordinate request responses.",
  CONFIRM_DONATIONS: "Record actual completed donations.",
};
