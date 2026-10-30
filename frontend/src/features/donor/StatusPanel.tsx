import React, { useState } from "react";
import { Text, View } from "react-native";
import { useResource, useAction } from "../../hooks/api";
import { devicePoint } from "../../services/location";
import type { LocationState, Verification } from "../../types/api";
import {
  Badge,
  BloodTypeBadge,
  Button,
  Card,
  ConfirmationModal,
  ErrorState,
  Loading,
  ToggleRow,
  styles,
} from "../../components/ui";
import { dateText } from "../../utils/domain";
export function StatusPanel({ compact = false }: { compact?: boolean }) {
  const location = useResource<LocationState>("/donors/me/location");
  const verification = useResource<Verification>("/donors/me/verification");
  const action = useAction();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<unknown>();
  const [locating, setLocating] = useState(false);
  const busy = action.isPending || locating;
  const mutate = async (url: string, body: unknown, method = "patch") => {
    setError(undefined);
    try {
      await action.mutateAsync({ url, body, method });
    } catch (e) {
      setError(e);
    }
  };
  const update = async (enable = false) => {
    setLocating(true);
    setError(undefined);
    try {
      const point = await devicePoint();
      if (enable)
        await action.mutateAsync({
          method: "patch",
          url: "/donors/me/location-sharing",
          body: { locationSharingEnabled: true },
        });
      await action.mutateAsync({
        method: "put",
        url: "/donors/me/location",
        body: point,
      });
      setConsent(false);
    } catch (e) {
      setConsent(false);
      setError(e);
    } finally {
      setLocating(false);
    }
  };
  if (location.isPending || verification.isPending) return <Loading />;
  if (location.error || verification.error)
    return (
      <ErrorState
        error={location.error ?? verification.error}
        retry={() => {
          void location.refetch();
          void verification.refetch();
        }}
      />
    );
  const l = location.data!,
    v = verification.data!;
  return (
    <>
      <Card>
        <Text style={styles.caption}>YOUR DONOR STATUS</Text>
        <View style={styles.between}>
          <Badge value={l.availabilityStatus} />
          <Badge value={v.verificationStatus} />
        </View>
        <View style={styles.row}>
          {v.verifiedBloodType ? (
            <BloodTypeBadge value={v.verifiedBloodType} />
          ) : (
            <Text style={styles.h3}>Blood group not yet verified</Text>
          )}
          <Text style={[styles.muted, { flex: 1 }]}>
            {v.verifiedByFacility?.name ??
              "Visit an approved facility to verify your donor profile."}
          </Text>
        </View>
        <ToggleRow
          title="Available to respond"
          detail={
            l.availabilityStatus === "AVAILABLE"
              ? "I can receive relevant blood requests."
              : "Do not match me with new blood requests."
          }
          value={l.availabilityStatus === "AVAILABLE"}
          disabled={busy}
          onChange={(value) =>
            void mutate("/donors/me/availability", {
              availabilityStatus: value ? "AVAILABLE" : "UNAVAILABLE",
            })
          }
        />
        <Text style={styles.muted}>
          Location sharing {l.locationSharingEnabled ? "on" : "off"} ·{" "}
          {l.isLocationFresh
            ? "Location up to date"
            : l.hasLocation
              ? "Location needs updating"
              : "No location shared"}
        </Text>
        {!compact && (
          <>
            <View style={styles.divider} />
            <ToggleRow
              title="Share my location"
              detail="Used privately to identify relevant requests. Turning this off erases your saved location."
              value={l.locationSharingEnabled}
              disabled={busy}
              onChange={(enabled) =>
                enabled
                  ? setConsent(true)
                  : void mutate("/donors/me/location-sharing", {
                      locationSharingEnabled: false,
                    })
              }
            />
            {l.locationSharingEnabled && (
              <Button
                title="Update my location"
                variant="secondary"
                loading={busy}
                onPress={() => void update()}
              />
            )}
            <Text style={styles.muted}>
              Last updated: {dateText(l.locationUpdatedAt)}
            </Text>
            <Text style={styles.muted}>
              LifeLink does not continuously track your location. Your exact
              location is not shown to facilities.
            </Text>
            {l.hasLocation && (
              <Button
                title="Erase saved location and stop sharing"
                variant="text"
                disabled={busy}
                onPress={() => void mutate("/donors/me/location", {}, "delete")}
              />
            )}
            <Text style={styles.muted}>
              Verification confirms your LifeLink donor profile. Final screening
              is still performed by the facility before donation.
            </Text>
            {v.verificationStatus === "SUSPENDED" && (
              <Text style={styles.muted}>
                Your verification is paused. Contact your verifying facility for
                guidance.
              </Text>
            )}
            {v.verificationStatus === "REQUIRES_REVERIFICATION" && (
              <Text style={styles.muted}>
                Please visit an approved facility to have your profile checked
                again.
              </Text>
            )}
          </>
        )}
      </Card>
      {error != null && <ErrorState error={error} />}
      <ConfirmationModal
        visible={consent}
        title="Share your current location?"
        detail="Your location helps LifeLink identify relevant blood requests near you. It is not shown to facilities. We will ask for device permission and capture your location once. You can stop sharing at any time."
        busy={busy}
        onCancel={() => setConsent(false)}
        onConfirm={() => void update(true)}
      />
    </>
  );
}
