import React, { useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useResource, useAction } from "../../../hooks/api";
import type { Facility, Staff } from "../../../types/api";
import { devicePoint } from "../../../services/location";
import {
  Badge,
  Button,
  Card,
  ConfirmationModal,
  ErrorState,
  Field,
  Loading,
  Screen,
  styles,
} from "../../../components/ui";
import { ContractForm } from "../../../features/operations/ContractForm";
import { dateText } from "../../../utils/domain";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useResource<Facility>("/admin/facilities/" + id);
  const action = useAction();
  const [locationConfirm, setLocationConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [staff, setStaff] = useState<Staff | null>(null),
    [staffInput, setStaffInput] = useState(""),
    [staffId, setStaffId] = useState("");
  const setLocation = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const point = await devicePoint();
      await action.mutateAsync({
        method: "put",
        url: "/admin/facilities/" + id + "/location",
        body: point,
      });
      setLocationConfirm(false);
    } catch (e) {
      setLocationConfirm(false);
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const f = q.data;
  const transitions =
    f?.verificationStatus === "PENDING"
      ? ["approve", "reject"]
      : f?.verificationStatus === "APPROVED"
        ? ["suspend"]
        : f?.verificationStatus === "SUSPENDED"
          ? ["reactivate"]
          : [];
  return (
    <Screen
      back
      title="Manage facility"
      refreshing={q.isFetching}
      onRefresh={() => void q.refetch()}
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        f && (
          <>
            <Card>
              <Text style={styles.h2}>{f.name}</Text>
              <Badge value={f.verificationStatus} />
              <Text style={styles.body}>{f.address}</Text>
              <Text style={styles.body}>{f.phone}</Text>
              <Text style={styles.body}>{f.email}</Text>
              <Text selectable style={styles.muted}>
                Facility ID: {f.id}
              </Text>
              <Text style={styles.muted}>
                Reference: {f.referenceNumber ?? "Not provided"}
              </Text>
            </Card>
            {transitions.map((t) => (
              <ContractForm
                key={t}
                schema="Reason"
                method="patch"
                url={"/admin/facilities/" + id + "/" + t}
                title={t.charAt(0).toUpperCase() + t.slice(1) + " facility"}
              />
            ))}
            <Card>
              <Text style={styles.h3}>Official facility location</Text>
              <Text style={styles.muted}>
                Only use this action while physically at the facility. Your
                device position becomes the official origin for future requests.
                The API does not return saved official coordinates in this
                facility view.
              </Text>
              <Button
                title="Set location from this device"
                variant="secondary"
                loading={busy}
                onPress={() => setLocationConfirm(true)}
              />
              {action.isSuccess && (
                <Text style={styles.body}>Official location updated.</Text>
              )}
            </Card>
            {error != null && <ErrorState error={error} />}
            {f.verificationStatus === "APPROVED" && f.isActive && (
              <>
                <ContractForm
                  schema="StaffCreate"
                  method="post"
                  url={"/admin/facilities/" + id + "/staff"}
                  title="Provision facility staff"
                  detail="Provide a strong initial password privately to the staff member. Only safe staff account information is returned."
                  onSuccess={(data) => {
                    setStaff(data as Staff);
                    setStaffInput((data as Staff).id);
                    setStaffId((data as Staff).id);
                  }}
                />
                {staff && (
                  <Card>
                    <Text style={styles.h3}>Staff account created</Text>
                    <Text style={styles.body}>{staff.name}</Text>
                    <Text selectable style={styles.muted}>
                      Staff ID: {staff.id}
                    </Text>
                  </Card>
                )}
              </>
            )}
            <Card>
              <Field
                label="Existing associated staff ID"
                value={staffInput}
                onChangeText={setStaffInput}
                autoCapitalize="none"
              />
              <Button
                title="Select staff permissions"
                disabled={!/^[a-fA-F0-9]{24}$/.test(staffInput)}
                variant="secondary"
                onPress={() => setStaffId(staffInput)}
              />
              <Text style={styles.muted}>
                There is no staff-list endpoint. Use the exact ID from
                provisioning. This replaces the full permission list; current
                permissions cannot be loaded from the API.
              </Text>
            </Card>
            {staffId && (
              <ContractForm
                key={staffId}
                schema="PermissionsInput"
                method="put"
                url={
                  "/admin/facilities/" +
                  id +
                  "/staff/" +
                  staffId +
                  "/permissions"
                }
                title="Replace staff permissions"
                initial={
                  staff?.id === staffId
                    ? { permissions: staff.permissions }
                    : undefined
                }
              />
            )}
            <Card>
              <Text style={styles.h3}>Facility lifecycle</Text>
              {f.statusHistory?.map((e, i) => (
                <Text key={i} style={styles.muted}>
                  {e.previousStatus} → {e.newStatus} · {dateText(e.timestamp)} ·{" "}
                  {e.reason}
                </Text>
              ))}
            </Card>
          </>
        )
      )}
      <ConfirmationModal
        visible={locationConfirm}
        title="Are you at this facility?"
        detail="Confirm that you are physically at the facility's official location. We will ask for foreground device-location permission and use the current position."
        busy={busy}
        onCancel={() => setLocationConfirm(false)}
        onConfirm={() => void setLocation()}
      />
    </Screen>
  );
}
